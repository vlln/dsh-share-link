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

import { ShareManager } from './share-link.mjs'

export const name = 'dsh-share-link'

/** 分享服务依赖的宿主能力：工具注册、会话读取、同源 HTTP 路由。 */
export const inject = ['tools', 'sessionQuery', 'connection']

/** 配置项。`port` 传 0 表示随机端口（推荐，避免与宿主端口冲突）。 */
export const Config = Schema.object({
  provider: Schema.union(['tunnel', 'lan', 'surge'])
    .default('tunnel')
    .description('tunnel = 公网 cloudflared（可撤销）；lan = 仅同局域网；surge = Surge 持久域名（可 teardown）'),
  port: Schema.natural().default(0).description('只读分享服务端口，0 = 随机（命名隧道模式下自动用 3089）'),
  ttlHours: Schema.natural().min(1).max(720).default(168).description('分享链接默认有效期（小时）'),
  cloudflaredPath: Schema.string().description('已有 cloudflared 可执行文件路径；留空则自动查找/下载'),
  tunnelToken: Schema.string().description('Cloudflare 命名隧道的 token；填了就产出固定域名链接'),
  tunnelHostname: Schema.string().description('命名隧道绑定的域名，例如 share.example.com'),
  surgeToken: Schema.string().description('Surge token（`surge tokens add`）；只注入给子进程，不落盘'),
  surgeDomain: Schema.string().description('Surge 域名后缀，例如 example.com；留空用 slug.surge.sh'),
  surgePrefix: Schema.string().default('dsh-share').description('Surge 子域前缀，最终域名是 <prefix>-<id>.surge.sh'),
})

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

/** 分享成功后的统一文案：链接 + 有效期 + 撤销提示。 */
function describeShare(entry) {
  const expires = new Date(entry.expiresAt).toISOString().replace('T', ' ').slice(0, 16)
  return [
    `已发布：${entry.url}`,
    `类型：${entry.kind === 'session' ? '会话快照（只读）' : '文件/目录（只读）'} · 通道：${CHANNEL_LABEL[entry.provider] ?? entry.provider} · 到期：${expires} UTC`,
    `撤销：share_revoke id=${entry.id}`,
  ].join('\n')
}

/**
 * 注册分享服务、工具与同源路由。
 * @param {any} ctx - host 上下文。
 * @param {any} [config]
 */
export function apply(ctx, config = {}) {
  const manager = new ShareManager({ ctx, config })

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

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'share_session',
          description:
            'Publish a read-only snapshot of the current session as a public link. Use when the user asks to share this conversation. The snapshot is static, redacted, and stops working after revocation or expiry.',
          parameters: {
            include_tool_calls: {
              type: 'boolean',
              description: '是否在快照里保留工具名（结果正文始终不保留）',
            },
            title: { type: 'string', description: '分享页标题；默认用会话标题' },
            ttl_hours: { type: 'number', description: '链接有效期（小时），默认取插件配置' },
          },
          output: TEXT_OUTPUT,
          execute: async (args, exec) => {
            const sessionId = exec.agent?.session?.id
            if (typeof sessionId !== 'string') throw new Error('share_session 需要 agent 绑定的会话')
            const entry = await manager.createSessionShare(sessionId, {
              includeToolCalls: args.include_tool_calls === true,
              title: args.title,
              ttlHours: args.ttl_hours,
            })
            return describeShare(entry)
          },
        }),
      ),
    'share-link: tool share_session',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'share_artifact',
          description:
            'Publish a local file or directory (HTML page, Markdown, slides, build output) as a read-only public link. Directories must contain index.html; a single .html file is served at the link root.',
          parameters: {
            path: { type: 'string', required: true, description: '文件或目录路径，绝对路径或相对会话工作目录' },
            title: { type: 'string', description: '分享页标题；默认用文件名' },
            ttl_hours: { type: 'number', description: '链接有效期（小时）' },
          },
          output: TEXT_OUTPUT,
          execute: async (args, exec) => {
            const cwd = exec.agent?.session?.header?.cwd ?? process.cwd()
            const entry = await manager.createPathShare(args.path, {
              cwd,
              title: args.title,
              ttlHours: args.ttl_hours,
            })
            return describeShare(entry)
          },
        }),
      ),
    'share-link: tool share_artifact',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
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
      ),
    'share-link: tool share_list',
  )

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'share_revoke',
          description: 'Revoke one share link by id. The link stops working immediately and its snapshot is deleted from disk.',
          parameters: {
            id: { type: 'string', required: true, description: 'share_session / share_artifact 返回的 id' },
          },
          output: TEXT_OUTPUT,
          execute: async (args) =>
            (await manager.revoke(args.id)) ? `已撤销 ${args.id}，链接立即失效。` : `没有找到 ${args.id}`,
        }),
      ),
    'share-link: tool share_revoke',
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
        if (origin !== null && host !== null && new URL(origin).host !== host) {
          return json({ error: 'cross-origin request rejected' }, 403)
        }
        try {
          return await handler(request)
        } catch (error) {
          return json({ error: String(error?.message ?? error) }, 400)
        }
      },
    })

  route('/api/share-link/session', ['POST'], async (request) => {
    const body = await readJson(request)
    const entry = await manager.createSessionShare(body.sessionId, {
      includeToolCalls: body.includeToolCalls === true,
      title: body.title,
      ttlHours: body.ttlHours,
    })
    return json(entry)
  })

  route('/api/share-link/path', ['POST'], async (request) => {
    const body = await readJson(request)
    const entry = await manager.createPathShare(body.path, {
      title: body.title,
      ttlHours: body.ttlHours,
      cwd: body.cwd,
    })
    return json(entry)
  })

  route('/api/share-link/list', ['GET'], async () => json({ items: manager.list() }))

  route('/api/share-link/revoke', ['POST'], async (request) => {
    const body = await readJson(request)
    return json({ revoked: await manager.revoke(body.id) })
  })
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
