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
import { randomBytes } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { homedir, networkInterfaces } from 'node:os'
import { delimiter, dirname, extname, join, relative, resolve, sep } from 'node:path'

import { foldSurface } from '@deepseek-ai/dsh-session'

import {
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

/**
 * 首次分享要下载 cloudflared（约 20 MB）。请求里最多等这么久，超过就交出进度、
 * 让用户重试——把「卡住几十秒没有任何反馈」换成「告诉你在下什么、下到哪」。
 */
const WARM_WAIT_MS = 2000

/** 下载参数：前 3 秒跑不到 200 KB 就判慢、换下一个源；15 秒没新数据算卡死。 */
const DOWNLOAD = Object.freeze({
  raceMs: 3000,
  raceBytes: 200 * 1024,
  stallMs: 15_000,
  totalMs: 6 * 60 * 1000,
})

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

/** Windows 上可执行文件带扩展名、PATH 分隔符也不同。 */
const IS_WINDOWS = process.platform === 'win32'
const BINARY_NAME = IS_WINDOWS ? 'cloudflared.exe' : 'cloudflared'

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
      if (text.trim() !== '' && !isInjectedContext(text)) messages.push({ role: 'user', text });
      continue
    }
    if (event.type === 'assistant/message') {
      const message = data.message ?? {}
      const text = messageText(message.content ?? message)
      const tools = options.includeToolCalls === true ? toolNames(message.content) : []
      if (text.trim() !== '' || tools.length > 0) {
        messages.push({ role: 'assistant', text: text.trim() === '' ? '（本步只有工具调用）' : text, tools });
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
    if (!existsSync(full) || !statSync(full).isFile()) continue
    const size = statSync(full).size
    if (size > LIMITS.maxBytes || bytes + size > LIMITS.maxBytes) continue
    bytes += size
    assets[relative(root, full).split(sep).join('/')] = readFileSync(full)
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
async function fetchImage(url) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(MARKDOWN_IMAGES.timeoutMs) })
  if (!response.ok) return undefined
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!type.startsWith('image/')) return undefined
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MARKDOWN_IMAGES.maxBytesEach) return undefined
  return `data:${type};base64,${buffer.toString('base64')}`
}

/**
 * 一条分享的对外 URL。Surge 把整个目录部署成域名根；隧道/局域网走 `/s/<id>/`。
 * @param {{provider?: string, origin: string, id: string, entry?: string}} entry
 * @returns {string}
 */
