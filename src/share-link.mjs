/**
 * 分享管理器：本地只读静态服务 + 分享存储 + 公网隧道。
 *
 * 三件事刻意分开：
 * 1. **只读静态服务**只绑 127.0.0.1，只认 `GET /s/<id>/…`，不碰主 GUI、不碰 3080；
 * 2. **分享存储**是 `$DSH_HOME/share-link/` 下的普通目录，删掉即撤销；
 * 3. **公网隧道**是 cloudflared 子进程，链接的生命周期 = 进程的存活期。
 *
 * @module dsh-share-link/share
 */

import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import {
  accessSync,
  constants as FS_CONSTANTS,
  cpSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { homedir, networkInterfaces } from 'node:os'
import { delimiter, dirname, extname, join, relative, resolve, sep } from 'node:path'

import { foldSurface } from '@deepseek-ai/dsh-session'

import {
  BINARY_NAME,
  IS_WINDOWS,
  downloadCloudflared,
  findOnPath,
  formatMb,
  probeVersion,
} from './cloudflared.mjs'

import {
  PAGE_CSP,
  redact,
  renderDirectoryIndex,
  renderMarkdownDocument,
  renderSessionPage,
} from './session-page.mjs'

/** 单文件 / 单目录的体积与数量上限，防止误分享整个 home。 */
export const LIMITS = {
  maxBytes: 100 * 1024 * 1024,
  maxFiles: 2000,
}

/** 有效期边界。schema、HTTP 路由与 agent 工具共用同一组值，谁都不能绕过上限。 */
export const TTL_HOURS = Object.freeze({ min: 1, max: 720, default: 168 })

/** 分享 `.md` 时对图片的约束：本地相对图片原样附带，公网图片发布时内联。 */
export const MARKDOWN_IMAGES = Object.freeze({
  maxCount: 24,
  maxBytesEach: 2 * 1024 * 1024,
  maxBytesTotal: 8 * 1024 * 1024,
  timeoutMs: 6000,
  concurrency: 6,
})

/**
 * 分享短码的字符集：小写 base36。
 *
 * **刻意不用 base62 / base64url**：路径段本身大小写敏感，但聊天软件预览、
 * 移动端自动大写、人工转述都把 URL 折成小写是常事——一旦大小写被抹平，
 * 两个不同的 key 就会撞到同一个地址（指向别人的分享）。全小写把这一整类
 * 失效消掉，代价是每字符 5.17 bit 而不是 6 bit。
 */
const CODE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 短码长度：8 位 ≈ 41.4 bit，10 位 ≈ 51.7 bit，16 位 ≈ 82.7 bit。 */
export const CODE_LENGTH = Object.freeze({ min: 8, max: 16, default: 8 })

/** @param {unknown} value @returns {number} */
function normalizeCodeLength(value) {
  const number = typeof value === 'number' && Number.isInteger(value) ? value : CODE_LENGTH.default
  return Math.min(CODE_LENGTH.max, Math.max(CODE_LENGTH.min, number))
}

/**
 * 生成无偏短码。
 *
 * 用**拒绝采样**而不是 `randomBytes(n) % 36`：36 不整除 256，直接取模会让
 * 前 4 个字符比其余字符多出约 1/7 的概率。252 = 7 × 36，丢掉 >= 252 的
 * 字节之后 `byte % 36` 严格均匀。
 *
 * @param {number} [length]
 * @returns {string}
 */
export function shortCode(length = CODE_LENGTH.default) {
  const size = normalizeCodeLength(length)
  let code = ''
  while (code.length < size) {
    for (const byte of randomBytes(size * 2)) {
      if (byte >= 252) continue
      code += CODE_ALPHABET[byte % 36]
      if (code.length === size) break
    }
  }
  return code
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

/** @param {string} file */
function mimeOf(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** @returns {string} 形如 `2026-10-20T12:00:00.000Z`。 */
function nowIso() {
  return new Date().toISOString()
}

/**
 * dsh 自己注入到 user 位置的「上下文噪音」前缀。
 *
 * 会话 surface 上的 `user/message` 既包含人类直接输入，也包含 harness 注入的
 * 运行时上下文、system-reminder、技能清单等。分享页要的是**对话**，所以按
 * 已知前缀丢掉后者——这是尽力而为的过滤，不是分类器。
 */
const INJECTED_PREFIXES = [
  'Current runtime context.',
  '<system-reminder>',
  '<available_skills>',
  '<environment',
  'Token budget',
  'Available skills',
  'Time sampled while',
]

/** 出现在注入上下文正文里的特征句（前缀之外的第二道网）。 */
const INJECTED_MARKERS = [
  'Browser time zone for this request',
  'Elapsed since the preceding model-visible message',
  'This snapshot supersedes earlier runtime-context snapshots',
]

/** @param {string} text */
function isInjectedContext(text) {
  const head = text.trimStart()
  if (INJECTED_PREFIXES.some((prefix) => head.startsWith(prefix))) return true
  return INJECTED_MARKERS.some((marker) => head.includes(marker))
}

/**
 * 从 surface 事件里投影出可渲染的消息。
 * 只保留 user/assistant 的 **文本**；工具调用默认只留名字，结果正文一律不投影。
 * @param {Array<{type: string, data: any, time?: number}>} events
 * @param {{includeToolCalls?: boolean}} options
 */
export function projectSurface(events, options = {}) {
  const messages = []
  for (const event of events) {
    const data = event?.data ?? {}
    if (event.type === 'user/message') {
      const text = messageText(data.content ?? data)
      if (text.trim() !== '' && !isInjectedContext(text)) {
        messages.push({ role: 'user', text, time: eventTime(event) })
      }
      continue
    }
    if (event.type === 'assistant/message') {
      const message = data.message ?? {}
      const text = messageText(message.content ?? message)
      const tools = options.includeToolCalls === true ? toolNames(message.content) : []
      if (text.trim() !== '' || tools.length > 0) {
        messages.push({
          role: 'assistant',
          text: text.trim() === '' ? '（本步只有工具调用）' : text,
          tools,
          time: eventTime(event),
        });
      }
      continue
    }
    if (event.type === 'tool/result' && options.includeToolCalls === true) {
      const name = data.message?.toolName ?? data.message?.name
      if (typeof name === 'string' && messages.length > 0 && messages.at(-1).role === 'assistant') {
        const last = messages.at(-1)
        last.tools = [...(last.tools ?? []), name]
      }
    }
  }
  return messages
}

/** 事件时间（epoch ms）；缺失时不渲染时间，而不是编一个。
 * @param {{time?: unknown}} event
 * @returns {number|undefined}
 */
function eventTime(event) {
  return typeof event?.time === 'number' && Number.isFinite(event.time) ? event.time : undefined
}

/** @param {any} content */
function messageText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part?.type === 'text' && typeof part.text === 'string') return part.text
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (content && typeof content.text === 'string') return content.text
  return ''
}

/** @param {any} content */
function toolNames(content) {
  if (!Array.isArray(content)) return []
  const names = []
  for (const part of content) {
    const name = part?.toolName ?? part?.name
    if ((part?.type === 'tool-call' || part?.type === 'tool_call') && typeof name === 'string') {
      names.push(name)
    }
  }
  return [...new Set(names)]
}

/**
 * 递归列出目录下的文件（相对路径），用于没有 `index.html` 的目录入口页。
 * @param {string} root
 * @param {string} dir
 * @param {Array<{name: string, size: number}>} [acc]
 * @returns {Array<{name: string, size: number}>}
 */
function walkFiles(root, dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(root, full, acc)
      continue
    }
    if (!entry.isFile()) continue
    acc.push({ name: relative(root, full).split(sep).join('/'), size: statSync(full).size })
  }
  return acc
}

