import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
//#region src/cloudflared.mjs
/**
* cloudflared 的获取：查找、下载、版本探测。
*
* 下载放在独立进程里跑（见 `download-worker.mjs`），这里是可以被两边共用的
* 无状态实现——插件进程只做「找得到就返回路径」，下载本身不占 dsh 的线程与生命周期。
*
* @module dsh-share-link/cloudflared
*/
/** Windows 上可执行文件带扩展名、PATH 分隔符也不同。 */
const IS_WINDOWS = process.platform === "win32";
const BINARY_NAME = IS_WINDOWS ? "cloudflared.exe" : "cloudflared";
/**
* 下载参数：前 3 秒跑不到 200 KB 就判慢、换下一个源；15 秒没新数据算卡死。
* 实测同一条网络上 GitHub 直连 18 KB/s（20 MB ≈ 18 分钟）、ghproxy 180 KB/s。
*/
const DOWNLOAD = Object.freeze({
	raceMs: 3e3,
	raceBytes: 200 * 1024,
	stallMs: 15e3,
	totalMs: 360 * 1e3
});
/** @returns {string} 当前平台对应的 release 资产名。 */
function cloudflaredAsset() {
	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	if (IS_WINDOWS) return `cloudflared-windows-${arch}.exe`;
	return `cloudflared-${process.platform === "darwin" ? "darwin" : "linux"}-${arch}.tgz`;
}
/**
* 下载 cloudflared 并解压到 `binDir`，返回可执行文件路径。
*
* 两个源**按顺序试**，但第一个源带「慢速探测」：3 秒内拿不到 200 KB 就换下一个。
*
* @param {string} binDir
* @param {(progress: {received: number, total: number}) => void} [onProgress]
* @returns {Promise<string>}
*/
async function downloadCloudflared(binDir, onProgress = () => {}) {
	mkdirSync(binDir, { recursive: true });
	const asset = cloudflaredAsset();
	const archive = join(binDir, `${asset}.tmp`);
	const sources = [`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`, `https://ghproxy.net/https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`];
	const errors = [];
	for (const [index, url] of sources.entries()) try {
		await downloadTo(url, archive, onProgress, { probe: index === 0 });
		break;
	} catch (error) {
		errors.push(`${url}: ${String(error?.message ?? error)}`);
		if (index === sources.length - 1) throw new Error(`下载 cloudflared 失败\n${errors.join("\n")}`);
	}
	if (IS_WINDOWS) {
		const binary = join(binDir, BINARY_NAME);
		writeFileSync(binary, readFileSync(archive));
		rmSync(archive, { force: true });
		return binary;
	}
	await new Promise((done, fail) => {
		const tar = spawn("tar", [
			"-xzf",
			archive,
			"-C",
			binDir
		], { stdio: "ignore" });
		tar.on("exit", (code) => code === 0 ? done() : fail(/* @__PURE__ */ new Error(`tar 退出 ${code}`)));
		tar.on("error", fail);
	});
	rmSync(archive, { force: true });
	const binary = join(binDir, "cloudflared");
	if (!existsSync(binary)) throw new Error("解压后没有 cloudflared");
	return binary;
}
/**
* 把一个 URL 下载到文件，带进度回调、卡死探测与总超时。
* @param {string} url
* @param {string} file
* @param {(progress: {received: number, total: number}) => void} onProgress
* @param {{probe?: boolean}} [options] - `probe`：前 raceMs 内不到 raceBytes 就主动放弃
* @returns {Promise<void>}
*/
async function downloadTo(url, file, onProgress, options = {}) {
	const controller = new AbortController();
	let received = 0;
	let stall;
	const arm = () => {
		clearTimeout(stall);
		stall = setTimeout(() => controller.abort(/* @__PURE__ */ new Error(`${DOWNLOAD.stallMs / 1e3}s 没有新数据`)), DOWNLOAD.stallMs);
	};
	const hardStop = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("下载超时")), DOWNLOAD.totalMs);
	const probe = options.probe === true ? setTimeout(() => {
		if (received < DOWNLOAD.raceBytes) controller.abort(/* @__PURE__ */ new Error(`太慢（${received} B / ${DOWNLOAD.raceMs / 1e3}s）`));
	}, DOWNLOAD.raceMs) : void 0;
	try {
		arm();
		const response = await fetch(url, {
			redirect: "follow",
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const total = Number(response.headers.get("content-length") ?? 0);
		const chunks = [];
		for await (const chunk of response.body) {
			received += chunk.length;
			chunks.push(chunk);
			arm();
			onProgress({
				received,
				total
			});
		}
		writeFileSync(file, Buffer.concat(chunks));
	} finally {
		clearTimeout(stall);
		clearTimeout(hardStop);
		clearTimeout(probe);
	}
}
//#endregion
//#region src/download-state.mjs
/**
* cloudflared 下载的**进度文件**约定。
*
* 下载跑在独立进程里（`download-worker.mjs`），它只往这个文件写状态；插件侧
* 只读文件——所以 dsh 重启、插件热更新都不影响下载，下载进程死了也能从
* `pid` 判断出来。
*
* @module dsh-share-link/download-state
*/
/**
* @typedef {object} DownloadState
* @property {'downloading'|'ready'|'failed'} state
* @property {number} received - 已下载字节
* @property {number} total - 总字节（0 = 服务器没给 content-length）
* @property {number} updatedAt - epoch ms
* @property {number|null} [pid] - 下载进程 pid
* @property {string} [path] - 成功后可执行文件的路径
* @property {string} [error] - 失败原因
*/
/**
* 原子写：先写 `.tmp` 再 `rename`，避免读侧拿到半截 JSON。
* @param {string} file
* @param {DownloadState} state
*/
function writeDownloadState(file, state) {
	const body = JSON.stringify({
		...state,
		updatedAt: Date.now()
	}, null, 0);
	writeFileSync(`${file}.tmp`, body);
	renameSync(`${file}.tmp`, file);
}
//#endregion
//#region src/download-worker.mjs
/**
* cloudflared 的独立下载进程。
*
* 为什么不在 dsh 进程里下：20 MB 在慢网络上是分钟级的，把它绑在插件生命周期上
* 意味着「重启 dsh 就前功尽弃」，也让插件得为一个后台任务维护内存状态。
* 这里做成一个 detached 子进程：写完进度就退出，插件只读状态文件。
*
* 用法：`node download-worker.mjs <binDir> <stateFile>`
*
* @module dsh-share-link/download-worker
*/
const [binDir, stateFile] = process.argv.slice(2);
if (typeof binDir !== "string" || typeof stateFile !== "string") {
	process.stderr.write("usage: download-worker.mjs <binDir> <stateFile>\n");
	process.exit(2);
}
/** 进度落盘节流：文件系统不该被每个 chunk 打一次。 */
const FLUSH_MS = 500;
let lastFlush = 0;
let pending = {
	received: 0,
	total: 0
};
const flush = (force) => {
	const now = Date.now();
	if (!force && now - lastFlush < FLUSH_MS) return;
	lastFlush = now;
	writeDownloadState(stateFile, {
		state: "downloading",
		pid: process.pid,
		...pending
	});
};
/** 任何退出路径都留下确定状态：进程没了，状态文件不该还显示「下载中」。 */
const fail = (error) => {
	writeDownloadState(stateFile, {
		state: "failed",
		pid: null,
		received: pending.received,
		total: pending.total,
		error: String(error?.message ?? error)
	});
	process.exit(1);
};
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);
process.stdout.on("error", () => {});
process.stderr.on("error", () => {});
flush(true);
downloadCloudflared(binDir, (progress) => {
	pending = {
		received: progress.received,
		total: progress.total
	};
	flush(false);
}).then((binary) => {
	writeDownloadState(stateFile, {
		state: "ready",
		pid: null,
		received: 1,
		total: 1,
		path: binary
	});
	process.exit(0);
}).catch((error) => {
	for (const name of readdirSync(binDir)) if (name.endsWith(".tmp")) rmSync(join(binDir, name), { force: true });
	fail(error);
});
//#endregion
export {};