export function urlOf(entry) {
  const suffix = entry.entry === undefined || entry.entry === 'index.html' ? '' : entry.entry
  return entry.provider === 'surge' ? `${entry.origin}/${suffix}` : `${entry.origin}/s/${entry.id}/${suffix}`
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
    command: 'brew install cloudflared',
  },
  cfDownload: {
    code: 'cfDownload',
    title: 'cloudflared 不可用',
    body: '公网链接需要一个 cloudflared 可执行文件。可以自动下载，也可以自己装一个然后填 cloudflaredPath。',
    href: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    linkText: '下载 cloudflared',
    command: 'brew install cloudflared',
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
    /** cloudflared 的预热状态：idle | downloading | ready | failed。 */
    this.download = { state: 'idle', received: 0, total: 0 }
    this.downloadTask = null
  }

  // ---------------------------------------------------------------- lifecycle

  async start() {
    mkdirSync(this.sharesDir, { recursive: true })
    await this.#listen()
    this.sweep()
    this.#dropStaleQuickShares()
    // 装上就开始下：cloudflared 是快速隧道的前置，等到用户点分享才下就变成「卡住」。
    // 只下载，不连隧道——没在用快速隧道的用户不该多一个公网入口和一个常驻进程。
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
      server.on('error', reject)
      server.listen(requested, '127.0.0.1', () => {
        this.server = server
        this.port = server.address().port
        resolvePromise()
      })
    })
  }

  get origin() {
    return this.tunnelOrigin ?? lanAddress(this.port)
  }

  // ------------------------------------------------------------------- store

  #readIndex() {
    try {
      return JSON.parse(readFileSync(this.indexFile, 'utf8'))
    } catch {
      return {}
    }
  }

  #writeIndex(index) {
    writeFileSync(this.indexFile, JSON.stringify(index, null, 2))
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
      if (entry.channel !== 'quick') continue
      if (entry.provider === 'lan' && entry.origin === currentLan) continue
      rmSync(join(this.sharesDir, id), { recursive: true, force: true })
      delete index[id]
      dropped += 1
    }
    if (dropped > 0) {
      this.#writeIndex(index)
      this.ctx.logger?.debug?.(`[share-link] 清理了 ${dropped} 条上一轮进程留下的快速隧道分享`)
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
   * @returns {Promise<{provider: string, ready: boolean, guide?: object, detail: string}>}
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
    return {
      default: current.id,
      channels,
      provider: current.provider,
      ready: active.ready,
      via: active.via,
      detail: active.detail,
      guide: active.guide,
    }
  }

  /** 当前 cloudflared 预热状态（给设置页与分享弹窗看进度）。 */
  downloadInfo() {
    const { state, received, total, path, error, version } = this.download
    const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0
    return { state, received, total, percent, path, error, version }
  }

  /**
   * 设置页的「检查」：确认 cloudflared 在不在、能不能跑、什么版本。
   *
   * 缺了就顺手开始下载（与 `start()` 自动下载同一套幂等逻辑）；返回当前状态，
   * 调用方不需要等下载结束。
   * @returns {Promise<ReturnType<ShareManager['downloadInfo']>>}
   */
  async check() {
    const cached = this.#cachedCloudflared()
    if (cached === undefined) {
      void this.warm()
      return this.downloadInfo()
    }
    const output = await runOnce(cached, ['--version']).catch(() => undefined)
    const version = output === undefined ? undefined : /version\s+([0-9][^\s]*)/i.exec(output)?.[1]
    this.download = { state: 'ready', received: 1, total: 1, path: cached, version }
    return this.downloadInfo()
  }

  /**
   * 预热 cloudflared：把「首次分享要等 20 MB」挪出请求路径。
   *
   * 幂等——磁盘缓存、PATH 上的 cloudflared 都算就绪；下载失败后可以再调一次重试。
   */
  async warm() {
    const cached = this.#cachedCloudflared()
    if (cached !== undefined) {
      this.download = { state: 'ready', received: 1, total: 1, path: cached }
      return this.downloadInfo()
    }
    if (this.downloadTask === null) {
      this.download = { state: 'downloading', received: 0, total: 0 }
      this.downloadTask = downloadCloudflared(join(this.root, 'bin'), (progress) => {
        this.download = { state: 'downloading', received: progress.received, total: progress.total }
      })
        .then((path) => {
          this.download = { state: 'ready', received: 1, total: 1, path }
          return path
        })
        .catch((error) => {
          this.download = { state: 'failed', received: 0, total: 0, error: String(error?.message ?? error) }
          this.ctx.logger?.warn?.(`[share-link] cloudflared 下载失败：${String(error)}`)
        })
        .finally(() => {
          this.downloadTask = null
        })
    }
    await this.downloadTask
    return this.downloadInfo()
  }

  /** 已经可用的 cloudflared：显式配置 > 缓存 > PATH。 */
  #cachedCloudflared() {
    const explicit = this.config.cloudflaredPath
    if (typeof explicit === 'string' && explicit !== '') return explicit
    const cached = join(this.root, 'bin', BINARY_NAME)
    if (existsSync(cached)) return cached
    return findOnPath('cloudflared')
  }

  /**
   * 取一个能用的 cloudflared 可执行文件：缺了就**开始下载并最多等 WARM_WAIT_MS**，
   * 还没好就抛带进度的引导（`tunnel-warming`），不再让请求无声挂住。
   * @returns {Promise<string>}
   */
  async #cloudflaredBinary() {
    const cached = this.#cachedCloudflared()
    if (cached !== undefined) return cached
    await Promise.race([this.warm(), new Promise((done) => setTimeout(done, WARM_WAIT_MS))])
    const after = this.#cachedCloudflared()
    if (after !== undefined) return after
    const state = this.downloadInfo()
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
    const info = statSync(target)
    const size = measure(target)
    if (size.bytes > LIMITS.maxBytes) throw new Error(`超过 ${LIMITS.maxBytes} 字节上限：${size.bytes}`)
    if (size.files > LIMITS.maxFiles) throw new Error(`超过 ${LIMITS.maxFiles} 个文件上限：${size.files}`)

    const body = {}
    let entry = 'index.html'
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
      }
    } else if (/\.html?$/i.test(target)) {
      body['index.html'] = readFileSync(target, 'utf8')
    } else if (/\.md$/i.test(target)) {
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
   * @param {{kind: string, title: string, body: Record<string, string|Buffer>, ttlHours?: number, entry?: string, source?: string, files?: number}} input
   */
  async #publish(input) {
    const { id, dir } = this.#allocateShareDir()
    let committed = false
    try {
      for (const [name, content] of Object.entries(input.body)) {
        if (name === '') {
          cpSync(/** @type {string} */ (content), dir, { recursive: true })
          continue
        }
        const file = join(dir, name)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, /** @type {string|Buffer} */ (content))
      }

      const ttlHours = Number.isFinite(input.ttlHours) && input.ttlHours > 0 ? input.ttlHours : this.config.ttlHours ?? 168

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
    await new Promise((done) => setTimeout(done, 2500))
    if (child.exitCode !== null) {
      this.tunnel = null
      throw new Error('cloudflared 命名隧道启动失败：token 无效，或该隧道没有指向本机端口')
    }
    this.tunnelOrigin = `https://${hostname}`
    this.tunnelMode = 'named'
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

  #serve(request, response) {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${this.port}`)
    const send = (status, body, headers = {}) => {
      response.writeHead(status, {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow',
        'referrer-policy': 'no-referrer',
        ...headers,
      })
      response.end(body)
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') return send(405, 'method not allowed')
    if (url.pathname === '/healthz') return send(200, 'ok')

    // 短码是小写 base36；长度上限 32 是为了**兼容改造前的 32 位 hex 链接**——
    // 老 id 是 `[a-f0-9]{32}`，落在新字符集里，已经发出去的地址继续有效。
    const match = url.pathname.match(/^\/s\/([0-9a-z]{8,32})(\/.*)?$/)
    if (match === null) return send(404, 'not found')

    const [, id, rest = '/'] = match
    const entry = this.#readIndex()[id]
    if (entry === undefined) return send(404, 'not found')
    // 到期即 404，不以 sweep 是否跑过为准：长期运行的进程可能一直没调 list()，
    // 惰性清理会让「已过期」的链接继续可读。磁盘上的清理仍交给 sweep()。
    if (typeof entry.expiresAt === 'number' && entry.expiresAt <= Date.now()) return send(404, 'not found')

    const base = join(this.sharesDir, id)
    const relative = rest === '/' ? '/index.html' : rest
    const file = resolve(base, `.${relative}`)
    if (!file.startsWith(base + sep)) return send(403, 'forbidden')
    if (!existsSync(file) || statSync(file).isDirectory()) return send(404, 'not found')

    const body = readFileSync(file)
    return send(200, body, { 'content-type': mimeOf(file) })
  }
}