/**
 * 从 Markdown 源里挑出图片引用（`![]()` 与 `<img src>`），去重保序。
 * 只取字符串、不解析 AST：后续的 exists()/HTTP 校验会把链接、正文里的同形文本过滤掉。
 * @param {string} markdown
 * @returns {string[]}
 */
function collectImageRefs(markdown) {
  const refs = []
  const add = (value) => {
    const ref = value.trim()
    if (ref === '' || ref.startsWith('data:') || refs.includes(ref)) return
    refs.push(ref)
  }
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)) add(match[1])
  for (const match of markdown.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) add(match[1])
  return refs
}

/**
 * 收集 `.md` 引用的本地图片，按「相对 md 的路径」返回 `{path: Buffer}`。
 *
 * 分享页在分享根目录，所以保持相对路径不变，`![](docs/a.png)` 就能直接加载，
 * 不需要改写正文。越界（`../`）、非文件、超过单次分享上限的一律静默跳过。
 *
 * @param {string} mdPath
 * @param {string} markdown
 * @returns {Record<string, Buffer>}
 */
function collectMarkdownAssets(mdPath, markdown) {
  const root = dirname(mdPath)
  const assets = {}
  let bytes = 0
  for (const ref of collectImageRefs(markdown)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) continue
    let local = ref.split('#')[0].split('?')[0]
    try {
      local = decodeURIComponent(local)
    } catch {
      /* 非法百分号编码：按原样找文件 */
    }
    const full = resolve(root, local)
    if (!full.startsWith(root + sep)) continue
    // 符号链接一律跳过：`startsWith` 只看得懂路径字符串，挡不住
    // `docs/leak -> ~/.ssh` 这种「路径在树内、文件在树外」的写法。
    let info
    try {
      info = lstatSync(full)
    } catch {
      continue
    }
    if (!info.isFile() || info.isSymbolicLink()) continue
    const real = realpathSync(full)
    if (!real.startsWith(root + sep)) continue
    const size = info.size
    if (size > LIMITS.maxBytes || bytes + size > LIMITS.maxBytes) continue
    bytes += size
    assets[relative(root, full).split(sep).join('/')] = readFileSync(real)
  }
  return assets
}

/**
 * 抓公网图片并转成 data URI（徽章大多是几百字节的 SVG）。
 * 抓不到的留在正文里保持原地址：页面还能显示，只是需要联网——比留个破图强。
 * @param {string} markdown
 * @returns {Promise<Map<string, string>>}
 */
async function fetchRemoteImages(markdown) {
  const urls = collectImageRefs(markdown)
    .filter((ref) => /^https?:\/\//i.test(ref))
    .slice(0, MARKDOWN_IMAGES.maxCount)
  const images = new Map()
  let total = 0
  for (let index = 0; index < urls.length; index += MARKDOWN_IMAGES.concurrency) {
    const batch = urls.slice(index, index + MARKDOWN_IMAGES.concurrency)
    const loaded = await Promise.all(batch.map((url) => fetchImage(url).catch(() => undefined)))
    for (const [offset, dataUri] of loaded.entries()) {
      if (dataUri === undefined) continue
      const size = Math.ceil((dataUri.length * 3) / 4)
      if (total + size > MARKDOWN_IMAGES.maxBytesTotal) continue
      total += size
      images.set(batch[offset], dataUri)
    }
  }
  return images
}

/**
 * 取一张公网图片，校验类型与体积后转成 data URI。
 * @param {string} url
 * @returns {Promise<string|undefined>}
 */
/** 内网 / 回环 / 链路本地地址：抓取一律拒绝（SSRF）。 */
function isPrivateAddress(address) {
  const ip = address.toLowerCase()
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true
  if (ip.startsWith('::ffff:')) return isPrivateAddress(ip.slice(7))
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  const [a, b] = parts
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

/**
 * 只允许抓公网图片：协议、主机名、**解析结果**三道都要过。
 *
 * 不做这一步，分享一个别人给的 README 就等于让 dsh 替他去访问内网
 * （实测 `http://127.0.0.1:7788/x.png` 会被抓下来内联进公开页）。
 * @param {string} url
 */
async function assertPublicImageUrl(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('只抓 http(s) 图片')
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(hostname)) throw new Error('不抓内网地址')
  if (isPrivateAddress(hostname)) throw new Error('不抓内网地址')
  if (/[a-z]/i.test(hostname)) {
    const addresses = await lookup(hostname, { all: true }).catch(() => [])
    if (addresses.length === 0) throw new Error('解析失败')
    if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('不抓内网地址')
  }
}

/**
 * 取一张公网图片，校验类型与体积后转成 data URI。
 *
 * 体积是**边读边数**的：先 `arrayBuffer()` 再判断等于让一张 500 MB 的图把内存吃满
 * 才说「太大了」。
 * @param {string} url
 * @returns {Promise<string|undefined>}
 */
async function fetchImage(url) {
  await assertPublicImageUrl(url)
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(MARKDOWN_IMAGES.timeoutMs) })
  if (!response.ok) return undefined
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!type.startsWith('image/')) return undefined
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declared) && declared > MARKDOWN_IMAGES.maxBytesEach) return undefined
  const chunks = []
  let total = 0
  for await (const chunk of response.body) {
    total += chunk.length
    if (total > MARKDOWN_IMAGES.maxBytesEach) return undefined
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  return `data:${type};base64,${buffer.toString('base64')}`
}

/**
 * 一条分享的对外 URL。Surge 把整个目录部署成域名根；隧道/局域网走 `/s/<id>/`。
 * @param {{provider?: string, origin: string, id: string, entry?: string}} entry
 * @returns {string}
 */
export function urlOf(entry) {
  const suffix =
    entry.entry === undefined || entry.entry === 'index.html' ? '' : encodeSharePath(entry.entry)
  return entry.provider === 'surge' ? `${entry.origin}/${suffix}` : `${entry.origin}/s/${entry.id}/${suffix}`
}

/**
 * 把分享内的相对路径编码成 URL（保留 `/` 分段）。
 *
 * 不编码就会坏在文件名上：`a#b.txt` 的链接里 `#` 之后全被当成 fragment（实测点开
 * 404），`?`、空格、中文同理。服务端 `#shareFile` 会解码回来。
 * @param {string} value
 * @returns {string}
 */
function encodeSharePath(value) {
  return String(value).split('/').map((segment) => encodeURIComponent(segment)).join('/')
}

/** 递归统计目录体积与文件数。 */
function measure(target, acc = { bytes: 0, files: 0 }) {
  const info = statSync(target)
  if (info.isDirectory()) {
    for (const entry of readdirSync(target)) measure(join(target, entry), acc)
    return acc
  }
  acc.bytes += info.size
  acc.files += 1
  return acc
}

/** 取本机局域网地址，作为隧道不可用时的降级出口。 */
export function lanAddress(port) {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && entry.internal === false) return `http://${entry.address}:${port}`
    }
  }
  return `http://127.0.0.1:${port}`
}

/** 带引导信息的分享错误：client 半按 `guide` 渲染"去登录 / 去配置"入口。 */
export class ShareError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {object} [guide]
   */
  constructor(code, message, guide) {
    super(message)
    this.name = 'ShareError'
    this.code = code
    this.guide = guide
  }
}

/**
 * 「自己装一个 cloudflared」的命令，按平台给。
 *
 * 插件本身会自动下载，这条只是给想跳过下载的人一个可粘贴的入口。**不要写死
 * `brew`**：Windows / Linux 用户拿到一条跑不通的命令，比不给更糟。没有公认
 * 包管理器的平台返回 `null`，由调用方退化成官方下载页链接。
 *
 * @param {string} [platform] 仅测试用，默认取 `process.platform`
 * @returns {string|null}
 */
