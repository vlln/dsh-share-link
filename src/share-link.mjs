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
import { extname, join, relative, resolve, sep } from 'node:path'

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
  }

  // ---------------------------------------------------------------- lifecycle

  async start() {
    mkdirSync(this.sharesDir, { recursive: true })
    await this.#listen()
    this.sweep()
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
   * 通道就绪情况：client 半在打开分享框时就查这个，未就绪直接给引导，而不是等失败。
   * @returns {Promise<{provider: string, ready: boolean, guide?: object, detail: string}>}
   */
  async status() {
    const channels = {}
    const surge = await this.#surgeStatus()
    channels.surge = surge
    channels.quick = { ready: true, detail: '首次分享会自动下载 cloudflared' }
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

  async #surgeStatus() {
    const binary = await whichTool('surge')
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
    const rawText = JSON.stringify(messages)
    const safeMessages = messages.map((message) => ({ ...message, text: redact(message.text) }))
    const redactedCount = JSON.stringify(safeMessages) === rawText ? 0 : 1

    let title = options.title
    if (title === undefined) title = await this.#readTitle(sessionId)
    if (title === undefined || title === '') title = `会话 ${sessionId.slice(0, 8)}`

    const createdAt = Date.now()
    const html = renderSessionPage({
      title,
      sessionId,
      createdAt,
      messages: safeMessages,
      fingerprint: createHash('sha256').update(rawText).digest('hex').slice(0, 16),
      redactedCount,
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
        })
      }
    } else if (/\.html?$/i.test(target)) {
      body['index.html'] = readFileSync(target, 'utf8')
    } else if (/\.md$/i.test(target)) {
      const name = target.split(sep).at(-1) ?? 'document'
      body['index.html'] = renderMarkdownDocument({
        title: name.replace(/\.md$/i, ''),
        markdown: readFileSync(target, 'utf8'),
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
    const id = randomBytes(16).toString('hex')
    const dir = join(this.sharesDir, id)
    mkdirSync(dir, { recursive: true })
    for (const [name, content] of Object.entries(input.body)) {
      if (name === '') {
        cpSync(/** @type {string} */ (content), dir, { recursive: true })
        continue
      }
      writeFileSync(join(dir, name), /** @type {string|Buffer} */ (content))
    }

    const ttlHours = Number.isFinite(input.ttlHours) && input.ttlHours > 0 ? input.ttlHours : this.config.ttlHours ?? 168

    const channel = this.resolveChannel(input.channel)
    let origin
    let provider
    let domain
    let degraded = false
    let degradedReason
    if (channel.provider === 'surge') {
      const deployed = await this.#deploySurge(dir, `${this.config.surgePrefix ?? 'dsh-share'}-${id.slice(0, 8)}`)
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
    return { ...entry, url: urlOf(entry) }
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
      binary = await resolveCloudflared(this.root, this.config.cloudflaredPath)
    } catch (error) {
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
    const binary = await resolveCloudflared(this.root, this.config.cloudflaredPath)
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

    const match = url.pathname.match(/^\/s\/([a-f0-9]{8,64})(\/.*)?$/)
    if (match === null) return send(404, 'not found')

    const [, id, rest = '/'] = match
    if (this.#readIndex()[id] === undefined) return send(404, 'not found')

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
 * 找到可用的 cloudflared：显式配置 > PATH > 本插件缓存目录 > 现下载。
 * @param {string} root - `$DSH_HOME/share-link`。
 * @param {string} [explicit]
 * @returns {Promise<string>}
 */
async function resolveCloudflared(root, explicit) {
  if (typeof explicit === 'string' && explicit !== '') return explicit
  const cached = join(root, 'bin', 'cloudflared')
  if (existsSync(cached)) return cached
  for (const dir of (process.env.PATH ?? '').split(':')) {
    const candidate = join(dir, 'cloudflared')
    if (existsSync(candidate)) return candidate
  }
  return await downloadCloudflared(join(root, 'bin'))
}

/**
 * 下载 cloudflared（仅 macOS/Linux）。走 GitHub Releases，失败时尝试镜像。
 * @param {string} binDir
 * @returns {Promise<string>}
 */
async function downloadCloudflared(binDir) {
  mkdirSync(binDir, { recursive: true })
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const os = process.platform === 'darwin' ? 'darwin' : 'linux'
  const asset = `cloudflared-${os}-${arch}.tgz`
  const bases = [
    `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`,
    `https://ghproxy.net/https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`,
  ]
  const errors = []
  for (const url of bases) {
    try {
      const response = await fetch(url, { redirect: 'follow' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const archive = join(binDir, `${asset}.tmp`)
      writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
      await new Promise((done, fail) => {
        const tar = spawn('tar', ['-xzf', archive, '-C', binDir], { stdio: 'inherit' })
        tar.on('exit', (code) => (code === 0 ? done() : fail(new Error(`tar 退出 ${code}`))))
        tar.on('error', fail)
      })
      rmSync(archive, { force: true })
      const binary = join(binDir, 'cloudflared')
      if (!existsSync(binary)) throw new Error('解压后没有 cloudflared')
      return binary
    } catch (error) {
      errors.push(`${url}: ${String(error)}`)
    }
  }
  throw new Error(`下载 cloudflared 失败\n${errors.join('\n')}`)
}

/**
 * 运行一个外部发布工具：优先用 PATH 上的同名可执行文件，否则退回 `npx --yes <name>`。
 * @param {string} name
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<string>} 合并后的 stdout + stderr。
 */
export function runTool(name, args, env) {
  return whichTool(name).then((binary) => new Promise((resolvePromise, reject) => {
    const argv = binary === undefined ? ['--yes', name, ...args] : args
    const child = spawn(binary ?? 'npx', argv, { env, stdio: ['ignore', 'pipe', 'pipe'] })
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
  }))
}

/**
 * 在 PATH 上找可执行文件。
 * @param {string} name
 * @returns {Promise<string|undefined>}
 */
async function whichTool(name) {
  for (const dir of (process.env.PATH ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, name)
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      /* 不存在就继续 */
    }
  }
  return undefined
}
