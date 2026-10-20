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
  return cfg.tunnelMode === 'named' ? 'named' : 'quick'
}

/** 每个渠道的说明、步骤、入口链接与需要的字段——普通用户只看这里。 */
const CHANNEL_INFO = {
  quick: {
    name: (t) => t('channel.quick'),
    desc: (t) => t('channel.quick.desc'),
    fields: [],
    steps: () => [],
  },
  surge: {
    name: (t) => t('channel.surge'),
    desc: (t) => t('channel.surge.desc'),
    fields: ['surgeToken'],
    steps: (t) => [t('step.surge.1'), t('step.surge.2')],
    link: { href: 'https://surge.sh/', text: (t) => t('link.surge') },
  },
  named: {
    name: (t) => t('channel.named'),
    desc: (t) => t('channel.named.desc'),
    fields: ['tunnelToken', 'tunnelHostname'],
    steps: (t) => [t('step.named.1'), t('step.named.2'), t('step.named.3')],
    link: { href: 'https://one.dash.cloudflare.com/', text: (t) => t('link.cf') },
  },
  lan: {
    name: (t) => t('channel.lan'),
    desc: (t) => t('channel.lan.desc'),
    fields: [],
    steps: () => [],
  },
}

const FIELD_SPEC = {
  port: { kind: 'number', secret: false },
  ttlHours: { kind: 'number', secret: false },
  tunnelToken: { kind: 'text', secret: true },
  tunnelHostname: { kind: 'text', secret: false },
  surgeLogin: { kind: 'text', secret: false },
  surgeToken: { kind: 'text', secret: true },
  surgeDomain: { kind: 'text', secret: false },
  surgePrefix: { kind: 'text', secret: false },
  surgeLogin: { kind: 'text', secret: false },
}

const el = h

