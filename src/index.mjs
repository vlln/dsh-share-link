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

import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

import { CODE_LENGTH, ShareError, ShareManager, TTL_HOURS } from './share-link.mjs'

export const name = 'dsh-share-link'

/** 分享服务依赖的宿主能力：工具注册、会话读取、同源 HTTP 路由。 */
export const inject = ['tools', 'sessionQuery', 'connection']

/** 配置项。`port` 传 0 表示随机端口（推荐，避免与宿主端口冲突）。 */
/** 配置默认值（设置卡与运行时共用同一份，避免两处漂移）。 */
export const DEFAULTS = Object.freeze({
  defaultChannel: 'quick',
  port: 0,
  ttlHours: TTL_HOURS.default,
  cloudflaredPath: '',
  cloudflaredSha256: '',
  tunnelToken: '',
  tunnelHostname: '',
  surgeLogin: '',
  surgeToken: '',
  surgeDomain: '',
  surgePrefix: 'dsh-share',
  pageTheme: 'paper',
  pageThemeCss: '',
  idLength: CODE_LENGTH.default,
  toolShareSession: false,
  toolShareArtifact: false,
  toolShareList: false,
  toolShareRevoke: false,
})

export const Config = Schema.object({
  defaultChannel: Schema.union(['quick', 'surge', 'named', 'lan'])
    .default(DEFAULTS.defaultChannel)
    .volatile()
    .description('分享弹窗里默认选中的通道'),
  port: Schema.natural().default(DEFAULTS.port).volatile().description('只读分享服务端口，0 = 随机（命名隧道模式下自动用 3089）'),
  idLength: Schema.natural()
    .min(CODE_LENGTH.min)
    .max(CODE_LENGTH.max)
    .default(DEFAULTS.idLength)
    .volatile()
    .description('分享链接里的短码长度：8 位 ≈ 41 bit 熵（默认，够发也够难猜），10 位 ≈ 52 bit，16 位 ≈ 83 bit'),
  ttlHours: Schema.natural()
    .min(TTL_HOURS.min)
    .max(TTL_HOURS.max)
    .default(DEFAULTS.ttlHours)
    .volatile()
    .description('分享链接默认有效期（小时）'),
  cloudflaredPath: Schema.string().default(DEFAULTS.cloudflaredPath).volatile().description('已有 cloudflared 可执行文件路径；留空则自动查找/下载'),
  cloudflaredSha256: Schema.string()
    .default(DEFAULTS.cloudflaredSha256)
    .volatile()
    .description('可选：cloudflared 二进制的 SHA-256（64 位 hex）。填了就在下载后校验，不匹配直接删掉'),
  tunnelToken: Schema.string().default(DEFAULTS.tunnelToken).volatile().description('Cloudflare 命名隧道的 token；填了就产出固定域名链接'),
  tunnelHostname: Schema.string().default(DEFAULTS.tunnelHostname).volatile().description('命名隧道绑定的域名，例如 share.example.com'),
  surgeLogin: Schema.string().default(DEFAULTS.surgeLogin).volatile().description('Surge 账号邮箱；配合 surgeToken 免交互登录'),
  surgeToken: Schema.string().default(DEFAULTS.surgeToken).volatile().description('Surge token（`surge tokens add`）；只注入给子进程，不落盘'),
  surgeDomain: Schema.string().default(DEFAULTS.surgeDomain).volatile().description('Surge 域名后缀，例如 example.com；留空用 slug.surge.sh'),
  surgePrefix: Schema.string().default(DEFAULTS.surgePrefix).volatile().description('Surge 子域前缀，最终域名是 <prefix>-<id>.surge.sh'),
  pageTheme: Schema.union(['paper', 'github', 'notion', 'sepia', 'terminal', 'custom'])
    .default('paper')
    .volatile()
    .description('分享页预设风格；custom = 只用 pageThemeCss'),
  pageThemeCss: Schema.string().default('').volatile().description('自定义 CSS，追加在预设之后（可只写变量覆盖）'),
  toolShareSession: Schema.boolean().default(false).volatile().description('允许 agent 调用 share_session（默认关闭）'),
  toolShareArtifact: Schema.boolean().default(false).volatile().description('允许 agent 调用 share_artifact（默认关闭）'),
  toolShareList: Schema.boolean().default(false).volatile().description('允许 agent 调用 share_list（默认关闭）'),
  toolShareRevoke: Schema.boolean().default(false).volatile().description('允许 agent 调用 share_revoke（默认关闭）'),
})

/**
 * 解引用 volatile 叶并补默认值。volatile 叶在运行时是 `{ get() }` 包装，
 * 每次要用就重读——别缓存引用本身。
 * @param {any} raw
 */
