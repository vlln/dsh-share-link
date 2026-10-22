/**
 * cloudflared 下载的**进度文件**约定。
 *
 * 下载跑在独立进程里（`download-worker.mjs`），它只往这个文件写状态；插件侧
 * 只读文件——所以 dsh 重启、插件热更新都不影响下载，下载进程死了也能从
 * `pid` 判断出来。
 *
 * @module dsh-share-link/download-state
 */

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'

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
export function writeDownloadState(file, state) {
  const body = JSON.stringify({ ...state, updatedAt: Date.now() }, null, 0)
  writeFileSync(`${file}.tmp`, body)
  renameSync(`${file}.tmp`, file)
}

/**
 * @param {string} file
 * @returns {DownloadState|undefined}
 */
export function readDownloadState(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof parsed?.state !== 'string') return undefined
    return parsed
  } catch {
    return undefined
  }
}

/** @param {string} file */
export function clearDownloadState(file) {
  rmSync(file, { force: true })
  rmSync(`${file}.tmp`, { force: true })
}

/**
 * pid 是否还活着。`process.kill(pid, 0)` 不发送信号，只做存在性检查。
 * @param {number|undefined|null} pid
 * @returns {boolean}
 */
export function isPidAlive(pid) {
  if (typeof pid !== 'number' || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** @param {string} file */
export function stateFileExists(file) {
  return existsSync(file)
}