/**
 * 下载 cloudflared 并解压到 `binDir`，返回可执行文件路径。
 *
 * 两个源**按顺序试**，但第一个源带「慢速探测」：3 秒内拿不到 200 KB 就换下一个。
 * 实测同一个网络上 GitHub 直连只有 18 KB/s（20 MB ≈ 18 分钟），ghproxy 有 180 KB/s，
 * 只换顺序不做探测的话，一部分用户会白等十几分钟。
 *
 * @param {string} binDir
 * @param {(progress: {received: number, total: number}) => void} onProgress
 * @returns {Promise<string>}
 */
async function downloadCloudflared(binDir, onProgress = () => {}) {
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
    const tar = spawn('tar', ['-xzf', archive, '-C', binDir], { stdio: 'inherit' })
    tar.on('exit', (code) => (code === 0 ? done() : fail(new Error(`tar 退出 ${code}`))))
    tar.on('error', fail)
  })
  rmSync(archive, { force: true })
  const binary = join(binDir, 'cloudflared')
  if (!existsSync(binary)) throw new Error('解压后没有 cloudflared')
  return binary
}

/** @returns {string} 当前平台对应的 release 资产名。 */
function cloudflaredAsset() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  if (IS_WINDOWS) return `cloudflared-windows-${arch}.exe`
  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  return `cloudflared-${os}-${arch}.tgz`
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

/** @param {number} bytes @returns {string} */
function formatMb(bytes) {
  if (!(bytes > 0)) return '0 MB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * 跑一个可执行文件并收集输出（带超时），用于「检查」这类一次性探测。
 * @param {string} binary
 * @param {string[]} args
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
function runOnce(binary, args, timeoutMs = 5000) {
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
 * 运行一个外部发布工具：优先用 PATH 上的同名可执行文件，否则退回 `npx --yes <name>`。
 * @param {string} name
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<string>} 合并后的 stdout + stderr。
 */
export function runTool(name, args, env) {
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
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolvePromise(output)
      else reject(new Error(`${name} 退出 ${code}：${output.slice(-400)}`))
    })
  })
}

/**
 * 在 PATH 上找可执行文件（同步：预热与发布路径都要立刻判断）。
 * @param {string} name
 * @returns {string|undefined}
 */
function findOnPath(name) {
  const candidates = IS_WINDOWS ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`, name] : [name]
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir === '') continue
    for (const candidate of candidates) {
      const full = join(dir, candidate)
      try {
        if (statSync(full).isFile()) return full
      } catch {
        /* 不存在就继续 */
      }
    }
  }
  return undefined
}
