// dsh-share-link · Plugins 页设置卡（client half）
//
// 一个地方管完：发布渠道、渠道参数、当前状态、已发布的链接。
// 契约（0.2.1-rc.1 实测）：
// - 设置命名空间 = 条目 id（`dsh-share-link`）；槽 `plugins.bundle.config` 的 key = bundle 包名。
// - 写入走 `configForms.get(ns).mutate([{ op:'set', path:[...], value }])`，字段是 volatile 叶，
//   宿主原地提交、不重挂载插件。
// - 快照引用必须稳定（useSyncExternalStore），否则 React #185。
import React from 'react'

const h = React.createElement

/** 设置命名空间（= 条目 id）。 */
export const NAMESPACE = 'dsh-share-link'
/** bundle 包名（= `plugins.bundle.config` 槽的 key）。 */
export const PACKAGE = '@vlln/dsh-share-link'
/** 卡片自己的 locale 命名空间。 */
const NS = 'settings.dsh-share-link'

const CHANNELS = [
  { id: 'quick', provider: 'tunnel', labelKey: 'channel.quick', hintKey: 'channel.quick.hint' },
  { id: 'named', provider: 'tunnel', labelKey: 'channel.named', hintKey: 'channel.named.hint' },
  { id: 'surge', provider: 'surge', labelKey: 'channel.surge', hintKey: 'channel.surge.hint' },
  { id: 'lan', provider: 'lan', labelKey: 'channel.lan', hintKey: 'channel.lan.hint' },
]

/** 从配置推导当前渠道（命名隧道 = tunnel + 有 token）。 */
function channelOf(cfg) {
  if (cfg.provider === 'surge') return 'surge'
  if (cfg.provider === 'lan') return 'lan'
  return typeof cfg.tunnelToken === 'string' && cfg.tunnelToken !== '' ? 'named' : 'quick'
}

/** 渠道相关的字段（端口与有效期对所有渠道通用）。 */
const CHANNEL_FIELDS = {
  quick: [],
  named: ['tunnelToken', 'tunnelHostname'],
  surge: ['surgeLogin', 'surgeToken', 'surgeDomain'],
  lan: [],
}

const COMMON_FIELDS = ['port', 'ttlHours']

const FIELD_SPEC = {
  port: { kind: 'number', secret: false },
  ttlHours: { kind: 'number', secret: false },
  tunnelToken: { kind: 'text', secret: true },
  tunnelHostname: { kind: 'text', secret: false },
  surgeLogin: { kind: 'text', secret: false },
  surgeToken: { kind: 'text', secret: true },
  surgeDomain: { kind: 'text', secret: false },
}

const el = h