export function installCommand(platform = process.platform) {
  if (platform === 'darwin') return 'brew install cloudflared'
  if (platform === 'win32') return 'winget install --id Cloudflare.cloudflared -e'
  return null
}

/** 各通道缺配置时的引导文案。链接都指向官方入口，命令可直接复制。 */
export const GUIDES = {
  surgeLogin: {
    code: 'surgeLogin',
    title: '需要先登录 Surge',
    body: 'Surge 用邮箱注册（免费），登录一次即可。本插件会复用本机的 Surge 登录状态。',
    href: 'https://surge.sh/',
    linkText: '打开 surge.sh 注册 / 登录',
    command: 'npm i -g surge && surge login',
  },
  surgeMissing: {
    code: 'surgeMissing',
    title: '没有找到 surge 命令',
    body: '本机没有装 Surge CLI。装好并登录后，分享会自动走你的账号。',
    href: 'https://surge.sh/',
    linkText: 'surge.sh',
    command: 'npm i -g surge',
  },
  surgeVerify: {
    code: 'surgeVerify',
    title: '需要先验证 Surge 邮箱',
    body: 'Surge 给这个账号发了验证邮件。点邮件里的链接，或在终端运行 surge verify 重新发送；验证后同一个域名就能打开。',
    href: 'https://surge.sh/',
    linkText: '打开 surge.sh',
    command: 'surge verify',
  },
  cfToken: {
    code: 'cfToken',
    title: '命名隧道缺少 token',
    body: '命名隧道是你在 Cloudflare 上自建的隧道：需要在 Zero Trust 里创建，把 connector token 填到这里，并把域名路由到本机端口。没有自有域名就没法用，改用 Surge 或快速隧道。',
    href: 'https://one.dash.cloudflare.com/',
    linkText: '打开 Cloudflare Zero Trust',
    command: null,
  },
  cfHostname: {
    code: 'cfHostname',
    title: '命名隧道缺少域名',
    body: '配置了 tunnelToken，但没有可访问的域名。命名隧道要在 Routes 里加一条 Published application（需要托管在 Cloudflare 的自有域名）并指向 localhost:3089；没有域名请改用 Surge 或快速隧道。',
    href: 'https://one.dash.cloudflare.com/',
    linkText: '打开 Cloudflare Zero Trust',
    command: null,
  },
  warming: {
    code: 'tunnel-warming',
    title: 'cloudflared 正在下载',
    body: '快速隧道第一次使用要先下载约 20 MB 的 cloudflared；下好之后再用就只需要一两秒。不想等可以改用 Surge（无需下载），或先在本机装好 cloudflared。',
    href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    linkText: '下载 cloudflared',
    command: installCommand(),
  },
  cfDownload: {
    code: 'cfDownload',
    title: 'cloudflared 不可用',
    body: '公网链接需要一个 cloudflared 可执行文件。可以自动下载，也可以自己装一个然后填 cloudflaredPath。',
    href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    linkText: '下载 cloudflared',
    command: installCommand(),
  },
}

/**
 * 本机是否有 Surge 的登录态。Surge 把凭据写在 `~/.netrc` 的 `machine surge.sh` 段。
 * @returns {boolean}
 */
function hasSurgeCredentials() {
  try {
    return readFileSync(join(homedir(), '.netrc'), 'utf8').includes('surge.sh')
  } catch {
    return false
  }
}

export class ShareManager {
  /**
   * @param {object} options
   * @param {any} options.ctx - host 上下文（用于 sessionQuery / sessions）。
   * @param {object} [options.config]
   */
  constructor({ ctx, config = {} }) {
    this.ctx = ctx
    this.config = config
    this.home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
    this.root = join(this.home, 'share-link')
    this.sharesDir = join(this.root, 'shares')
    this.indexFile = join(this.root, 'index.json')
    this.port = 0
    this.server = null
    this.tunnel = null
    this.tunnelOrigin = null
    this.tunnelStarting = null
    /**
     * cloudflared 下载状态：**只活在本进程里**。
     *
     * dsh 退出下载就停——不偷偷在后台拉 20 MB；代价是重启后要重下（一次性操作，
     * 换来的是没有常驻进程、没有状态文件、没有 pid 判定这些额外失败面）。
     */
    this.download = { state: 'idle', received: 0, total: 0, version: undefined }
    this.downloadTask = null
    /** 索引写操作的串行队列（见 `#serialize`）。 */
    this.publishQueue = Promise.resolve()
    this.serverError = undefined
  }

  // ---------------------------------------------------------------- lifecycle

  async start() {
    mkdirSync(this.sharesDir, { recursive: true })
    await this.#listen()
    this.sweep()
    this.#dropStaleQuickShares()
    // 装上就开始下：插件加载即下载，不等用户点分享；只下载，不连隧道。
    void this.warm()
  }

  async stop() {
    await this.#closeTunnel()
    await new Promise((done) => {
      if (this.server === null) return done()
      this.server.close(() => done())
      this.server = null
    })
  }

  #listen() {
    if (this.server !== null) return Promise.resolve()
    const namedCapable =
      this.config.defaultChannel === 'named' ||
      ((this.config.tunnelToken ?? '') !== '' && (this.config.tunnelHostname ?? '') !== '')
    const requested =
      Number.isInteger(this.config.port) && this.config.port > 0 ? this.config.port : namedCapable ? 3089 : 0
    return new Promise((resolvePromise, reject) => {
      const server = createServer((request, response) => this.#serve(request, response))
      server.on('error', (error) => {
        this.serverError = String(error?.message ?? error)
        reject(error)
      })
      server.listen(requested, '127.0.0.1', () => {
        this.server = server
        this.port = server.address().port
        this.serverError = undefined
        resolvePromise()
      })
    })
  }

  get origin() {
    return this.tunnelOrigin ?? lanAddress(this.port)
  }

  // ------------------------------------------------------------------- store

  #readIndex() {
    let text
    try {
      text = readFileSync(this.indexFile, 'utf8')
    } catch {
      return {}
    }
    try {
      const parsed = JSON.parse(text)
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (error) {
      // 损坏就**挪走备份并大声报**：静默返回 {} 会让「所有链接 404」看起来像
      // 用户自己撤销了，而下一次发布会把这个空索引写回去、把旧的都变成孤儿。
      const backup = `${this.indexFile}.corrupt-${Date.now()}`
      try {
        renameSync(this.indexFile, backup)
      } catch {
        /* 备份失败也不能让读路径抛错 */
      }
      this.ctx.logger?.warn?.(`[share-link] index.json 解析失败，已备份为 ${backup}：${String(error)}`)
      return {}
    }
  }

