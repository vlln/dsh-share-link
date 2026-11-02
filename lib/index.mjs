import { i as TTL_HOURS, r as ShareManager, t as CODE_LENGTH } from "./share-link-re9TLFk9.mjs";
import Schema from "@deepseek-ai/schemastery";
//#region src/index.mjs
/**
* dsh-share-link · Host half
*
* 把「一个产物」发布成只读公网链接：会话快照或本地文件/目录 → 静态目录 +
* cloudflared 隧道 → `https://xxx.trycloudflare.com/s/<token>/`。
*
* 刻意不做的事：不透传主 GUI（3080）、不代理工具调用、不提供写接口。分享面
* 只有「静态文件 + 一个只读 GET 路由」。
*
* @module @vlln/dsh-share-link
*/
const name = "dsh-share-link";
/**
* 宿主能力：会话读取 + 同源 HTTP 路由。
*
* 四个分享工具**不在这里**——它们是同包另四个入口（`./tools/*`），各自一行、
* 默认关闭，经 `ctx.shareLink` 服务使用这里的管理器。core 只提供服务，不注册工具。
*/
const inject = ["sessionQuery", "connection"];
/** 配置项。`port` 传 0 表示随机端口（推荐，避免与宿主端口冲突）。 */
/** 配置默认值（设置卡与运行时共用同一份，避免两处漂移）。 */
const DEFAULTS = Object.freeze({
	defaultChannel: "quick",
	port: 0,
	ttlHours: TTL_HOURS.default,
	cloudflaredPath: "",
	cloudflaredSha256: "",
	tunnelToken: "",
	tunnelHostname: "",
	surgeLogin: "",
	surgeToken: "",
	surgeDomain: "",
	surgePrefix: "dsh-share",
	pageTheme: "article",
	pageThemeCss: "",
	idLength: CODE_LENGTH.default
});
const Config = Schema.object({
	defaultChannel: Schema.union([
		"quick",
		"surge",
		"named",
		"lan"
	]).default(DEFAULTS.defaultChannel).volatile().description("分享弹窗里默认选中的通道"),
	port: Schema.natural().default(DEFAULTS.port).volatile().description("只读分享服务端口，0 = 随机（命名隧道模式下自动用 3089）"),
	idLength: Schema.natural().min(CODE_LENGTH.min).max(CODE_LENGTH.max).default(DEFAULTS.idLength).volatile().description("分享链接里的短码长度：8 位 ≈ 41 bit 熵（默认，够发也够难猜），10 位 ≈ 52 bit，16 位 ≈ 83 bit"),
	ttlHours: Schema.natural().min(TTL_HOURS.min).max(TTL_HOURS.max).default(DEFAULTS.ttlHours).volatile().description("分享链接默认有效期（小时）"),
	cloudflaredPath: Schema.string().default(DEFAULTS.cloudflaredPath).volatile().description("已有 cloudflared 可执行文件路径；留空则自动查找/下载"),
	cloudflaredSha256: Schema.string().default(DEFAULTS.cloudflaredSha256).volatile().description("可选：cloudflared 二进制的 SHA-256（64 位 hex）。填了就在下载后校验，不匹配直接删掉"),
	tunnelToken: Schema.string().default(DEFAULTS.tunnelToken).volatile().description("Cloudflare 命名隧道的 token；填了就产出固定域名链接"),
	tunnelHostname: Schema.string().default(DEFAULTS.tunnelHostname).volatile().description("命名隧道绑定的域名，例如 share.example.com"),
	surgeLogin: Schema.string().default(DEFAULTS.surgeLogin).volatile().description("Surge 账号邮箱；配合 surgeToken 免交互登录"),
	surgeToken: Schema.string().default(DEFAULTS.surgeToken).volatile().description("Surge token（`surge tokens add`）；只注入给子进程，不落盘"),
	surgeDomain: Schema.string().default(DEFAULTS.surgeDomain).volatile().description("Surge 域名后缀，例如 example.com；留空用 slug.surge.sh"),
	surgePrefix: Schema.string().default(DEFAULTS.surgePrefix).volatile().description("Surge 子域前缀，最终域名是 <prefix>-<id>.surge.sh"),
	pageTheme: Schema.union([
		"article",
		"paper",
		"github",
		"notion",
		"sepia",
		"terminal",
		"custom"
	]).default(DEFAULTS.pageTheme).volatile().description("分享页预设风格；custom = 只用 pageThemeCss"),
	pageThemeCss: Schema.string().default("").volatile().description("自定义 CSS，追加在预设之后（可只写变量覆盖）")
});
/**
* 解引用 volatile 叶并补默认值。volatile 叶在运行时是 `{ get() }` 包装，
* 每次要用就重读——别缓存引用本身。
* @param {any} raw
*/
function readConfig(raw) {
	const unwrap = (value) => {
		if (value !== null && typeof value === "object" && typeof value.get === "function" && Object.keys(value).length === 1) return unwrap(value.get());
		if (Array.isArray(value)) return value.map(unwrap);
		if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrap(item)]));
		return value;
	};
	return {
		...DEFAULTS,
		...unwrap(raw ?? {})
	};
}
/**
* 注册分享服务（`ctx.shareLink`）与只读路由。
*
* 工具由同包的四个入口各自注册（见 `src/tools/*`），它们 `inject: ['tools','shareLink']`
* 并使用这里的服务；这样每个工具都能在 Plugins 页单独开关，不需要额外的配置开关。
* @param {any} ctx - host 上下文。
* @param {any} [config]
*/
function apply(ctx, config = {}) {
	let liveConfig = readConfig(config);
	const manager = new ShareManager({
		ctx,
		config: liveConfig
	});
	ctx.effect(() => ctx.on("loader/volatile-update", () => {
		liveConfig = readConfig(config);
		manager.config = liveConfig;
	}), "share-link: live config");
	ctx.effect(() => {
		manager.start().catch((error) => {
			ctx.logger?.warn?.(`[share-link] 分享服务未启动：${String(error)}`);
		});
		return () => {
			manager.stop();
		};
	}, "share-link: readonly server");
	ctx.provide("shareLink", {
		createSessionShare: (sessionId, options) => manager.createSessionShare(sessionId, options),
		createPathShare: (path, options) => manager.createPathShare(path, options),
		list: () => manager.list(),
		revoke: (id) => manager.revoke(id)
	});
	const route = (path, methods, handler) => ctx.connection.fetch.register({
		path,
		methods,
		requestBody: "buffered",
		fetch: async (request) => {
			const origin = request.headers.get("origin");
			const host = request.headers.get("host");
			if (origin !== null && !isSameOrigin(origin, host)) return json({ error: "cross-origin request rejected" }, 403);
			try {
				return await handler(request);
			} catch (error) {
				return json({
					error: String(error?.message ?? error),
					code: error?.code,
					guide: error?.guide
				}, 400);
			}
		}
	});
	route("/api/share-link/session", ["POST"], async (request) => {
		const body = await readJson(request);
		return json(await manager.createSessionShare(body.sessionId, {
			includeToolCalls: body.includeToolCalls === true,
			channel: body.channel,
			title: body.title,
			ttlHours: body.ttlHours
		}));
	});
	route("/api/share-link/path", ["POST"], async (request) => {
		const body = await readJson(request);
		return json(await manager.createPathShare(body.path, {
			channel: body.channel,
			title: body.title,
			ttlHours: body.ttlHours,
			cwd: body.cwd
		}));
	});
	route("/api/share-link/status", ["GET"], async () => json(await manager.status()));
	route("/api/share-link/check", ["POST"], async () => json(await manager.check()));
	route("/api/share-link/preview", ["POST"], async (request) => {
		const body = await readJson(request);
		const html = manager.previewPage({
			theme: body.theme,
			customCss: body.customCss
		});
		return new Response(html, {
			status: 200,
			headers: { "content-type": "text/html; charset=utf-8" }
		});
	});
	route("/api/share-link/list", ["GET"], async () => json({ items: manager.list() }));
	route("/api/share-link/revoke", ["POST"], async (request) => {
		const body = await readJson(request);
		return json({ revoked: await manager.revoke(body.id) });
	});
}
/**
* 同源判定。
*
* `Origin` 可能是字面量 `null`（sandboxed iframe、本地文件）——`new URL('null')`
* 会抛，必须在比较之前挡住，别让它在路由里变成 500。
* @param {string} origin
* @param {string|null} host
*/
function isSameOrigin(origin, host) {
	if (host === null) return true;
	let parsed;
	try {
		parsed = new URL(origin);
	} catch {
		return false;
	}
	return parsed.host === host;
}
/** @param {any} request */
async function readJson(request) {
	const text = await request.text();
	if (text.trim() === "") return {};
	return JSON.parse(text);
}
/** @param {unknown} payload @param {number} [status] */
function json(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}
//#endregion
export { Config, DEFAULTS, apply, inject, name, readConfig };
