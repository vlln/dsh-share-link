// dsh-share-link · client half
//
// 两个入口，共用一条「本地发布」通道（同源 POST /api/share-link/*）：
//   1. conversation.session.header.actions —— 会话「···」菜单里的分享项，产出
//      只读会话快照链接；
//   2. sidebar.right.tab.document.actions / deliverables.file.actions —— 文件预览
//      上的分享项，直接把当前文件发布成链接。
//
// 不依赖任何私有 client 服务：只读写宿主 slots / locale，网络走宿主同源路由。
import React from 'react'

const h = React.createElement

/** 菜单项与 header 图标之间的桥：谁先拿到点击，都由它把对话框叫起来。 */
const OPEN_EVENT = 'dsh-share-link:open-session'

/** 会话 header 右上角菜单挂载点；宿主没有"菜单项"插槽，只能在这里做增量。 */
const UTILITIES_SLOT = '[data-slot="conversation.session.header.utilities"]'

/** 16×16 链接图标，与官方菜单项图标同尺寸。 */
const LINK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke-width="1">
<path d="M6.6 9.4l2.8-2.8" stroke="currentColor" stroke-linecap="round"/>
<path d="M6.1 10.6l-.7.7a2.6 2.6 0 0 1-3.7-3.7l1.9-1.9a2.6 2.6 0 0 1 3.7 0" stroke="currentColor" stroke-linecap="round"/>
<path d="M9.9 5.4l.7-.7a2.6 2.6 0 0 1 3.7 3.7l-1.9 1.9a2.6 2.6 0 0 1-3.7 0" stroke="currentColor" stroke-linecap="round"/>
</svg>`

/**
 * 把「分享会话」塞进会话右上角的 `···` 菜单。
 *
 * 宿主没有给菜单项留插槽（那份菜单由 `dsh-session-log-export` 自渲染），所以这里
 * 在菜单出现时**克隆一个既有菜单项**再改写文案与图标——克隆保证内边距、hover、
 * 焦点样式与官方完全一致，不靠猜 class 名。菜单关闭即随组件卸载，重复打开会重新注入。
 *
 * 失效模式是**静默降级**：选择器对不上就不注入，header 上的分享图标仍然可用。
 */
function installMenuIntegration() {
  if (typeof document === 'undefined') return () => {}

  const enhance = () => {
    const menu = document.querySelector(`${UTILITIES_SLOT} [role="menu"]`)
    if (menu === null || menu.querySelector('[data-dsh-share-menu-item]') !== null) return
    const item = menu.querySelector('[role="menuitem"]')
    const wrap = item?.parentElement
    if (item === null || item === undefined || wrap === null || wrap === undefined) return

    // 跟随宿主当前语言：同一份菜单里的文案是英文就用英文。
    const english = /download|feedback/i.test(menu.textContent ?? '')
    const clone = wrap.cloneNode(true)
    const button = clone.querySelector('[role="menuitem"]')
    if (button === null) return
    button.setAttribute('data-dsh-share-menu-item', 'true')

    const icon = button.querySelector('svg')
    if (icon !== null) icon.outerHTML = LINK_ICON
    const label = [...button.querySelectorAll('span')].at(-1)
    if (label !== undefined) label.textContent = english ? 'Share conversation…' : '分享会话…'

    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      setTimeout(() => document.dispatchEvent(new CustomEvent(OPEN_EVENT)), 40)
    })

    wrap.parentElement?.insertBefore(clone, wrap)
  }

  const observer = new MutationObserver(enhance)
  observer.observe(document.body, { childList: true, subtree: true })
  enhance()
  return () => observer.disconnect()
}

const STYLE_ID = 'dsh-share-link-style'
const CSS = `
[data-dsh-share] { font: inherit; }
[data-dsh-share-btn] {
  display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 8px;
  border: 0; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-text-tertiary, #61666b);
  font: inherit; font-size: 12.5px; line-height: 1; cursor: pointer; white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
[data-dsh-share-btn]:hover {
  background: var(--dsw-alias-bg-hover, rgba(128,128,140,.10));
  color: var(--dsw-alias-text-primary, #1d1d22);
}
[data-dsh-share-btn]:focus-visible {
  outline: 2px solid var(--dsw-alias-brand, #4d6bfe); outline-offset: 1px;
}
[data-dsh-share-btn][data-icon-only="true"] { width: 28px; height: 28px; padding: 0; justify-content: center; }
[data-dsh-share-overlay] {
  position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center;
  justify-content: center; background: rgba(0,0,0,.32); backdrop-filter: blur(2px);
}
[data-dsh-share-card] {
  width: min(460px, calc(100vw - 32px)); padding: 20px; border-radius: 14px;
  background: var(--dsw-alias-bg-elevated, #fff); color: var(--dsw-alias-text-primary, #1d1d22);
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  box-shadow: 0 18px 48px rgba(0,0,0,.24);
  font: 13.5px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
}
[data-dsh-share-card] h3 { margin: 0 0 4px; font-size: 15px; }
[data-dsh-share-card] p.hint { margin: 0 0 14px; color: var(--dsw-alias-text-secondary, #6b6b76); font-size: 12.5px; }
[data-dsh-share-row] { display: flex; align-items: center; gap: 8px; margin: 12px 0; }
[data-dsh-share-row] label { display: flex; align-items: center; gap: 7px; color: var(--dsw-alias-text-secondary, #5f5f6b); }
[data-dsh-share-link] {
  flex: 1; height: 32px; padding: 0 10px; border-radius: 8px; min-width: 0;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  background: var(--dsw-alias-bg-base, #f7f7fa); color: inherit;
  font: 11.5px/1 ui-monospace, Menlo, monospace; text-overflow: ellipsis;
}
a[data-dsh-share-btn] { text-decoration: none; }
[data-dsh-share-actions] { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
[data-dsh-share-actions] button {
  height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer; font-size: 13px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea); background: transparent; color: inherit;
}
[data-dsh-share-actions] button[data-primary="true"] {
  background: var(--dsw-alias-brand, #4d6bfe); border-color: transparent; color: #fff;
}
[data-dsh-share-actions] button:disabled { opacity: .55; cursor: default; }
[data-dsh-share-error] { color: #d64545; font-size: 12.5px; margin-top: 10px; white-space: pre-wrap; }
[data-dsh-share-guide] {
  margin-top: 12px; padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  background: var(--dsw-alias-bg-base, #f7f7fa);
}
[data-dsh-share-guide] strong { display: block; font-size: 13px; margin-bottom: 4px; }
[data-dsh-share-guide] p { margin: 0 0 10px; font-size: 12.5px; color: var(--dsw-alias-text-secondary, #5f5f6b); }
[data-dsh-share-guide] .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
[data-dsh-share-guide] a[data-dsh-share-btn] {
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  color: var(--dsw-alias-brand, #4d6bfe);
}
[data-dsh-share-guide] code {
  flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all;
  font: 11.5px/1.9 ui-monospace, Menlo, monospace;
  background: var(--dsw-alias-bg-elevated, #fff); padding: 2px 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
}
[data-dsh-share-warn] { color: #b7791f; font-size: 12.5px; margin-top: 10px; }
[data-dsh-share-ok] { color: #2f9e6b; font-size: 12.5px; margin-top: 10px; }
`

function ensureStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

async function post(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const failure = new Error(payload.error ?? `HTTP ${response.status}`)
    failure.guide = payload.guide
    failure.code = payload.code
    throw failure
  }
  return payload
}

/** 引导文案按 code 本地化：宿主只提供动作数据（href / command），文案归客户端。 */
const GUIDE_COPY: Record<string, { zh: { title: string; body: string; linkText: string }; en: { title: string; body: string; linkText: string } }> = {
  surgeLogin: {
    zh: {
      title: '需要先登录 Surge',
      body: 'Surge 用邮箱注册（免费），在终端登录一次即可；插件会复用本机的登录状态。',
      linkText: '打开 surge.sh 注册 / 登录',
    },
    en: {
      title: 'Sign in to Surge first',
      body: 'Surge accounts are free and email-based. Sign in once in your terminal; the plugin reuses that session.',
      linkText: 'Open surge.sh',
    },
  },
  surgeMissing: {
    zh: { title: '没有找到 surge 命令', body: '本机还没装 Surge CLI。装好并登录后，分享会自动走你自己的账号。', linkText: 'surge.sh' },
    en: { title: 'surge CLI not found', body: 'Install the Surge CLI and sign in once; shares will then use your own account.', linkText: 'surge.sh' },
  },
  cfHostname: {
    zh: {
      title: '命名隧道缺少域名',
      body: '配置了 tunnelToken，但没说对外用哪个域名。先在 Cloudflare 建隧道并把域名指到本机 3089 端口，再回来填 tunnelHostname。',
      linkText: '打开 Cloudflare Zero Trust',
    },
    en: {
      title: 'Named tunnel has no hostname',
      body: 'A tunnel token is configured but no public hostname. Create the tunnel in Cloudflare, point it at localhost:3089, then set tunnelHostname.',
      linkText: 'Open Cloudflare Zero Trust',
    },
  },
  cfDownload: {
    zh: { title: 'cloudflared 不可用', body: '公网链接需要一个 cloudflared 可执行文件：可以自动下载，也可以自己装一个再填 cloudflaredPath。', linkText: '下载 cloudflared' },
    en: { title: 'cloudflared unavailable', body: 'A public link needs the cloudflared binary. It can be downloaded automatically, or install one and set cloudflaredPath.', linkText: 'Download cloudflared' },
  },
}

/** @returns {'zh' | 'en'} */
function uiLanguage() {
  return (document.documentElement.lang || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

/**
 * 引导面板：通道没就绪、或发布失败时给出「去登录 / 去配置」的可点入口，
 * 并附一条可复制的命令。链接一律 target=_blank，不打断当前会话。
 */
function GuidePanel(props) {
  const { guide, t } = props
  if (guide === null || guide === undefined) return null
  const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback)
  const copyFor = GUIDE_COPY[guide.code]?.[uiLanguage()]
  const title = copyFor?.title ?? guide.title
  const body = copyFor?.body ?? guide.body
  const linkText = copyFor?.linkText ?? guide.linkText
  const [copied, setCopied] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(guide.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 手动选中即可 */
    }
  }
  return h(
    'div',
    { 'data-dsh-share-guide': true },
    h('strong', null, title),
    body === undefined ? null : h('p', null, body),
    h(
      'div',
      { className: 'row' },
      guide.href === undefined
        ? null
        : h(
            'a',
            { 'data-dsh-share-btn': true, href: guide.href, target: '_blank', rel: 'noreferrer' },
            linkText ?? tr('guide.open', 'Open'),
          ),
      guide.command === undefined || guide.command === null
        ? null
        : h('code', null, guide.command),
      guide.command === undefined || guide.command === null
        ? null
        : h('button', { 'data-dsh-share-btn': true, onClick: copy, type: 'button' }, copied ? tr('copied', 'Copied') : tr('copy', 'Copy')),
    ),
  )
}

/** 表单/结果共用的分享对话框。 */
function ShareDialog(props) {
  const { sessionId, absolutePath, onClose, t } = props
  const tr = (key, fallback) => (typeof t === 'function' ? t(key) : fallback)
  const [busy, setBusy] = React.useState(false)
  const [entry, setEntry] = React.useState(null)
  const [error, setError] = React.useState('')
  const [withTools, setWithTools] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [revoked, setRevoked] = React.useState(false)
  const [status, setStatus] = React.useState(null)
  const [guide, setGuide] = React.useState(null)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const created =
        typeof absolutePath === 'string' && absolutePath !== ''
          ? await post('/api/share-link/path', { path: absolutePath })
          : await post('/api/share-link/session', { sessionId, includeToolCalls: withTools })
      setEntry(created)
    } catch (failure) {
      setError(String(failure?.message ?? failure))
      setGuide(failure?.guide ?? null)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时用户仍可手动选中 */
    }
  }

  const revoke = async () => {
    setBusy(true)
    try {
      await post('/api/share-link/revoke', { id: entry.id })
      setEntry(null)
      setRevoked(true)
    } catch (failure) {
      setError(String(failure?.message ?? failure))
    } finally {
      setBusy(false)
    }
  }

  React.useEffect(() => {
    ensureStyle()
    let alive = true
    fetch('/api/share-link/status')
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (alive && value !== null) setStatus(value)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const target = typeof absolutePath === 'string' && absolutePath !== '' ? absolutePath : null
  const blocked = status !== null && status.ready === false
  const expires =
    entry !== null
      ? new Date(entry.expiresAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
      : ''

  return h(
    'div',
    {
      'data-dsh-share-overlay': true,
      onClick: (event) => {
        if (event.target === event.currentTarget) onClose()
      },
    },
    h(
      'div',
      { 'data-dsh-share-card': true, role: 'dialog', 'aria-modal': 'true' },
      h('h3', null, target === null ? tr('title.session', 'Share this conversation') : tr('title.file', 'Share this file')),
      h(
        'p',
        { className: 'hint' },
        target === null
          ? tr('hint.session', 'Creates a read-only snapshot link. The recipient needs no dsh install and cannot see your other sessions. Revoking kills it instantly.')
          : tr('hint.file', 'Publishes this file as a read-only link. Revoking kills it instantly.'),
      ),
      status !== null && status.ready === false && entry === null
        ? h(GuidePanel, { guide: status.guide, t })
        : null,
      target === null && entry === null
        ? h(
            'div',
            { 'data-dsh-share-row': true },
            h(
              'label',
              null,
              h('input', {
                type: 'checkbox',
                checked: withTools,
                onChange: (event) => setWithTools(event.target.checked),
              }),
              tr('option.tools', 'Include tool-call names (result bodies are never included)'),
            ),
          )
        : null,
      target === null ? null : h('div', { 'data-dsh-share-row': true }, h('code', { style: { fontSize: '11.5px' } }, target)),
      entry === null
        ? null
        : h(
            'div',
            { 'data-dsh-share-row': true },
            h('input', {
              'data-dsh-share-link': true,
              readOnly: true,
              value: entry.url,
              onFocus: (event) => event.target.select(),
            }),
            h('button', { 'data-dsh-share-btn': true, onClick: copy, type: 'button' }, copied ? tr('copied', 'Copied') : tr('copy', 'Copy')),
            h('a', { 'data-dsh-share-btn': true, href: entry.url, target: '_blank', rel: 'noreferrer' }, tr('open', 'Open')),
          ),
      error === '' || guide !== null ? null : h('div', { 'data-dsh-share-error': true }, error),
      guide === null ? null : h(GuidePanel, { guide, t }),
      entry === null
        ? null
        : h('div', { 'data-dsh-share-ok': true }, `${tr('ok', 'Link created — ready to send.')} ${tr('expires', 'Expires')} ${expires}`),
      revoked && error === ''
        ? h('div', { 'data-dsh-share-ok': true }, tr('revoked', 'Revoked — the link no longer works.'))
        : null,
      entry !== null && entry.degraded === true
        ? h('div', { 'data-dsh-share-warn': true }, tr('degraded', '公网通道不可用，已降级为局域网链接（仅同一网络可访问）。'))
        : null,
      h(
        'div',
        { 'data-dsh-share-actions': true },
        entry !== null
          ? h('button', { disabled: busy, onClick: revoke, type: 'button' }, tr('revoke', 'Revoke'))
          : null,
        h('button', { onClick: onClose, type: 'button' }, tr('close', 'Close')),
        entry === null
          ? h(
              'button',
              { 'data-primary': 'true', disabled: busy || blocked, onClick: submit, type: 'button' },
              busy ? tr('working', 'Creating…') : blocked ? tr('blocked', '先完成上面的配置') : tr('create', 'Create link'),
            )
          : null,
      ),
    ),
  )
}

/** header「···」菜单项。 */
function SessionShareAction(props) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    ensureStyle()
    const openFromMenu = () => setOpen(true)
    document.addEventListener(OPEN_EVENT, openFromMenu)
    return () => document.removeEventListener(OPEN_EVENT, openFromMenu)
  }, [])
  const label = typeof props.t === 'function' ? props.t('action') : '分享'
  return h(
    'span',
    { 'data-dsh-share': true },
    h(
      'button',
      {
        'data-dsh-share-btn': true,
        'data-icon-only': 'true',
        title: label,
        'aria-label': label,
        onClick: () => setOpen(true),
        type: 'button',
      },
      h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.23',
          stroke: 'currentColor',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        }),
        h('path', {
          d: 'M14 11a5 5 0 0 0-7.07 0L4.8 13.1a5 5 0 0 0 7.07 7.07l1.4-1.4',
          stroke: 'currentColor',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        }),
      ),
    ),
    open ? h(ShareDialog, { sessionId: props.sessionId, t: props.t, onClose: () => setOpen(false) }) : null,
  )
}

/** 文件预览 / 交付物上的分享按钮。 */
function FileShareAction(props) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    ensureStyle()
  }, [])
  const absolutePath = props.absolutePath ?? props.path ?? props.file?.absolutePath ?? props.file?.path
  if (typeof absolutePath !== 'string' || absolutePath === '') return null
  const label = typeof props.t === 'function' ? props.t('action') : '分享'
  return h(
    'span',
    { 'data-dsh-share': true },
    h(
      'button',
      {
        'data-dsh-share-btn': true,
        title: label,
        onClick: () => setOpen(true),
        type: 'button',
      },
      h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.23',
          stroke: 'currentColor',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        }),
        h('path', {
          d: 'M14 11a5 5 0 0 0-7.07 0L4.8 13.1a5 5 0 0 0 7.07 7.07l1.4-1.4',
          stroke: 'currentColor',
          'stroke-width': 1.8,
          'stroke-linecap': 'round',
        }),
      ),
      h('span', null, label),
    ),
    open ? h(ShareDialog, { absolutePath, t: props.t, onClose: () => setOpen(false) }) : null,
  )
}

const zh = {
  action: '分享',
  'title.session': '分享这段对话',
  'title.file': '分享这个文件',
  'hint.session': '生成一个只读快照链接：对方无需安装 dsh，也看不到你的其他会话。撤销后立即失效。',
  'hint.file': '把这个文件原样发布成只读链接。撤销后立即失效。',
  'option.tools': '包含工具调用名称（结果正文始终不含）',
  create: '生成链接',
  working: '生成中…',
  copy: '复制',
  copied: '已复制',
  close: '关闭',
  ok: '链接已生成，可直接发给对方。',
  open: '打开',
  revoke: '撤销',
  revoked: '已撤销，链接立即失效。',
  expires: '到期',
  'guide.open': '打开',
  blocked: '先完成上面的配置',
}

const en = {
  action: 'Share',
  'title.session': 'Share this conversation',
  'title.file': 'Share this file',
  'hint.session': 'Creates a read-only snapshot link. The recipient needs no dsh install and cannot see your other sessions. Revoking kills it instantly.',
  'hint.file': 'Publishes this file as a read-only link. Revoking kills it instantly.',
  'option.tools': 'Include tool-call names (result bodies are never included)',
  create: 'Create link',
  working: 'Creating…',
  copy: 'Copy',
  copied: 'Copied',
  close: 'Close',
  ok: 'Link created — ready to send.',
  open: 'Open',
  revoke: 'Revoke',
  revoked: 'Revoked — the link no longer works.',
  expires: 'Expires',
  'guide.open': 'Open',
  blocked: 'Finish the setup above first',
}

export default {
  name: 'dsh-share-link-client',
  inject: ['locale', 'slots'],
  apply(ctx) {
    ctx.locale.register('share-link', { zh, en })
    ctx.effect(() => installMenuIntegration(), 'share-link: session menu item')

    // 右上角：与会话日志「···」菜单同排，作为独立的分享图标。
    ctx.slots.inject('conversation.session.header.utilities', () =>
      ctx.slots.register(
        {
          name: 'conversation.session.header.utilities',
          id: 'share-link',
          order: 40,
          locale: 'share-link',
        },
        SessionShareAction,
      ),
    )

    ctx.slots.inject('sidebar.right.tab.document.actions', () =>
      ctx.slots.register(
        {
          name: 'sidebar.right.tab.document.actions',
          id: 'share-link',
          order: 40,
          locale: 'share-link',
        },
        FileShareAction,
      ),
    )

    ctx.slots.inject('deliverables.file.actions', () =>
      ctx.slots.register(
        {
          name: 'deliverables.file.actions',
          id: 'share-link',
          order: 40,
          locale: 'share-link',
        },
        FileShareAction,
      ),
    )
  },
}