  /**
   * 索引写入：先写同目录临时文件再 `rename`。
   *
   * 直接覆盖写会在崩溃/断电时留下半截 JSON——下一次 `#readIndex()` 解析失败、
   * 返回 `{}`，于是**所有**链接 404，而紧接着的一次发布又会把这个空索引写回去，
   * 旧目录从此成为永久孤儿（实测踩过）。`rename` 在同一文件系统上是原子的。
   */
  #writeIndex(index) {
    const tmp = `${this.indexFile}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(index, null, 2))
    renameSync(tmp, this.indexFile)
  }

  /** 清掉过期条目与它们的目录。 */
  sweep() {
    const index = this.#readIndex()
    let dirty = false
    const now = Date.now()
    for (const [id, entry] of Object.entries(index)) {
      if (typeof entry.expiresAt === 'number' && entry.expiresAt <= now) {
        rmSync(join(this.sharesDir, id), { recursive: true, force: true })
        delete index[id]
        dirty = true
      }
    }
    if (dirty) this.#writeIndex(index)
  }

  /**
   * 清掉上一轮进程留下的「快速隧道」分享（连同快照）。
   *
   * 快速隧道的主机名是 Cloudflare 每次启动随机给的，进程一退就永不回来——
   * 这些条目留在索引里只会是死链，而且占着短码。命名隧道不受影响：域名
   * 固定、端口固定，重启后同一个地址照样有效；Surge 是静态托管，更不受影响。
   *
   * 唯一的例外是「快速隧道不可用、降级成局域网」的条目：只要这次监听的
   * 局域网地址与它记录的 origin 完全一致，它就还有可能活着，留着。
   *
   * @returns {number} 清掉的条数
   */
  #dropStaleQuickShares() {
    const index = this.#readIndex()
    const currentLan = lanAddress(this.port)
    let dropped = 0
    for (const [id, entry] of Object.entries(index)) {
      // 快速隧道：主机名每次启动都变，上一轮的一律作废。
      if (entry.channel === 'quick') {
        if (entry.provider === 'lan' && entry.origin === currentLan) continue
        rmSync(join(this.sharesDir, id), { recursive: true, force: true })
        delete index[id]
        dropped += 1
        continue
      }
      // 局域网条目（含「隧道降级成局域网」）：地址里带着**随机端口**，重启后端口
      // 变了这条链接就永久打不开，留着只会在列表里冒充可用链接（实测 58831→58856）。
      if (entry.provider === 'lan' && entry.origin !== currentLan) {
        rmSync(join(this.sharesDir, id), { recursive: true, force: true })
        delete index[id]
        dropped += 1
      }
    }
    if (dropped > 0) {
      this.#writeIndex(index)
      this.ctx.logger?.debug?.(`[share-link] 清理了 ${dropped} 条上一轮进程留下的临时分享`)
    }
    return dropped
  }

  /**
   * 把通道 id 解析成发布时需要的形态。
   * @param {string} [id] quick | surge | named | lan；省略时用默认通道
   */
  resolveChannel(id) {
    const requested = id ?? this.config.defaultChannel ?? 'quick'
    switch (requested) {
      case 'surge':
        return { id: 'surge', provider: 'surge' }
      case 'lan':
        return { id: 'lan', provider: 'lan' }
      case 'named':
        return { id: 'named', provider: 'tunnel', tunnelMode: 'named' }
      default:
        return { id: 'quick', provider: 'tunnel', tunnelMode: 'quick' }
    }
  }

  /**
   * 设置卡里的样式预览：用同一套渲染器出一页样例（不写盘、不发布）。
   * @param {{theme?: string, customCss?: string}} [options]
   * @returns {string}
   */
  previewPage(options = {}) {
    return renderSessionPage({
      title: '分享页样式预览',
      sessionId: 'session-预览',
      createdAt: Date.now(),
      theme: options.theme ?? this.config.pageTheme,
      customCss: options.customCss ?? this.config.pageThemeCss,
      messages: [
        { role: 'user', text: '这段对话会被发布成一个只读链接，对方不用装 dsh 也能看。' },
        {
          role: 'assistant',
          text: '好的。\n\n风格可以随时换，正文与代码块都会跟着变：\n\n```js\nconst share = await createSessionShare(id)\n```\n\n- 链接可撤销\n- 快照默认脱敏',
        },
      ],
    })
  }

  /**
   * 通道就绪情况：client 半在打开分享框时就查这个，未就绪直接给引导，而不是等失败。
   * @returns {Promise<{default: string, channels: object, provider: string, ready: boolean, guide?: object, detail: string, install: string|null}>}
   */
  async status() {
    const channels = {}
    const surge = await this.#surgeStatus()
    channels.surge = surge
    // 磁盘/PATH 上已经有 cloudflared 时，状态就该显示「已就绪」，而不是「首次要下载」。
    if (this.download.state === 'idle') {
      const cached = this.#cachedCloudflared()
      if (cached !== undefined) this.download = { state: 'ready', received: 1, total: 1, path: cached }
    }
    const download = this.downloadInfo()
    const tunnelReady = this.tunnelOrigin !== null
    channels.quick = {
      ready: true,
      download,
      tunnel: tunnelReady ? 'ready' : this.tunnelStarting === null ? 'idle' : 'connecting',
      detail: tunnelReady
        ? '隧道已连上，发布只需一瞬间'
        : download.state === 'downloading'
          ? `正在下载 cloudflared ${download.percent}%（${formatMb(download.received)} / ${formatMb(download.total)}）`
          : download.state === 'failed'
            ? `cloudflared 下载失败：${download.error ?? '未知原因'}`
            : download.state === 'ready'
              ? 'cloudflared 已就绪，首次发布约 2–5 秒（正在连隧道）'
              : `首次分享会自动下载 cloudflared（约 ${formatMb(20 * 1024 * 1024)}）`,
    }
    channels.lan = { ready: true, detail: '仅同一局域网可访问' }
    const namedReady =
      (this.config.tunnelToken ?? '') !== '' && (this.config.tunnelHostname ?? '') !== ''
    channels.named = namedReady
      ? { ready: true, detail: `命名隧道 ${this.config.tunnelHostname}` }
      : (this.config.tunnelToken ?? '') === ''
        ? { ready: false, guide: GUIDES.cfToken, detail: '缺隧道 token' }
        : { ready: false, guide: GUIDES.cfHostname, detail: '缺对外域名' }

    const current = this.resolveChannel()
    const active = channels[current.id] ?? { ready: false, detail: '' }
    // 监听失败时 UI 不能继续说「可以分享」：否则用户点发布才炸，还看不懂为什么。
    const down = this.server === null
    return {
      default: current.id,
      channels,
      provider: current.provider,
      server: down ? 'down' : 'up',
      ready: down ? false : active.ready,
      via: active.via,
      detail: down ? `分享服务未启动：${this.serverError ?? '未知原因'}` : active.detail,
      guide: active.guide,
      // 「自己装一个」的命令随平台变（macOS / Windows / Linux 各不相同），由宿主决定，
      // 客户端只负责渲染——不要在设置卡里写死 `brew`。
      install: installCommand(),
    }
  }

  /** cloudflared 的当前状态（内存快照；下载随本进程生命周期）。 */
  downloadInfo() {
    const cached = this.#cachedCloudflared()
    if (cached !== undefined) {
      return { state: 'ready', received: 1, total: 1, percent: 100, path: cached, version: this.download.version }
    }
    const { state, received, total, error } = this.download
    const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0
    return { state, received, total, percent, error, version: this.download.version }
  }

  /**
   * 开始下载 cloudflared（后台、幂等）。
   *
   * 跑在插件进程里：dsh 退出它就停，不会背着你把 20 MB 下完。代价是重启后要重下，
   * 但这是一次性操作——用「下载进程 + 状态文件 + pid 判定」换这一点并不划算。
   * @returns {ReturnType<ShareManager['downloadInfo']>}
   */
  warm() {
    const cached = this.#cachedCloudflared()
    if (cached !== undefined) {
      this.download = { state: 'ready', received: 1, total: 1, path: cached, version: this.download.version }
      return this.downloadInfo()
    }
    if (this.downloadTask !== null) return this.downloadInfo()

    this.download = { state: 'downloading', received: 0, total: 0, version: this.download.version }
    this.downloadTask = downloadCloudflared(join(this.root, 'bin'), (progress) => {
      this.download = {
        state: 'downloading',
        received: progress.received,
        total: progress.total,
        version: this.download.version,
      }
    })
      .then(async (path) => {
        // 下载源是我们自己找的（GitHub + 第三方代理），没有签名就没有真实性保证。
        // 想收紧的话在设置里填 `cloudflaredSha256`：不匹配就地删掉，绝不留着一个
        // 「看着像 cloudflared」的可执行文件。
        const expected = String(this.config.cloudflaredSha256 ?? '').trim().toLowerCase()
        if (/^[0-9a-f]{64}$/.test(expected)) {
          const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
          if (actual !== expected) {
            rmSync(path, { force: true })
            throw new Error(`cloudflared 校验失败：期望 ${expected.slice(0, 12)}…，实际 ${actual.slice(0, 12)}…`)
          }
        }
        const version = await probeVersion(path)
        this.download = { state: 'ready', received: 1, total: 1, path, version }
        return path
      })
      .catch((error) => {
        this.download = {
          state: 'failed',
          received: 0,
          total: 0,
          error: String(error?.message ?? error),
          version: this.download.version,
        }
        this.ctx.logger?.warn?.(`[share-link] cloudflared 下载失败：${String(error)}`)
      })
      .finally(() => {
        this.downloadTask = null
      })
    return this.downloadInfo()
  }

  /**
   * 设置页的「检查」：确认 cloudflared 在不在、跑不跑得起来、什么版本。
   *
   * 缺了/失败了就顺手再下一次（手动重试的入口）。
   * @returns {Promise<ReturnType<ShareManager['downloadInfo']>>}
   */
  async check() {
    const current = this.downloadInfo()
    if (current.state === 'ready' && typeof current.path === 'string') {
      this.download = { ...this.download, version: await probeVersion(current.path) }
      return this.downloadInfo()
    }
    if (this.downloadTask === null) this.warm()
    return this.downloadInfo()
  }

  /** 已经可用的 cloudflared：显式配置 > 缓存 > PATH。 */
  #cachedCloudflared() {
    const explicit = this.config.cloudflaredPath
    if (typeof explicit === 'string' && explicit !== '') {
      // 配置里写错一个字母，`spawn` 会发 ENOENT；没人监听 'error' 就是整个进程退出。
      // 所以这里先认文件，认不出来就退回自动查找/下载，而不是硬塞给 spawn。
      try {
        if (statSync(explicit).isFile()) return explicit
        this.ctx.logger?.warn?.(`[share-link] cloudflaredPath 不是文件：${explicit}（回退到自动查找）`)
      } catch {
        this.ctx.logger?.warn?.(`[share-link] cloudflaredPath 不存在：${explicit}（回退到自动查找）`)
      }
    }
    const cached = join(this.root, 'bin', BINARY_NAME)
    if (existsSync(cached)) return cached
    return findOnPath('cloudflared')
  }

  /**
   * 取一个能用的 cloudflared。**不同步等下载**：缺了就起下载并立刻把进度交出去
   * （`tunnel-warming`），要不要等是用户点「检查」的事。
   * @returns {Promise<string>}
   */
  async #cloudflaredBinary() {
    const cached = this.#cachedCloudflared()
    if (cached !== undefined) return cached
    const state = this.warm()
    if (state.state === 'failed') {
      throw new ShareError('cf-download', `cloudflared 下载失败：${state.error ?? '未知原因'}`, GUIDES.cfDownload)
    }
    throw new ShareError(
      'tunnel-warming',
      `cloudflared 还在下载（${state.percent}%，${formatMb(state.received)} / ${formatMb(state.total)}）`,
      GUIDES.warming,
    )
  }

  async #surgeStatus() {
    const binary = findOnPath('surge')
    if (binary === undefined) {
      return { ready: false, guide: GUIDES.surgeMissing, detail: '没有 surge 可执行文件' }
    }
    // 三种登录态都算：配置里的 token、进程环境里的 SURGE_TOKEN、本机 ~/.netrc。
    const via =
      typeof this.config.surgeToken === 'string' && this.config.surgeToken !== ''
        ? 'config-token'
        : (process.env.SURGE_TOKEN ?? '') !== ''
          ? 'env-token'
          : hasSurgeCredentials()
            ? 'netrc'
            : undefined
    return via === undefined
      ? { ready: false, guide: GUIDES.surgeLogin, detail: 'surge 未登录' }
      : { ready: true, via, detail: via === 'netrc' ? 'surge 本机已登录' : 'surge 已配置 token' }
  }

  list() {
    this.sweep()
    return Object.values(this.#readIndex())
      .map((entry) => ({ ...entry, url: urlOf(entry) }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async revoke(id) {
    return this.#serialize(() => this.#revokeNow(id))
  }

  /** @param {string} id */
  async #revokeNow(id) {
    const index = this.#readIndex()
    if (index[id] === undefined) return false
    const entry = index[id]
    if (entry.provider === 'surge' && entry.domain !== undefined) {
      await runTool('surge', ['teardown', entry.domain], this.#toolEnv()).catch(() => {
        /* 云端 demolish 失败不阻止本地撤销：本地删掉后至少新部署不再指向这里 */
      })
    }
    rmSync(join(this.sharesDir, id), { recursive: true, force: true })
    delete index[id]
    this.#writeIndex(index)
    return true
  }

  // ------------------------------------------------------------------ create

  /**
   * 分享当前会话的快照。
   * @param {string} sessionId
   * @param {{includeToolCalls?: boolean, ttlHours?: number, title?: string}} [options]
   */
  async createSessionShare(sessionId, options = {}) {
    if (typeof sessionId !== 'string' || sessionId === '') throw new Error('createSessionShare 需要 sessionId')
    const { header, messages } = await this.#readTranscript(sessionId, options)
    const safeMessages = messages.map((message) => ({ ...message, text: redact(message.text) }))

    let title = options.title
    if (title === undefined) title = await this.#readTitle(sessionId)
    if (title === undefined || title === '') title = `会话 ${sessionId.slice(0, 8)}`

    const createdAt = Date.now()
    const html = renderSessionPage({
      title,
      sessionId,
      createdAt,
      messages: safeMessages,
      theme: this.config.pageTheme,
      customCss: this.config.pageThemeCss,
    })
    return this.#publish({
      kind: 'session',
      title,
      body: { 'index.html': html },
      channel: options.channel,
      ttlHours: options.ttlHours,
      files: messages.length,
      generated: true,
    })
  }

  /**
   * 分享一个本地文件或目录（产物：HTML / Markdown / PPT / 截图…）。
   * @param {string} path - 绝对路径或相对 cwd 的路径。
   * @param {{title?: string, ttlHours?: number, cwd?: string}} [options]
   */
  async createPathShare(path, options = {}) {
    const target = resolve(options.cwd ?? process.cwd(), path)
    if (!existsSync(target)) throw new Error(`路径不存在：${target}`)
    // 分享目录自己（或任何包含它的祖先）不能当分享源：`cpSync` 会把它拷进
    // `shares/<id>/` 里，形成「自己拷自己」的递归，或者在磁盘上炸出一棵树。
    const storeReal = realpathSync(this.root)
    const targetReal = realpathSync(target)
    if (
      storeReal === targetReal ||
      targetReal.startsWith(storeReal + sep) ||
      storeReal.startsWith(targetReal + sep)
    ) {
      throw new Error('不能分享 dsh 自己的分享目录（或包含它的目录）')
    }
    const info = statSync(target)
    const size = measure(target)
    if (size.bytes > LIMITS.maxBytes) throw new Error(`超过 ${LIMITS.maxBytes} 字节上限：${size.bytes}`)
    if (size.files > LIMITS.maxFiles) throw new Error(`超过 ${LIMITS.maxFiles} 个文件上限：${size.files}`)

    const body = {}
    let entry = 'index.html'
    // generated = 这一页是**我们自己渲染**的：只有这种页面才允许套 CSP
    // （用户自己的 .html 产物需要它自己的脚本能跑）。
    let generated = false
    if (info.isDirectory()) {
      body[''] = target
      if (!existsSync(join(target, 'index.html'))) {
        const entries = walkFiles(target, target)
          .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        body['index.html'] = renderDirectoryIndex({
          title: target.split(sep).at(-1) ?? 'files',
          entries,
          theme: this.config.pageTheme,
          customCss: this.config.pageThemeCss,
        })
        generated = true
      }
    } else if (/\.html?$/i.test(target)) {
      body['index.html'] = readFileSync(target, 'utf8')
    } else if (/\.md$/i.test(target)) {
      generated = true
      const name = target.split(sep).at(-1) ?? 'document'
      const markdown = readFileSync(target, 'utf8')
      // 相对图片（`![](docs/a.png)`）按 md 所在目录解析后一起发布：只拷同目录树内的
      // 文件，`..` 越界一律忽略；公网图片（徽章）发布时抓下来内联成 data URI。
      Object.assign(body, collectMarkdownAssets(target, markdown))
      body['index.html'] = renderMarkdownDocument({
        title: name.replace(/\.md$/i, ''),
        markdown,
        theme: this.config.pageTheme,
        customCss: this.config.pageThemeCss,
        images: await fetchRemoteImages(markdown),
      })
    } else {
      const name = target.split(sep).at(-1) ?? 'file'
      body[name] = readFileSync(target)
      entry = name
    }

    const title = options.title ?? (info.isDirectory() ? target.split(sep).at(-1) : target.split(sep).at(-1))
    return this.#publish({
      kind: 'path',
      title,
      body,
      channel: options.channel,
      ttlHours: options.ttlHours,
      entry,
      source: target,
      files: size.files,
      generated,
    })
  }

  /**
   * 读取一个会话的完整消息序列。
   *
   * 走持久化读句柄而不是 sessionQuery：后者的可见性按 workspace 收窄，
   * 而分享是「按 id 取这一份日志」，不该被索引状态挡住。surface 折叠交给
   * 官方 `foldSurface`，压过缩（replacement）等语义与 GUI 保持一致。
   */
  async #readTranscript(sessionId, options = {}) {
    const sessions = this.ctx.get('sessions')
    const live = sessions?.get?.(sessionId)
    if (live !== undefined) await sessions.flush(live)

    try {
      const surface = await this.ctx.sessionQuery.readSurface(sessionId)
      const projected = projectSurface(surface.events ?? [], options)
      if (projected.length > 0) return { header: surface.session, messages: projected }
    } catch {
      /* 索引不可见时走持久化读句柄 */
    }

    const persistence = this.ctx.get('sessionPersistence')
    if (persistence === undefined) throw new Error('宿主未挂载 sessionPersistence，无法读取会话')
    const handle = await persistence.open(sessionId, 'read')
    try {
      const { events } = await handle.read(0, undefined)
      const folded = foldSurface(events)
      const messages = []
      for (const seq of folded.nodes) {
        const message = folded.projectedMessages.get(seq)
        if (message === undefined) continue
        const role = message.role
        if (role !== 'user' && role !== 'assistant') continue
        const text = messageText(message.content)
        const tools = role === 'assistant' && options.includeToolCalls === true ? toolNames(message.content) : []
        if (text.trim() === '' && tools.length === 0) continue
        messages.push({ role, text: text.trim() === '' ? '（本步只有工具调用）' : text, tools })
      }
      return { header: handle.header, messages }
    } finally {
      await handle.close()
    }
  }

  async #readTitle(sessionId) {
    try {
      const snapshot = await this.ctx.sessionQuery?.readTitle?.(sessionId)
      const title = snapshot?.title ?? snapshot?.value
      return typeof title === 'string' && title !== '' ? title : undefined
    } catch {
      return undefined
    }
  }

  /**
   * 串行化「读索引 → 改 → 写索引」。
   *
   * 两个发布同时跑会各自读到同一份索引、再各自写回，后写的把先写的那条**静默
   * 吃掉**（目录还在，索引里没了 = 永久孤儿）。包装一层比给索引加锁简单。
   * @template T
   * @param {() => Promise<T>} task
   * @returns {Promise<T>}
   */
  #serialize(task) {
    const next = this.publishQueue.then(task, task)
    this.publishQueue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /**
   * @param {{kind: string, title: string, body: Record<string, string|Buffer>, ttlHours?: number, entry?: string, source?: string, files?: number, generated?: boolean}} input
   */
  #publish(input) {
    return this.#serialize(() => this.#publishNow(input))
  }

  /** @param {Parameters<ShareManager['#publish']>[0]} input */
  async #publishNow(input) {
    const { id, dir } = this.#allocateShareDir()
    let committed = false
    try {
      for (const [name, content] of Object.entries(input.body)) {
        if (name === '') {
          const source = /** @type {string} */ (content)
          let skipped = 0
          cpSync(source, dir, {
            recursive: true,
            // 符号链接不拷：路径在树内、目标在树外（`docs/leak -> ~/.ssh/id_rsa`），
            // 拷过去等于把树外文件也发布出去（实测能读到 /etc/hosts）。
            filter: (from) => {
              if (from === source) return true
              try {
                if (lstatSync(from).isSymbolicLink()) {
                  skipped += 1
                  return false
                }
                return true
              } catch {
                return false
              }
            },
          })
          if (skipped > 0) {
            this.ctx.logger?.warn?.(`[share-link] 跳过了 ${skipped} 个符号链接（避免分享到目录树之外）`)
          }
          continue
        }
        const file = join(dir, name)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, /** @type {string|Buffer} */ (content))
      }

      const requestedTtl =
        Number.isFinite(input.ttlHours) && input.ttlHours > 0
          ? input.ttlHours
          : Number.isFinite(this.config.ttlHours) && this.config.ttlHours > 0
            ? this.config.ttlHours
            : TTL_HOURS.default
      // schema 的 min/max 只挡设置页；HTTP 路由与 agent 工具是另一条路，必须同一套边界。
      const ttlHours = Math.min(TTL_HOURS.max, Math.max(TTL_HOURS.min, requestedTtl))

      const channel = this.resolveChannel(input.channel)
      let origin
      let provider
      let domain
      let degraded = false
      let degradedReason
      if (channel.provider === 'surge') {
        // slug 用**完整短码**：契约里预留的 8 位切片在 idLength > 8 时会让两条
        // 分享抢同一个 Surge 子域（后部署的静默覆盖前者），所以直接用整个 id。
        const deployed = await this.#deploySurge(dir, `${this.config.surgePrefix ?? 'dsh-share'}-${id}`)
        origin = deployed.url
        domain = deployed.domain
        provider = 'surge'
      } else if (channel.provider === 'lan') {
        await this.#listen()
        origin = lanAddress(this.port)
        provider = 'lan'
      } else {
        await this.#ensureOrigin(channel.tunnelMode)
        origin = this.origin
        provider = this.tunnelOrigin === null ? 'lan' : 'tunnel'
        if (provider === 'lan' && this.degradedReason !== undefined) {
          degraded = true
          degradedReason = this.degradedReason
        }
      }

      const createdAt = Date.now()
      const entry = {
        id,
        kind: input.kind,
        title: input.title,
        createdAt,
        expiresAt: createdAt + ttlHours * 3600 * 1000,
        provider,
        channel: channel.id,
        domain,
        origin,
        degraded: degraded || undefined,
        degradedReason,
        entry: input.entry ?? 'index.html',
        source: input.source,
        files: input.files ?? 1,
        generated: input.generated === true ? true : undefined,
      }
      const index = this.#readIndex()
      index[id] = entry
      this.#writeIndex(index)
      committed = true
      return { ...entry, url: urlOf(entry) }
    } finally {
      // 发布失败（Surge 未登录 / 隧道拒绝）就把刚落的目录收回去：它不在 index 里，
      // `sweep()` 清不到，留着等于永久占住一个短码。
      if (!committed) rmSync(dir, { recursive: true, force: true })
    }
  }

  /**
   * 分配一条分享的短码与目录。
   *
   * **目录创建成功 = 拿到这个 id**：非递归 `mkdir` 的 `EEXIST` 是文件系统给出的
   * 原子判定，比「先查 index 再创建」可靠——索引与磁盘本来就可能不一致
   * （`sweep` / `revoke` 各删一边），而并发发布也不会撞。撞了就重摇。
   *
   * @returns {{id: string, dir: string}}
   */
  #allocateShareDir() {
    const length = normalizeCodeLength(this.config.idLength)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = shortCode(length)
      const dir = join(this.sharesDir, id)
      try {
        mkdirSync(dir)
        return { id, dir }
      } catch (error) {
        if (/** @type {any} */ (error)?.code !== 'EEXIST') throw error
        this.ctx.logger?.warn?.(`[share-link] 短码 ${id} 已被占用，重摇`)
      }
    }
    throw new Error('无法分配分享短码：连续 8 次与已有目录冲突')
  }

  /** 外部发布工具的进程环境（Surge token 从配置注入，不落盘）。 */
  #toolEnv() {
    const env = { ...process.env }
    if (typeof this.config.surgeLogin === 'string' && this.config.surgeLogin !== '') {
      env.SURGE_LOGIN = this.config.surgeLogin
    }
    if (typeof this.config.surgeToken === 'string' && this.config.surgeToken !== '') {
      env.SURGE_TOKEN = this.config.surgeToken
    }
    return env
  }

  /**
   * 把已落盘的分享目录发到 Surge（持久链接，`surge teardown <domain>` 可撤销）。
   * @param {string} dir
   * @param {string} slug
   */
  async #deploySurge(dir, slug) {
    const domain =
      typeof this.config.surgeDomain === 'string' && this.config.surgeDomain !== ''
        ? `${slug}.${this.config.surgeDomain}`
        : `${slug}.surge.sh`
    let output = ''
    try {
      output = await runTool('surge', [dir, domain], this.#toolEnv())
      // Surge 会在"部署成功但域名待验证"时也返回 0——必须读输出，否则用户拿到一个 403 链接。
      if (/email verification|surge verify/i.test(output)) {
        throw new ShareError('surge-verify', 'Surge 要求先验证邮箱，链接现在打不开（403）', GUIDES.surgeVerify)
      }
    } catch (error) {
      if (error instanceof ShareError) throw error
      const text = String(error?.message ?? error)
      if (/not logged in|login required|unauthor|forbidden|401|403/i.test(text)) {
        throw new ShareError('surge-login', `Surge 没有登录：${text}`, GUIDES.surgeLogin)
      }
      if (/ENOENT|not found/i.test(text)) {
        throw new ShareError('surge-missing', `找不到 surge 命令：${text}`, GUIDES.surgeMissing)
      }
      throw new ShareError('surge-failed', text, GUIDES.surgeLogin)
    }
    return { domain, url: `https://${domain}` }
  }

  // ------------------------------------------------------------------ tunnel

  async #ensureOrigin(mode = 'quick') {
    if (this.tunnelOrigin !== null && this.tunnelMode === mode) return this.tunnelOrigin
    // 换模式（quick ↔ named）必须重起 cloudflared：两者的启动参数与域名来源不同。
    if (this.tunnelOrigin !== null && this.tunnelMode !== mode) await this.#closeTunnel()
    if (this.tunnelStarting !== null) return await this.tunnelStarting
    this.tunnelStarting = this.#startTunnel(mode).finally(() => {
      this.tunnelStarting = null
    })
    await this.tunnelStarting
    return this.tunnelOrigin
  }

  async #startTunnel(mode = 'quick') {
    if (mode === 'named') {
      const token = this.config.tunnelToken
      if (typeof token !== 'string' || token === '') throw new Error('命名隧道缺少 token')
      return await this.#startNamedTunnel(token)
    }
    let binary
    try {
      binary = await this.#cloudflaredBinary()
    } catch (error) {
      // 「还在下载」是正常的不耐烦场景，必须把进度交出去；其它错误才降级成局域网。
      if (error instanceof ShareError) throw error
      this.ctx.logger?.warn?.(`[share-link] cloudflared 不可用，降级为局域网链接：${String(error)}`)
      return
    }
    const child = spawn(binary, ['tunnel', '--url', `http://127.0.0.1:${this.port}`, '--no-autoupdate'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.tunnel = child
    const origin = await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error('cloudflared 30s 内没有给出公网地址')), 30_000)
      // 没有 'error' 监听，`spawn` 失败（ENOENT/EACCES）会变成 uncaughtException，
      // 直接带走整个 dsh 进程——实测过。
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      const onData = (chunk) => {
        const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
        if (match === null) return
        clearTimeout(timer)
        resolvePromise(match[0])
      }
      child.stdout.on('data', onData)
      child.stderr.on('data', onData)
      child.on('exit', (code) => {
        clearTimeout(timer)
        reject(new Error(`cloudflared 退出（code ${code}）`))
      })
    }).catch((error) => {
      child.kill('SIGTERM')
      this.tunnel = null
      this.degradedReason = String(error?.message ?? error)
      this.ctx.logger?.warn?.(`[share-link] 隧道启动失败，降级为局域网链接：${String(error)}`)
      return null
    })
    this.tunnelOrigin = origin
    this.tunnelMode = mode
    // 快速隧道会自己掉线：掉了就把状态清空，下一次分享自动重起，而不是继续发一个死链接。
    child.on('exit', () => {
      if (this.tunnel !== child) return
      this.tunnel = null
      this.tunnelOrigin = null
      this.tunnelMode = null
    })
    return origin
  }

  /**
   * 命名隧道：地址固定（`https://<tunnelHostname>`），因此分享服务端口也必须固定。
   * @param {string} token
   */
  async #startNamedTunnel(token) {
    const hostname = this.config.tunnelHostname
    if (typeof hostname !== 'string' || hostname === '') {
      throw new Error('配置了 tunnelToken 但缺少 tunnelHostname：请填写你在 Cloudflare 上绑定的域名')
    }
    const binary = await this.#cloudflaredBinary()
    const child = spawn(binary, ['tunnel', '--no-autoupdate', 'run', '--token', token], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.tunnel = child
    // 等 cloudflared 真的注册到 edge（输出里出现 Registered tunnel connection），
    // 不是睡一个固定的 2.5 s：等短了会把一个还没连上的隧道当成就绪。
    await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error('cloudflared 30s 内没有连上 Cloudflare')), 30_000)
      const settle = (error) => {
        clearTimeout(timer)
        child.stdout.destroy()
        child.stderr.destroy()
        if (error === undefined) resolvePromise()
        else reject(error)
      }
      const watch = (chunk) => {
        if (/Registered tunnel connection|Connection .*registered/i.test(String(chunk))) settle()
      }
      child.on('error', (error) => settle(error))
      child.on('exit', (code) => settle(new Error(`cloudflared 退出（code ${code}）：token 无效，或该隧道没有指向本机端口`)))
      child.stdout.on('data', watch)
      child.stderr.on('data', watch)
    }).catch((error) => {
      child.kill('SIGTERM')
      this.tunnel = null
      throw error
    })
    this.tunnelOrigin = `https://${hostname}`
    this.tunnelMode = 'named'
    // 命名隧道的地址是固定的，进程掉了必须把状态清掉，否则会继续发一个死链接。
    child.on('exit', () => {
      if (this.tunnel !== child) return
      this.tunnel = null
      this.tunnelOrigin = null
      this.tunnelMode = null
      this.ctx.logger?.warn?.('[share-link] 命名隧道已断开，下次分享会重连')
    })
    return this.tunnelOrigin
  }

  async #closeTunnel() {
    const child = this.tunnel
    this.tunnel = null
    this.tunnelOrigin = null
    if (child === null) return
    child.kill('SIGTERM')
  }

  // ------------------------------------------------------------------ serving

  /** 分享服务的响应头基线：不缓存、不索引、不嗅探。 */
  static BASE_HEADERS = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'no-referrer',
  }

  /**
   * 分享服务的唯一入口。
   *
   * **任何异常都只影响这一个请求**：`createServer` 的回调里抛错没有地方接，
   * Node 会当成 uncaughtException 直接退出进程——实测一个 `chmod 000` 的分享
   * 文件就能把整个 dsh 打死。所以这里兜底、并在响应里降级。
   */
  #serve(request, response) {
    try {
      this.#route(request, response)
    } catch (error) {
      this.ctx.logger?.warn?.(`[share-link] 处理 ${request.url} 失败：${String(error)}`)
      if (response.headersSent) response.destroy()
      else this.#send(response, 500, 'internal error')
    }
  }

  /** @param {import('node:http').ServerResponse} response */
  #send(response, status, body, headers = {}) {
    response.writeHead(status, { ...ShareManager.BASE_HEADERS, ...headers })
    response.end(body)
  }

  #route(request, response) {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return this.#send(response, 405, 'method not allowed', { allow: 'GET, HEAD' })
    }
    if (url.pathname === '/healthz') return this.#send(response, 200, 'ok')

    // 短码是小写 base36；长度上限 32 是为了**兼容改造前的 32 位 hex 链接**——
    // 老 id 是 `[a-f0-9]{32}`，落在新字符集里，已经发出去的地址继续有效。
    const match = url.pathname.match(/^\/s\/([0-9a-z]{8,32})(\/.*)?$/)
    if (match === null) return this.#send(response, 404, 'not found')

    const [, id, rest = '/'] = match
    const entry = this.#readIndex()[id]
    if (entry === undefined) return this.#send(response, 404, 'not found')
    // 到期即 404，不以 sweep 是否跑过为准：长期运行的进程可能一直没调 list()，
    // 惰性清理会让「已过期」的链接继续可读。磁盘上的清理仍交给 sweep()。
    if (typeof entry.expiresAt === 'number' && entry.expiresAt <= Date.now()) {
      return this.#send(response, 404, 'not found')
    }

    const file = this.#shareFile(id, rest)
    if (file === null) return this.#send(response, 404, 'not found')
    let info
    try {
      info = statSync(file)
    } catch {
      return this.#send(response, 404, 'not found')
    }
    if (!info.isFile()) return this.#send(response, 404, 'not found')
    return this.#sendFile(request, response, file, info, entry)
  }

  /**
   * 把请求路径解析成分享目录里的**真实**文件，越界一律 `null`。
   *
   * 三层：解码（不做这一步，中文 / 空格 / `#` 文件名全部 404——实测）、
   * 字符串前缀（挡 `../`）、`realpath` 前缀（挡符号链接逃逸）。
   * @param {string} id
   * @param {string} rest 形如 `/` 或 `/docs/a.png`
   * @returns {string|null}
   */
  #shareFile(id, rest) {
    const base = join(this.sharesDir, id)
    const relative = rest === '/' ? 'index.html' : rest.replace(/^\/+/, '')
    if (relative === '') return null
    let decoded
    try {
      decoded = decodeURIComponent(relative)
    } catch {
      return null
    }
    if (decoded.includes('\0')) return null
    const file = resolve(base, decoded)
    if (file !== base && !file.startsWith(base + sep)) return null
    try {
      const realBase = realpathSync(base)
      const real = realpathSync(file)
      if (real !== realBase && !real.startsWith(realBase + sep)) return null
      return real
    } catch {
      return null
    }
  }

  /** @param {string|undefined} header @param {number} size */
  #parseRange(header, size) {
    if (typeof header !== 'string' || header.trim() === '') return undefined
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
    if (match === null) return undefined
    const [, rawStart, rawEnd] = match
    if (rawStart === '' && rawEnd === '') return 'invalid'
    let start
    let end
    if (rawStart === '') {
      const suffix = Number(rawEnd)
      if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid'
      start = Math.max(0, size - suffix)
      end = size - 1
    } else {
      start = Number(rawStart)
      end = rawEnd === '' ? size - 1 : Number(rawEnd)
    }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'invalid'
    return { start, end: Math.min(end, size - 1) }
  }

  /**
   * 流式发文件：不把整份读进内存（100 MB 分享 × 并发请求会把堆吃光），
   * 支持 Range（PDF / 视频可拖动），HEAD 只回头。
   */
  #sendFile(request, response, file, info, entry) {
    const headers = { 'content-type': mimeOf(file), 'accept-ranges': 'bytes' }
    // 只给**我们渲染的**页面套 CSP：用户自己的 .html 产物要靠它自己的脚本跑。
    if (entry.generated === true) headers['content-security-policy'] = PAGE_CSP

    const range = this.#parseRange(request.headers.range, info.size)
    if (range === 'invalid') {
      return this.#send(response, 416, 'range not satisfiable', { 'content-range': `bytes */${info.size}` })
    }
    if (info.size === 0) {
      // 空文件没有 `end = size - 1` 可言，直接回空体，别把 start:0/end:-1 交给流。
      response.writeHead(200, { ...ShareManager.BASE_HEADERS, ...headers, 'content-length': '0' })
      return response.end()
    }
    const start = range === undefined ? 0 : range.start
    const end = range === undefined ? info.size - 1 : range.end
    headers['content-length'] = String(Math.max(0, end - start + 1))
    if (range !== undefined) headers['content-range'] = `bytes ${start}-${end}/${info.size}`
    const status = range === undefined ? 200 : 206

    const stream = createReadStream(file, range === undefined ? undefined : { start, end })
    stream.once('error', (error) => {
      this.ctx.logger?.warn?.(`[share-link] 读取 ${file} 失败：${String(error)}`)
      if (response.headersSent) response.destroy()
      else this.#send(response, 404, 'not found')
    })
    stream.once('open', () => {
      response.writeHead(status, { ...ShareManager.BASE_HEADERS, ...headers })
      if (request.method === 'HEAD') {
        stream.destroy()
        response.end()
        return
      }
      stream.pipe(response)
    })
  }
}

