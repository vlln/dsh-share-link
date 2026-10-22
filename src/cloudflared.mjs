/**
 * cloudflared 的获取：查找、下载、版本探测。
 *
 * 全是无状态函数：`ShareManager` 在自己的进程里调用它们（0.6.0 起下载不再有
 * 独立的 worker 进程，那个设计已回滚）。
 *
 * @module dsh-share-link/cloudflared
 */

import { spawn } from 'node:child_process'
import {
  accessSync,
  constants as FS_CONSTANTS,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { delimiter, join } from 'node:path'

/** Windows 上可执行文件带扩展名、PATH 分隔符也不同。 */
export const IS_WINDOWS = process.platform === 'win32'
export const BINARY_NAME = IS_WINDOWS ? 'cloudflared.exe' : 'cloudflared'

/**
 * 下载参数：前 3 秒跑不到 200 KB 就判慢、换下一个源；15 秒没新数据算卡死。
 *
 * `totalMs` 是**硬上限**，不是速度判断——晚高峰实测只有 50 KB/s（19.8 MB ≈ 6.6 分钟），
 * 原来设 6 分钟会在大文件还没下完时把它掐掉（真踩过）。真正防卡死的是 stallMs。
 */
export const DOWNLOAD = Object.freeze({
  raceMs: 3000,
  raceBytes: 200 * 1024,
  stallMs: 15_000,
  totalMs: 20 * 60 * 1000,
})

/**
 * 在 PATH 上找可执行文件（同步：发布路径要立刻判断）。
 * @param {string} name
 * @returns {string|undefined}
 */
export function findOnPath(name) {
  const candidates = IS_WINDOWS ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`, name] : [name]
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir === '') continue
    for (const candidate of candidates) {
      const full = join(dir, candidate)
      try {
        if (!statSync(full).isFile()) continue
        // 不可执行的文件返回给 spawn 只会换来 EACCES/ENOEXEC，不如当没找到。
        if (!IS_WINDOWS) accessSync(full, FS_CONSTANTS.X_OK)
        return full
      } catch {
        /* 不存在 / 不可执行就继续 */
      }
    }
  }
  return undefined
}

/** @returns {string} 当前平台对应的 release 资产名。 */
export function cloudflaredAsset() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  if (IS_WINDOWS) return `cloudflared-windows-${arch}.exe`
  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  return `cloudflared-${os}-${arch}.tgz`
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
export async function downloadCloudflared(binDir, onProgress = () => {}) {
  mkdirSync(binDir, { recursive: true })
  const asset = cloudflaredAsset()
  const archive = join(binDir, `${asset}.tmp`)
  const sources = [
    `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`,
    `https://ghproxy.net/https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`,
  ]
  const errors = []
  for (const [index, url] of sources.entries()) {
    try {
      await downloadTo(url, archive, onProgress, { probe: index === 0 })
      break
    } catch (error) {
      errors.push(`${url}: ${String(error?.message ?? error)}`)
      if (index === sources.length - 1) throw new Error(`下载 cloudflared 失败\n${errors.join('\n')}`)
    }
  }

  // Windows 的 release 资产是裸 .exe，不需要解压。
  if (IS_WINDOWS) {
    const binary = join(binDir, BINARY_NAME)
    writeFileSync(binary, readFileSync(archive))
    rmSync(archive, { force: true })
    return binary
  }
  await new Promise((done, fail) => {
    const tar = spawn('tar', ['-xzf', archive, '-C', binDir], { stdio: 'ignore' })
    tar.on('exit', (code) => (code === 0 ? done() : fail(new Error(`tar 退出 ${code}`))))
    tar.on('error', fail)
  }).catch((error) => {
    // 解压失败也要把 20 MB 的 .tmp 清掉，否则下次启动会当缓存留着。
    rmSync(archive, { force: true })
    throw error
  })
  rmSync(archive, { force: true })
  const binary = join(binDir, 'cloudflared')
  if (!existsSync(binary)) throw new Error('解压后没有 cloudflared')
  return binary
}

/**
 * 把一个 URL 下载到文件，带进度回调、卡死探测与总超时。
 * @param {string} url
 * @param {string} file
 * @param {(progress: {received: number, total: number}) => void} onProgress
 * @param {{probe?: boolean}} [options] - `probe`：前 raceMs 内不到 raceBytes 就主动放弃
 * @returns {Promise<void>}
 */
export async function downloadTo(url, file, onProgress, options = {}) {
  const controller = new AbortController()
  let received = 0
  let stall
  const arm = () => {
    clearTimeout(stall)
    stall = setTimeout(() => controller.abort(new Error(`${DOWNLOAD.stallMs / 1000}s 没有新数据`)), DOWNLOAD.stallMs)
  }
  const hardStop = setTimeout(() => controller.abort(new Error('下载超时')), DOWNLOAD.totalMs)
  const probe =
    options.probe === true
      ? setTimeout(() => {
          if (received < DOWNLOAD.raceBytes) controller.abort(new Error(`太慢（${received} B / ${DOWNLOAD.raceMs / 1000}s）`))
        }, DOWNLOAD.raceMs)
      : undefined
  try {
    arm()
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const total = Number(response.headers.get('content-length') ?? 0)
    const chunks = []
    for await (const chunk of response.body) {
      received += chunk.length
      chunks.push(chunk)
      arm()
      onProgress({ received, total })
    }
    writeFileSync(file, Buffer.concat(chunks))
  } finally {
    clearTimeout(stall)
    clearTimeout(hardStop)
    clearTimeout(probe)
  }
}

/**
 * 跑一个可执行文件并收集输出（带超时），用于「检查」这类一次性探测。
 * @param {string} binary
 * @param {string[]} args
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
export function runOnce(binary, args, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${binary} 超时`))
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolvePromise(output)
      else reject(new Error(`${binary} 退出 ${code}`))
    })
  })
}

/**
 * 探测 cloudflared 版本号（`cloudflared --version` → `cloudflared version 2026.10.3`）。
 * @param {string} binary
 * @returns {Promise<string|undefined>}
 */
export async function probeVersion(binary) {
  const output = await runOnce(binary, ['--version']).catch(() => undefined)
  if (output === undefined) return undefined
  return /version\s+([0-9][^\s]*)/i.exec(output)?.[1]
}

/** @param {number} bytes @returns {string} */
export function formatMb(bytes) {
  if (!(bytes > 0)) return '0 MB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