export function readConfig(raw) {
  const unwrap = (value) => {
    if (value !== null && typeof value === 'object' && typeof value.get === 'function' && Object.keys(value).length === 1) {
      return unwrap(value.get())
    }
    if (Array.isArray(value)) return value.map(unwrap)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrap(item)]))
    }
    return value
  }
  return { ...DEFAULTS, ...unwrap(raw ?? {}) }
}

/** 通道的中文说法，用于工具回复。 */
const CHANNEL_LABEL = {
  tunnel: '公网隧道',
  lan: '局域网',
  surge: 'Surge 持久域名',
}

const TEXT_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
}

/** 失败时把引导也交给 agent，让它能直接告诉用户下一步点什么。 */
function describeError(error) {
  const message = String(error?.message ?? error)
  if (!(error instanceof ShareError) || error.guide === undefined) return message
  const { title, body, href, linkText, command } = error.guide
  return [
    message,
    `引导：${title}——${body}`,
    href === undefined ? '' : `入口：${linkText ?? href} ${href}`,
    command === undefined || command === null ? '' : `命令：${command}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** 分享成功后的统一文案：链接 + 有效期 + 撤销提示。 */
function describeShare(entry) {
  const expires = new Date(entry.expiresAt).toISOString().replace('T', ' ').slice(0, 16)
  return [
    `已发布：${entry.url}`,
    `类型：${entry.kind === 'session' ? '会话快照（只读）' : '文件/目录（只读）'} · 通道：${CHANNEL_LABEL[entry.provider] ?? entry.provider} · 到期：${expires} UTC`,
    entry.degraded === true
      ? `⚠️ 已降级为局域网链接：${entry.degradedReason ?? '公网通道不可用'}（链接只在同一网络内可访问）`
      : '',
    `撤销：share_revoke id=${entry.id}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * 注册分享服务、工具与同源路由。
 * @param {any} ctx - host 上下文。
 * @param {any} [config]
 */
export function apply(ctx, config = {}) {
  let liveConfig = readConfig(config)
  const manager = new ShareManager({ ctx, config: liveConfig })

  // 设置卡写的是 volatile 叶：值原地生效，这里把快照换成新值，不重挂载插件。
  ctx.effect(
    () =>
      ctx.on('loader/volatile-update', () => {
        liveConfig = readConfig(config)
        manager.config = liveConfig
        syncTools()
      }),
    'share-link: live config',
  )

  ctx.effect(
    () => {
      manager.start().catch((error) => {
        ctx.logger?.warn?.(`[share-link] 分享服务未启动：${String(error)}`)
      })
      return () => {
        void manager.stop()
      }
    },
    'share-link: readonly server',
  )

  // ------------------------------------------------------------------ tools
  //
  // 四个工具**默认关闭**：agent 不应在用户没同意的情况下把内容发到公网。
  // 开关是 volatile 叶，改完在 loader/volatile-update 里重新注册，无需重挂载。

  const TOOL_DEFS = {
    toolShareSession: defineTool({
          name: 'share_session',
          description:
            'Publish a read-only snapshot of the current session as a public link. Use when the user asks to share this conversation. The snapshot is static, redacted, and stops working after revocation or expiry.',
          parameters: {
            include_tool_calls: {
              type: 'boolean',
              description: '是否在快照里保留工具名（结果正文始终不保留）',
            },
            channel: { type: 'string', description: '通道：quick | surge | named | lan；默认取设置里的默认通道' },
            title: { type: 'string', description: '分享页标题；默认用会话标题' },
            ttl_hours: { type: 'number', description: '链接有效期（小时），默认取插件配置' },
          },
          output: TEXT_OUTPUT,
          execute: async (args, exec) => {
            const sessionId = exec.agent?.session?.id
            if (typeof sessionId !== 'string') throw new Error('share_session 需要 agent 绑定的会话')
            const entry = await manager
              .createSessionShare(sessionId, {
                includeToolCalls: args.include_tool_calls === true,
                channel: args.channel,
                title: args.title,
                ttlHours: args.ttl_hours,
              })
              .catch((error) => {
                throw new Error(describeError(error))
              })
            return describeShare(entry)
          },
        }),
    toolShareArtifact: defineTool({
          name: 'share_artifact',
          description:
            'Publish a local file or directory (HTML page, Markdown, slides, build output) as a read-only public link. A directory without index.html gets a generated file listing; a single .html file is served at the link root.',
          parameters: {
            path: { type: 'string', required: true, description: '文件或目录路径，绝对路径或相对会话工作目录' },
            channel: { type: 'string', description: '通道：quick | surge | named | lan；默认取设置里的默认通道' },
            title: { type: 'string', description: '分享页标题；默认用文件名' },
            ttl_hours: { type: 'number', description: '链接有效期（小时）' },
          },
          output: TEXT_OUTPUT,
          execute: async (args, exec) => {
            const cwd = exec.agent?.session?.header?.cwd ?? process.cwd()
            const entry = await manager
              .createPathShare(args.path, {
                cwd,
                title: args.title,
                ttlHours: args.ttl_hours,
              })
              .catch((error) => {
                throw new Error(describeError(error))
              })
            return describeShare(entry)
          },
        }),
    toolShareList: defineTool({
          name: 'share_list',
          description: 'List the currently active share links with their ids, kinds, and expiry.',
          parameters: {},
          output: TEXT_OUTPUT,
          execute: async () => {
            const entries = manager.list()
            if (entries.length === 0) return '当前没有活跃的分享链接。'
            return entries
              .map(
                (entry) =>
                  `${entry.id}  ${entry.kind === 'session' ? '会话' : '文件'}  ${new Date(entry.createdAt).toISOString().slice(0, 16)} UTC  ${entry.url}`,
              )
              .join('\n')
          },
        }),
    toolShareRevoke: defineTool({
          name: 'share_revoke',
          description: 'Revoke one share link by id. The link stops working immediately and its snapshot is deleted from disk.',
          parameters: {
            id: { type: 'string', required: true, description: 'share_session / share_artifact 返回的 id' },
          },
          output: TEXT_OUTPUT,
          execute: async (args) =>
            (await manager.revoke(args.id)) ? `已撤销 ${args.id}，链接立即失效。` : `没有找到 ${args.id}`,
        }),
  }

  const toolDisposers = new Set()
  function syncTools() {
    for (const dispose of toolDisposers) dispose()
    toolDisposers.clear()
    for (const [flag, definition] of Object.entries(TOOL_DEFS)) {
      if (liveConfig[flag] !== true) continue
      toolDisposers.add(ctx.tools.register(definition))
    }
  }

  ctx.effect(
    () => {
      syncTools()
      return () => {
        for (const dispose of toolDisposers) dispose()
        toolDisposers.clear()
      }
    },
    'share-link: tools',
  )

  // ----------------------------------------------------------------- routes

  const route = (path, methods, handler) =>
    ctx.connection.fetch.register({
      path,
      methods,
      requestBody: 'buffered',
      fetch: async (request) => {
        const origin = request.headers.get('origin')
        const host = request.headers.get('host')
        if (origin !== null && !isSameOrigin(origin, host)) {
          return json({ error: 'cross-origin request rejected' }, 403)
        }
        try {
          return await handler(request)
        } catch (error) {
          return json(
            {
              error: String(error?.message ?? error),
              code: error?.code,
              guide: error?.guide,
            },
            400,
          )
        }
      },
    })

  route('/api/share-link/session', ['POST'], async (request) => {
    const body = await readJson(request)
    const entry = await manager.createSessionShare(body.sessionId, {
      includeToolCalls: body.includeToolCalls === true,
      channel: body.channel,
      title: body.title,
      ttlHours: body.ttlHours,
    })
    return json(entry)
  })

  route('/api/share-link/path', ['POST'], async (request) => {
    const body = await readJson(request)
    const entry = await manager.createPathShare(body.path, {
      channel: body.channel,
      title: body.title,
      ttlHours: body.ttlHours,
      cwd: body.cwd,
    })
    return json(entry)
  })

  route('/api/share-link/status', ['GET'], async () => json(await manager.status()))

  // 设置页的「检查」：cloudflared 在不在、能不能跑、什么版本；缺了就顺手开始下载。
  // 下载在插件加载时已自动启动，这个接口只负责「看一眼 + 重试」。
  route('/api/share-link/check', ['POST'], async () => json(await manager.check()))

  // 预览：用同一套渲染器出一页样例，设置卡里 iframe 直接展示
  route('/api/share-link/preview', ['POST'], async (request) => {
    const body = await readJson(request)
    const html = manager.previewPage({
      theme: body.theme,
      customCss: body.customCss,
    })
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  })

  route('/api/share-link/list', ['GET'], async () => json({ items: manager.list() }))

  route('/api/share-link/revoke', ['POST'], async (request) => {
    const body = await readJson(request)
    return json({ revoked: await manager.revoke(body.id) })
  })
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
  if (host === null) return true
  let parsed
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  return parsed.host === host
}

/** @param {any} request */
async function readJson(request) {
  const text = await request.text()
  if (text.trim() === '') return {}
  return JSON.parse(text)
}

/** @param {unknown} payload @param {number} [status] */
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
