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

import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { downloadCloudflared } from './cloudflared.mjs'
import { writeDownloadState } from './download-state.mjs'

const [binDir, stateFile] = process.argv.slice(2)

if (typeof binDir !== 'string' || typeof stateFile !== 'string') {
  process.stderr.write('usage: download-worker.mjs <binDir> <stateFile>\n')
  process.exit(2)
}

/** 进度落盘节流：文件系统不该被每个 chunk 打一次。 */
const FLUSH_MS = 500
let lastFlush = 0
let pending = { received: 0, total: 0 }

const flush = (force) => {
  const now = Date.now()
  if (!force && now - lastFlush < FLUSH_MS) return
  lastFlush = now
  writeDownloadState(stateFile, { state: 'downloading', pid: process.pid, ...pending })
}

/** 任何退出路径都留下确定状态：进程没了，状态文件不该还显示「下载中」。 */
const fail = (error) => {
  writeDownloadState(stateFile, {
    state: 'failed',
    pid: null,
    received: pending.received,
    total: pending.total,
    error: String(error?.message ?? error),
  })
  process.exit(1)
}

process.on('uncaughtException', fail)
process.on('unhandledRejection', fail)

process.stdout.on('error', () => {})
process.stderr.on('error', () => {})

flush(true)

downloadCloudflared(binDir, (progress) => {
  pending = { received: progress.received, total: progress.total }
  flush(false)
})
  .then((binary) => {
    writeDownloadState(stateFile, { state: 'ready', pid: null, received: 1, total: 1, path: binary })
    process.exit(0)
  })
  .catch((error) => {
    // 失败时清掉半成品压缩包，下次重试从干净状态开始。
    for (const name of readdirSync(binDir)) {
      if (name.endsWith('.tmp')) rmSync(join(binDir, name), { force: true })
    }
    fail(error)
  })