/** 单字段：本地缓冲，失焦 / 回车提交；被拒时回读宿主值。 */
function Field(props) {
  const { fieldKey, value, disabled, secret, numeric, t, onCommit, resetToken } = props
  const initial = value === undefined || value === null ? '' : String(value)
  const [text, setText] = React.useState(initial)
  const [lastKey, setLastKey] = React.useState(initial)
  const [lastReset, setLastReset] = React.useState(resetToken)
  if (initial !== lastKey || resetToken !== lastReset) {
    setLastKey(initial)
    setLastReset(resetToken)
    setText(initial)
  }
  const commit = () => {
    const next = numeric ? Number(text === '' ? 0 : text) : text
    if (numeric && !Number.isFinite(next)) {
      setText(initial)
      return
    }
    if (String(next) === initial) return
    onCommit(fieldKey, next)
  }
  return el(
    'label',
    { style: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 0', borderBottom: '0.5px solid var(--dsw-alias-border-l2)' } },
    el(
      'span',
      { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
      el('span', { style: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, t(`field.${fieldKey}`)),
      el('span', { style: { fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' } }, t(`field.${fieldKey}.hint`)),
    ),
    el('input', {
      type: secret ? 'password' : numeric ? 'number' : 'text',
      value: text,
      disabled,
      'data-share-field': fieldKey,
      autoComplete: 'off',
      onChange: (event) => setText(event.target.value),
      onBlur: commit,
      onKeyDown: (event) => {
        if (event.key === 'Enter') commit()
      },
      style: {
        width: 260, height: 30, padding: '0 10px', boxSizing: 'border-box',
        fontSize: 12.5, fontFamily: numeric ? 'inherit' : 'ui-monospace, Menlo, monospace',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
        border: '0.5px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l2))',
        borderRadius: 8,
      },
    }),
  )
}

/** 已发布链接列表 + 撤销。 */
function SharesPanel(props) {
  const { t } = props
  const [rows, setRows] = React.useState(null)
  const [error, setError] = React.useState('')
  const [pending, setPending] = React.useState('')

  const load = React.useCallback(() => {
    fetch('/api/share-link/list')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload) => setRows(payload.items ?? []))
      .catch((failure) => setError(String(failure?.message ?? failure)))
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const revoke = async (id) => {
    setPending(id)
    setError('')
    try {
      const response = await fetch('/api/share-link/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      load()
    } catch (failure) {
      setError(String(failure?.message ?? failure))
    } finally {
      setPending('')
    }
  }

  if (error !== '') return el('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, error)
  if (rows === null) return el('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('shares.loading'))
  if (rows.length === 0) return el('p', { style: { margin: '8px 0 0', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('shares.empty'))

  return el(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } },
    rows.map((row) =>
      el(
        'div',
        { key: row.id, style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 } },
        el('span', { style: { color: 'var(--dsw-alias-label-tertiary)', minWidth: 44 } }, row.kind === 'session' ? t('shares.session') : t('shares.file')),
        el('a', {
          href: row.url,
          target: '_blank',
          rel: 'noreferrer',
          style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--dsw-alias-brand, #4d6bfe)' },
        }, row.url),
        el('button', {
          type: 'button',
          disabled: pending === row.id,
          onClick: () => void revoke(row.id),
          style: {
            height: 24, padding: '0 10px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
            border: '0.5px solid var(--dsw-alias-border-l2)', background: 'transparent',
            color: 'var(--dsw-alias-label-secondary)',
          },
        }, pending === row.id ? t('shares.revoking') : t('shares.revoke')),
      ),
    ),
  )
}

/** 设置卡本体。 */
export function SettingsCard(props) {
  const state = props.useShareSettings((value) => value)
  const t = props.t
  const [resetToken, setResetToken] = React.useState(0)
  const [failed, setFailed] = React.useState('')
  if (props.view === 'summary') return t('summary')
  if (!state.available) return null

  const disabled = state.writable === false
  const channel = channelOf(state.value)
  const commit = (path, value) => {
    setFailed('')
    Promise.resolve(props.write(path, value)).catch((failure) => {
      setFailed(String(failure?.message ?? failure))
      setResetToken((n) => n + 1)
    })
  }
  const pickChannel = (id) => {
    const target = CHANNELS.find((item) => item.id === id)
    if (target === undefined) return
    if (target.id === 'named' && channel !== 'named') {
      // 命名隧道必须先有域名才有意义：先切 provider，token 由字段补。
      commit('provider', 'tunnel')
      return
    }
    commit('provider', target.provider)
    if (target.id === 'quick' && typeof state.value.tunnelToken === 'string' && state.value.tunnelToken !== '') {
      commit('tunnelToken', '')
    }
  }

  const active = CHANNELS.find((item) => item.id === channel)
  const fields = [...CHANNEL_FIELDS[channel], ...COMMON_FIELDS]

  return el(
    'div',
    { 'data-dsh-share-link-settings': '', style: { display: 'flex', flexDirection: 'column' } },
    disabled ? el('p', { role: 'status', style: { margin: '0 0 8px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('readOnly')) : null,

    el('div', { style: { fontSize: 13, fontWeight: 500, margin: '4px 0 2px' } }, t('channel.title')),
    el('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', marginBottom: 8 } }, t('channel.hint')),
    el(
      'div',
      { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      CHANNELS.map((item) =>
        el('button', {
          key: item.id,
          type: 'button',
          disabled,
          'data-share-channel': item.id,
          'data-active': item.id === channel ? 'true' : 'false',
          onClick: () => pickChannel(item.id),
          style: {
            height: 28, padding: '0 12px', fontSize: 12.5, borderRadius: 8, cursor: 'pointer',
            border: '0.5px solid var(--dsw-alias-border-l2)',
            background: item.id === channel ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
            color: item.id === channel ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
            fontWeight: item.id === channel ? 500 : 400,
          },
        }, t(item.labelKey)),
      ),
    ),
    active === undefined
      ? null
      : el('p', { style: { margin: '8px 0 4px', fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' } }, t(active.hintKey)),

    el('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 6 } },
      fields.map((key) =>
        el(Field, {
          key,
          fieldKey: key,
          value: state.value[key],
          disabled,
          secret: FIELD_SPEC[key].secret,
          numeric: FIELD_SPEC[key].kind === 'number',
          t,
          resetToken,
          onCommit: (field, value) => commit(field, value),
        }),
      ),
    ),

    failed === '' ? null : el('p', { role: 'status', style: { margin: '10px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, t('writeFailed')),

    el('div', { style: { fontSize: 13, fontWeight: 500, margin: '18px 0 0' } }, t('shares.title')),
    el('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('shares.hint')),
    el(SharesPanel, { t }),
  )
}

/**
 * 注册设置卡。
 * @param {any} ctx client 根上下文（inject 需含 slots / locale / configForms）
 * @returns {() => void} disposer
 */
export function registerSettingsCard(ctx) {
  const scope = ctx.configForms.get(NAMESPACE)
  const offLocale = ctx.locale.register(NS, { zh, en })

  let cache
  const getSnapshot = () => {
    const snap = scope.getSnapshot()
    if (cache !== undefined && cache.snap === snap) return cache.state
    const available = snap.status === 'ready'
    cache = {
      snap,
      state: { available, writable: snap.writable, value: snap.value ?? {} },
    }
    return cache.state
  }

  const write = async (path, value) => {
    const accepted = await scope.mutate([{ op: 'set', path: path.split('.'), value }])
    if (accepted !== true) throw new Error(`设置写入未被接受（${path}）`)
  }

  const offServed = ctx.configForms.whileServed([NAMESPACE], () =>
    ctx.slots.inject('plugins.bundle.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.bundle.config',
          key: PACKAGE,
          locale: NS,
          inject: () => ({
            hooks: { shareSettings: { getSnapshot, subscribe: (listener) => scope.subscribe(listener) } },
            write,
          }),
        },
        SettingsCard,
      ),
    ),
  )
  return () => {
    offServed()
    offLocale()
  }
}

export const zh = {
  summary: '发布渠道、参数与已发布的链接',
  readOnly: '当前部署只读，无法修改。',
  writeFailed: '刚才的改动未被接受，已回读当前值。',
  'channel.title': '发布渠道',
  'channel.hint': '选一个渠道，填好参数就能在会话右上角或文件预览里直接出链接。',
  'channel.quick': '快速隧道',
  'channel.quick.hint': 'cloudflared 临时域名，零配置；进程停掉链接即失效，域名每次重启会变。',
  'channel.named': '命名隧道',
  'channel.named.hint': '固定域名（需 Cloudflare 账号 + 自己的域名）。需要填隧道 token 与域名，端口必须是 3089 或你在 Cloudflare 里配置的那个。',
  'channel.surge': 'Surge',
  'channel.surge.hint': '持久域名，可 `surge teardown` 撤销。免费账号即可，域名形如 <prefix>-<id>.surge.sh。',
  'channel.lan': '仅局域网',
  'channel.lan.hint': '只给同一网络的人看，不出公网。',
  'field.port': '分享服务端口',
  'field.port.hint': '0 = 随机端口；命名隧道模式必须固定（默认 3089）。',
  'field.ttlHours': '默认有效期（小时）',
  'field.ttlHours.hint': '到期后链接自动失效；撤销是立即失效。',
  'field.tunnelToken': 'Cloudflare 隧道 token',
  'field.tunnelToken.hint': 'Zero Trust → Networks → Tunnels 里那条隧道的 token。',
  'field.tunnelHostname': '对外域名',
  'field.tunnelHostname.hint': '例如 share.example.com，需在 Cloudflare 指向本机端口。',
  'field.surgeLogin': 'Surge 账号邮箱',
  'field.surgeLogin.hint': '配合 token 免交互登录；已 `surge login` 过可留空。',
  'field.surgeToken': 'Surge token',
  'field.surgeToken.hint': '`surge tokens add` 生成；只注入给子进程。',
  'field.surgeDomain': '域名后缀',
  'field.surgeDomain.hint': '留空用 <prefix>-<id>.surge.sh。',
  'shares.title': '已发布的链接',
  'shares.hint': '撤销后立即 404；本地快照同时删除。',
  'shares.empty': '还没有发布过链接。',
  'shares.loading': '读取中…',
  'shares.revoke': '撤销',
  'shares.revoking': '撤销中…',
  'shares.session': '会话',
  'shares.file': '文件',
}

export const en = {
  summary: 'Publishing channels, their settings, and active links',
  readOnly: 'This deployment is read-only.',
  writeFailed: 'That change was not accepted; values were re-read.',
  'channel.title': 'Publishing channel',
  'channel.hint': 'Pick one channel and fill in its settings; shares then work from the session menu or a file preview.',
  'channel.quick': 'Quick tunnel',
  'channel.quick.hint': 'Zero-config cloudflared URL. Dies with the process and the hostname changes on restart.',
  'channel.named': 'Named tunnel',
  'channel.named.hint': 'Stable hostname (needs Cloudflare + a domain). Requires the tunnel token and hostname; the port must match what the tunnel points at.',
  'channel.surge': 'Surge',
  'channel.surge.hint': 'Persistent domain, revocable with `surge teardown`. Free account is enough; links look like <prefix>-<id>.surge.sh.',
  'channel.lan': 'LAN only',
  'channel.lan.hint': 'Only reachable on the same network; nothing leaves your machine.',
  'field.port': 'Share server port',
  'field.port.hint': '0 = random. Named tunnels need a fixed port (3089 by default).',
  'field.ttlHours': 'Default lifetime (hours)',
  'field.ttlHours.hint': 'Links expire after this; revoking kills them immediately.',
  'field.tunnelToken': 'Cloudflare tunnel token',
  'field.tunnelToken.hint': 'From Zero Trust → Networks → Tunnels.',
  'field.tunnelHostname': 'Public hostname',
  'field.tunnelHostname.hint': 'e.g. share.example.com, pointed at the local port in Cloudflare.',
  'field.surgeLogin': 'Surge account email',
  'field.surgeLogin.hint': 'Pairs with the token for non-interactive login; leave empty if already logged in.',
  'field.surgeToken': 'Surge token',
  'field.surgeToken.hint': 'Created by `surge tokens add`; only injected into the child process.',
  'field.surgeDomain': 'Domain suffix',
  'field.surgeDomain.hint': 'Leave empty to use <prefix>-<id>.surge.sh.',
  'shares.title': 'Active links',
  'shares.hint': 'Revoking returns 404 immediately and deletes the local snapshot.',
  'shares.empty': 'Nothing shared yet.',
  'shares.loading': 'Loading…',
  'shares.revoke': 'Revoke',
  'shares.revoking': 'Revoking…',
  'shares.session': 'session',
  'shares.file': 'file',
}