/** 单字段：本地缓冲，失焦 / 回车提交；被拒时回读宿主值。 */
function Field(props) {
  const { fieldKey, value, disabled, secret, numeric, t, onCommit, resetToken } = props
  const [reveal, setReveal] = React.useState(false)
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
    el(
      'span',
      { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
      el('input', {
        type: secret && !reveal ? 'password' : numeric ? 'number' : 'text',
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
      secret
        ? el('button', {
            type: 'button',
            'data-reveal': fieldKey,
            title: reveal ? t('hide') : t('show'),
            onClick: () => setReveal((value) => !value),
            style: {
              height: 30, padding: '0 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              border: '0.5px solid var(--dsw-alias-border-l2)', background: 'transparent',
              color: 'var(--dsw-alias-label-tertiary)',
            },
          }, reveal ? t('hide') : t('show'))
        : null,
    ),
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

/** 复制一条命令（用在 surge login 这类"必须开终端"的步骤上）。 */
function CopyCommand(props) {
  const { command, t } = props
  const [done, setDone] = React.useState(false)
  return el('button', {
    type: 'button',
    'data-copy-command': command,
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(command)
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      } catch {
        /* 手动选中即可 */
      }
    },
    style: {
      height: 26, padding: '0 9px', borderRadius: 7, cursor: 'pointer',
      border: '0.5px solid var(--dsw-alias-border-l2)', background: 'transparent',
      color: 'var(--dsw-alias-label-secondary)', fontSize: 12,
    },
  }, done ? t('copied') : t('copy'))
}

/** 设置卡本体。 */
export function SettingsCard(props) {
  const state = props.useShareSettings((value) => value)
  const t = props.t
  const [resetToken, setResetToken] = React.useState(0)
  const [failed, setFailed] = React.useState('')
  const [advanced, setAdvanced] = React.useState(false)
  const [status, setStatus] = React.useState(null)
  const [openSection, setOpenSection] = React.useState(null)
  const channel = state.value?.defaultChannel ?? 'quick'

  React.useEffect(() => {
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
  }, [channel])

  if (props.view === 'summary') return t('summary')
  if (!state.available) return null
  const disabled = state.writable === false

  const commit = (path, value) => {
    setFailed('')
    Promise.resolve(props.write(path, value)).catch((failure) => {
      setFailed(String(failure?.message ?? failure))
      setResetToken((n) => n + 1)
    })
  }
  const readiness = (id) => status?.channels?.[id]

  const field = (key) =>
    el(Field, {
      key,
      fieldKey: key,
      value: state.value[key],
      disabled,
      secret: (FIELD_SPEC[key] ?? {}).secret === true,
      numeric: (FIELD_SPEC[key] ?? {}).kind === 'number',
      t,
      resetToken,
      onCommit: (name, value) => commit(name, value),
    })

  /** 可折叠的通道配置块（Surge / 命名隧道）。 */
  const section = (id, fieldKeys) => {
    const info = CHANNEL_INFO[id]
    const ready = readiness(id)
    const open = openSection === id || (openSection === null && ready !== undefined && ready.ready === false)
    return el(
      'div',
      { key: id, 'data-share-section': id, style: { marginTop: 10, border: '0.5px solid var(--dsw-alias-border-l2)', borderRadius: 12 } },
      el(
        'button',
        {
          type: 'button',
          onClick: () => setOpenSection((value) => (value === id ? '' : id)),
          style: {
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
            background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', fontSize: 13,
          },
        },
        el('span', { style: { fontWeight: 500 } }, info.name(t)),
        el('span', {
          'data-share-ready': ready === undefined ? 'unknown' : ready.ready ? 'yes' : 'no',
          style: {
            fontSize: 11.5, padding: '1px 8px', borderRadius: 999,
            color: ready?.ready ? '#1f9d63' : '#96631a',
            background: ready?.ready ? 'rgba(31,157,99,.10)' : 'rgba(183,121,31,.12)',
          },
        }, ready === undefined ? t('checking') : ready.ready ? t('ready') : ready.detail),
        el('span', { style: { flex: 1 } }),
        el('span', { style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 } }, open ? '▾' : '▸'),
      ),
      open
        ? el(
            'div',
            { style: { padding: '0 14px 12px' } },
            el('p', { style: { margin: '0 0 6px', fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, info.desc(t)),
            (info.steps === undefined ? [] : info.steps(t)).length === 0
              ? null
              : el(
                  'ol',
                  { style: { margin: '4px 0 10px', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.9, color: 'var(--dsw-alias-label-secondary)' } },
                  info.steps(t).map((step, index) => el('li', { key: index }, step)),
                ),
            info.link === undefined
              ? null
              : el('div', { style: { margin: '0 0 10px' } }, el('a', {
                  href: info.link.href, target: '_blank', rel: 'noreferrer', 'data-share-outbound': info.link.href,
                  style: {
                    display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px',
                    borderRadius: 7, fontSize: 12, textDecoration: 'none', color: 'var(--dsw-alias-brand, #4d6bfe)',
                    border: '0.5px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-elevated, #fff)',
                  },
                }, info.link.text(t), ' ↗')),
            el('div', { style: { display: 'flex', flexDirection: 'column' } }, fieldKeys.map(field)),
          )
        : null,
    )
  }

  return el(
    'div',
    { 'data-dsh-share-link-settings': '', style: { display: 'flex', flexDirection: 'column' } },

    // 状态：默认通道能不能用
    status === null
      ? null
      : el(
          'div',
          {
            'data-share-status': readiness(channel)?.ready ? 'ready' : 'blocked',
            style: {
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
              fontSize: 12.5, marginBottom: 16,
              background: readiness(channel)?.ready ? 'rgba(31,157,99,.08)' : 'rgba(183,121,31,.10)',
              color: readiness(channel)?.ready ? '#1f9d63' : '#96631a',
            },
          },
          el('span', { style: { width: 7, height: 7, borderRadius: 999, background: 'currentColor', flex: 'none' } }),
          el('span', null, `${readiness(channel)?.ready ? t('ready') : t('notReady')} · ${CHANNEL_INFO[channel].name(t)}`),
        ),

    // 默认通道（不是"当前通道"，只是弹窗里的默认选项）
    el('div', { style: { fontSize: 13, fontWeight: 500, margin: '0 0 2px' } }, t('default.title')),
    el('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', marginBottom: 10 } }, t('default.hint')),
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
          onClick: () => commit('defaultChannel', item.id),
          style: {
            height: 32, padding: '0 12px', fontSize: 12.5, borderRadius: 9, cursor: 'pointer',
            border: item.id === channel ? '1px solid var(--dsw-alias-brand, #4d6bfe)' : '0.5px solid var(--dsw-alias-border-l2)',
            background: item.id === channel ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
            color: item.id === channel ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
            fontWeight: item.id === channel ? 600 : 400,
          },
        }, item.labelKey === 'channel.quick' ? `${t(item.labelKey)} · ${t('recommended')}` : t(item.labelKey)),
      ),
    ),

    // 各通道自己的配置（互不排斥）
    section('surge', ['surgeToken']),
    section('named', ['tunnelToken', 'tunnelHostname']),

    failed === '' ? null : el('p', { role: 'status', style: { margin: '10px 0 0', fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' } }, t('writeFailed')),

    el('button', {
      type: 'button',
      'data-share-advanced': 'toggle',
      onClick: () => setAdvanced((value) => !value),
      style: {
        alignSelf: 'flex-start', marginTop: 14, height: 26, padding: '0 8px', borderRadius: 7,
        border: 0, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12, cursor: 'pointer',
      },
    }, `${advanced ? '▾' : '▸'} ${t('advanced')}`),
    advanced
      ? el(
          'div',
          { style: { marginTop: 6, padding: '4px 0 0 12px', borderLeft: '2px solid var(--dsw-alias-border-l2)' } },
          el('p', { style: { margin: '0 0 4px', fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('advanced.hint')),
          ['port', 'ttlHours', 'surgeDomain', 'surgePrefix'].map((key) => field(key)),
        )
      : null,

    el('div', { style: { fontSize: 13, fontWeight: 500, margin: '20px 0 0' } }, t('shares.title')),
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
  recommended: '推荐',
  checking: '检查中',
  'default.title': '默认分享通道',
  'default.hint': '只决定分享弹窗里默认选中哪个；弹窗里随时可以临时换通道。',
  ready: '可以分享',
  notReady: '还不能分享',
  advanced: '高级设置',
  'advanced.hint': '一般不用改：端口、默认有效期、Surge 域名后缀。',
  'channel.quick.desc': '零配置：dsh 在跑就有链接，重启换域名。适合临时发给别人看一眼。首次使用会自动下载 cloudflared（约 50 MB，需要能访问 GitHub）。',
  'channel.surge.desc': '免费账号即可，得到永久固定域名，随时可撤销。',
  'channel.named.desc': '需要你自己在 Cloudflare 建隧道并绑定域名。没有自有域名请直接选 Surge。',
  'channel.lan.desc': '只在同一局域网可访问，不出公网。',
  'step.surge.1': '用邮箱在 surge.sh 注册并登录（免费）',
  'step.surge.2': '在终端运行 surge login；或把 surge tokens add 生成的 token 填到下面',
  'link.surge': '打开 surge.sh',
  copy: '复制',
  copied: '已复制',
  show: '显示',
  hide: '隐藏',
  'surge.localLogin': '已使用本机 Surge 登录态，不用填任何东西',
  'surge.useToken': '改用 token',
  'step.named.1': 'Cloudflare Zero Trust → Networks → Tunnels → 创建隧道',
  'step.named.2': '给隧道加 Public Hostname，指向 localhost:3089',
  'step.named.3': '把隧道 token 和完整域名填到下面',
  'link.cf': '打开 Cloudflare Zero Trust',
  'field.surgePrefix': '子域前缀',
  readOnly: '当前部署只读，无法修改。',
  writeFailed: '刚才的改动未被接受，已回读当前值。',
  'channel.title': '发布渠道',
  'channel.hint': '选一个渠道，填好参数就能在会话右上角或文件预览里直接出链接。',
  'channel.quick': '快速隧道',
  'channel.named': '命名隧道（自有域名）',
  'channel.surge': 'Surge',
  'channel.lan': '仅局域网',
  'field.port': '分享服务端口',
  'field.port.hint': '0 = 随机端口；命名隧道模式必须固定（默认 3089）。',
  'field.ttlHours': '默认有效期（小时）',
  'field.ttlHours.hint': '到期后链接自动失效；撤销是立即失效。',
  'field.tunnelToken': 'Cloudflare 隧道 token',
  'field.tunnelToken.hint': 'Zero Trust → Networks → Tunnels 里那条隧道的 token。',
  'field.tunnelHostname': '对外域名',
  'field.tunnelHostname.hint': '必须是那条隧道 Routes 里的 Public Hostname（形如 dsh-share-contents.你的域名），Service 指向 localhost:3089。',
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
  recommended: 'recommended',
  checking: 'checking',
  'default.title': 'Default channel',
  'default.hint': 'Only sets what the share dialog preselects; you can switch per share in the dialog.',
  ready: 'Ready to share',
  notReady: 'Not ready yet',
  advanced: 'Advanced',
  'advanced.hint': 'Usually not needed: port, default lifetime, Surge domain suffix.',
  'channel.quick.desc': 'Zero config: the link lives as long as dsh runs; the hostname changes on restart. On first use it downloads cloudflared (~50 MB, needs GitHub access).',
  'channel.surge.desc': 'Free account is enough; you get a stable domain that you can revoke any time.',
  'channel.named.desc': 'Requires a tunnel you create in Cloudflare plus a domain you own. No domain? Pick Surge.',
  'channel.lan.desc': 'Same network only; nothing leaves your machine.',
  'step.surge.1': 'Sign up / sign in at surge.sh with an email (free)',
  'step.surge.2': 'Run `surge login` in a terminal, or paste a `surge tokens add` token below',
  'link.surge': 'Open surge.sh',
  copy: 'Copy',
  copied: 'Copied',
  show: 'Show',
  hide: 'Hide',
  'surge.localLogin': 'Using this machine\'s Surge login — nothing to fill in',
  'surge.useToken': 'Use a token instead',
  'step.named.1': 'Cloudflare Zero Trust → Networks → Tunnels → create a tunnel',
  'step.named.2': 'Add a Public Hostname pointing at localhost:3089',
  'step.named.3': 'Paste the tunnel token and the full hostname below',
  'link.cf': 'Open Cloudflare Zero Trust',
  'field.surgePrefix': 'Subdomain prefix',
  readOnly: 'This deployment is read-only.',
  writeFailed: 'That change was not accepted; values were re-read.',
  'channel.title': 'Publishing channel',
  'channel.hint': 'Pick one channel and fill in its settings; shares then work from the session menu or a file preview.',
  'channel.quick': 'Quick tunnel',
  'channel.named': 'Named tunnel (own domain)',
  'channel.surge': 'Surge',
  'channel.lan': 'LAN only',
  'field.port': 'Share server port',
  'field.port.hint': '0 = random. Named tunnels need a fixed port (3089 by default).',
  'field.ttlHours': 'Default lifetime (hours)',
  'field.ttlHours.hint': 'Links expire after this; revoking kills them immediately.',
  'field.tunnelToken': 'Cloudflare tunnel token',
  'field.tunnelToken.hint': 'From Zero Trust → Networks → Tunnels.',
  'field.tunnelHostname': 'Public hostname',
  'field.tunnelHostname.hint': 'Must be the Public Hostname route of that tunnel (e.g. dsh-share-contents.your-domain.com), pointing at localhost:3089.',
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