/**
 * 运行一个外部发布工具：优先用 PATH 上的同名可执行文件，否则退回 `npx --yes <name>`。
 * @param {string} name
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<string>} 合并后的 stdout + stderr。
 */
export function runTool(name, args, env, timeoutMs = 180_000) {
  const binary = findOnPath(name)
  return new Promise((resolvePromise, reject) => {
    const argv = binary === undefined ? ['--yes', name, ...args] : args
    // Windows 上 `npx` 是 npx.cmd，不经过 shell 直接 spawn 会 ENOENT。
    const child = spawn(binary ?? 'npx', argv, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: binary === undefined && IS_WINDOWS,
    })
    let output = ''
    // 外部工具会卡住（surge 在没 TTY 时可能等输入、网络也会挂）：不设超时的话
    // 发布请求和整个弹窗会永久 busy，用户只能关页面。
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${name} 超时（${Math.round(timeoutMs / 1000)}s）：${output.slice(-200)}`))
    }, timeoutMs)
    const settle = (fn) => (value) => {
      clearTimeout(timer)
      fn(value)
    }
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
    })
    child.on('error', settle(reject))
    child.on('exit', (code) => {
      if (code === 0) settle(resolvePromise)(output)
      else settle(reject)(new Error(`${name} 退出 ${code}：${output.slice(-400)}`))
    })
  })
}
