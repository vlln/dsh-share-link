/**
 * 会话快照 → 自包含只读 HTML。
 *
 * 设计约束：产物是**纯静态**（无脚本、无外链），所以它既能进隧道，也能直接
 * 发给别人离线打开；同时把「JS 能不能执行」这一整类风险从分享面里去掉。
 *
 * @module dsh-share-link/session-page
 */

import { createHash } from 'node:crypto'

import MarkdownIt from 'markdown-it'

import { FONT_FACE_CSS } from './article-fonts.mjs'

/**
 * `.md` 分享专用的渲染器。
 *
 * 与 `renderBody`（会话正文）刻意分开：助手输出不该被当成 HTML 解释——那会把
 * 「模型随手写了个 `<div>`」变成页面结构。而 README 这类产物是用户自己写的
 * 文件，`<h1 align="center">`、徽章、`<details>` 必须照原样呈现，否则整块会变成
 * 一行转义文本（实测就是这么坏的）。
 *
 * 渲染结果仍然过 `sanitizeHtml`：允许排版标签，不允许脚本、样式与表单。
 */
const DOC_MD = new MarkdownIt({ html: true, linkify: true, breaks: false })

// .md 里的代码块复用会话页那套「语言标签 + 复制按钮」外壳（`codeBlockHtml`），
// 观感一致；白名单必须放行 `div` / `span` / `button` / `class` / `data-copy`，
// 漏一个复制按钮就会被 sanitize 掉。
DOC_MD.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]
  const lang = token.info.trim().split(/\s+/)[0] ?? ''
  return codeBlockHtml(lang, token.content.replace(/\n$/, ''))
}

/**
 * 允许出现在分享页里的标签：GitHub README 的常见排版集合。
 *
 * 显式不含 `script` / `style` / `iframe` / `object` / `embed` / `form` / `input`：
 * 分享页是别人打开的只读页面，唯一允许执行的脚本是插件自己的复制按钮。
 */
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'big', 'blockquote', 'br', 'button', 'caption', 'center', 'code', 'dd', 'del', 'details',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'picture', 'pre', 's', 'small', 'source', 'span',
  'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  'video', 'audio',
])

/** 自闭合标签：`<br>` 这类不需要（也不允许）配对。 */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'source', 'wbr'])

/** 允许保留的属性；`on*` 一律不在名单里，所以事件处理器会被丢掉。 */
const ALLOWED_ATTRS = new Set([
  'align', 'alt', 'class', 'colspan', 'controls', 'data-copy', 'data-lang', 'height', 'href', 'loading',
  'poster', 'rowspan', 'src', 'start', 'title', 'type', 'valign', 'width',
])

/** 需要校验协议的属性（`javascript:` 之类必须挡掉）。 */
const URL_ATTRS = new Set(['href', 'src', 'poster'])

/** HTML 命名实体 → 字符：只需覆盖能拼出协议名的那几个（`&#58;` `&colon;` 等）。 */
const ENTITY_NAMES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t', newline: '\n', nbsp: ' ',
}

/** @param {number} code @returns {string} */
function codePointChar(code) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\uFFFD'
}

/**
 * 解 HTML 实体。
 *
 * 必须在**校验协议之前**做：`java&#115;cript:` 在浏览器里就是 `javascript:`，
 * 但它不是合法 URL 的 scheme，正则看不出来。同理命名实体 `&colon;`。
 * @param {string} value
 */
function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => codePointChar(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => codePointChar(Number.parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);?/gi, (match, name) => ENTITY_NAMES[name.toLowerCase()] ?? match)
}

/**
 * URL 属性的归一化形式：解实体 + 去掉控制字符与空白 + 小写。
 *
 * 三类绕过全靠这一步：实体（`&#115;`）、换行（`java\nscript:`——WHATWG URL
 * 解析器会先剥掉 tab/换行）、以及首尾空白。
 * @param {string} value
 */
function normalizeUrl(value) {
  return decodeEntities(value).replace(/[\u0000-\u0020\u007f]+/g, '').toLowerCase()
}

/**
 * 过滤一段 HTML：只留白名单标签与属性。
 *
 * 这是**字符串级**过滤，不是 HTML 解析器——够用是因为输入只来自 markdown-it 的
 * 输出（结构已知、文本已转义），而它要挡的东西很具体：脚本、内联事件、
 * `javascript:` 协议、以及 `<style>` 这类能整页变形的块。
 *
 * 两条铁律（2026-10-22 补）：
 * 1. **重新拼出来的属性值必须再转义一遍**。原值可能来自单引号属性
 *    （`src='x" onerror=…'`），原样拼进双引号就会提前闭合属性、凭空造出一个
 *    `onerror`——这是实测能执行的一种绕过。
 * 2. **协议校验看归一化后的值**，不看原始字节。
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  return (
    String(html)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|iframe|object|embed|form|textarea|template)\b[\s\S]*?<\/\1\s*>/gi, '')
      // 标签匹配要尊重引号：`<a href="x>y">` 与 `<a title="<b>">` 在浏览器里都是
      // 一个标签（引号内的 `<` `>` 不结束它），而 `/<[^>]*>/` 会把它们切碎，
      // 切碎之后就绕过了属性白名单。
      .replace(TAG_CLOSE, (tag) => filterTag(tag))
      .replace(TAG_OPEN, (tag) => filterTag(tag))
  )
}

/** 结束标签：`</p>`。 */
const TAG_CLOSE = /<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/g

/** 开始标签：属性值可以带引号，引号内允许出现 `<` `>`。 */
const TAG_OPEN =
  /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g

/**
 * 属性值再转义。
 *
 * 只转 `"` `<` `>`，**不转 `&`**：属性值里的实体在分词之后才解码，不可能借此
 * 闭合属性；而把 `&` 再转一遍会把用户本来正确的 `&amp;` 变成 `&amp;amp;`，
 * 链接里的查询串就废了（实测 `?x=1&amp;y=2` 会变成字面量 `&amp;`）。
 * @param {string} value @returns {string}
 */
function escapeAttr(value) {
  return String(value)
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** @param {string} tag @returns {string} */
function filterTag(tag) {
  const inner = tag.replace(/>$/, '').replace(/^</, '')
  const selfClosing = inner.endsWith('/')
  const body = selfClosing ? inner.slice(0, -1) : inner
  const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(body)
  if (nameMatch === null) return ''
  const name = nameMatch[1].toLowerCase()
  if (!ALLOWED_TAGS.has(name)) return ''
  if (body.startsWith('/')) return VOID_TAGS.has(name) ? '' : `</${name}>`

  const attributes = []
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  for (const match of body.slice(nameMatch[0].length).matchAll(attrRe)) {
    const key = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4]
    if (!ALLOWED_ATTRS.has(key)) continue
    if (value === undefined) {
      attributes.push(key)
      continue
    }
    if (URL_ATTRS.has(key) && !isSafeUrl(normalizeUrl(value), key)) continue
    attributes.push(`${key}="${escapeAttr(value)}"`)
  }
  const open = `<${name}${attributes.length === 0 ? '' : ` ${attributes.join(' ')}`}>`
  return open
}

/**
 * 只放行 http(s) / mailto / 站内相对路径 / `src` 上的 `data:image/*`。
 *
 * `data:` 只给图片类属性：`<a href="data:text/html,…">` 是钓鱼页的经典载体。
 * @param {string} value 已归一化（解实体、去空白、小写）
 * @param {string} key 属性名
 * @returns {boolean}
 */
function isSafeUrl(value, key = '') {
  const url = value.trim()
  if (url === '') return false
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url)
  if (scheme === null) return true
  if (scheme[1] === 'http' || scheme[1] === 'https' || scheme[1] === 'mailto') return true
  if (scheme[1] !== 'data') return false
  return (key === 'src' || key === 'poster') && url.startsWith('data:image/')
}

/**
 * 把发布时抓下来的公网图片（`{url: dataUri}`）替换进 `<img src>`。
 *
 * 放在 sanitize 之后做：data URI 是我们自己构造的、字节是校验过的图片内容，
 * 不需要再过一遍白名单；而不替换就等于页面要去外网加载图片，破坏「离线可读」。
 *
 * @param {string} html
 * @param {Map<string, string>} [images]
 * @returns {string}
 */
function substituteImages(html, images) {
  if (!(images instanceof Map) || images.size === 0) return html
  let output = html
  for (const [url, dataUri] of images) {
    output = output.split(`src="${url}"`).join(`src="${dataUri}"`)
    output = output.split(`src="${escapeHtml(url)}"`).join(`src="${dataUri}"`)
  }
  return output
}

/** 正文里会被脱敏的凭据形态。顺序有意义：先长 token，再泛化键值对。 */
const SECRET_RULES = [
  [/\b(sk|rk)-[A-Za-z0-9_-]{16,}\b/g, '$1-***'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, 'gh*_***'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, 'github_pat_***'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA***'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{12,}=*/g, '$1 ***'],
  [/((?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[:=]\s*)["']?[^\s"'`,;]{8,}/gi, '$1***'],
];

/** 把绝对家目录压成 `~`：分享页里出现 `/Users/xxx` 等于泄露用户名。 */
function scrubHomePaths(text) {
  // 只压「独立出现」的家目录（行首 / 空白 / 引号 / 括号之后）：否则
  // `https://example.com/home/docs` 这种 URL 会被压成 `https://example.com~`。
  return text
    .replace(/(^|[\s"'(\[])(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)(?=[/\\\s"'),\]]|$)/g, '$1~')
    .replace(/(^|[\s"'(\[])[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/g, '$1~');
}

/** 复制按钮的最小内联脚本：只做剪贴板，不发任何外部请求。 */
const STAR_URL = 'https://github.com/vlln/dsh-share-link';

/**
 * 复制脚本。
 *
 * 三条实测约束（改之前先看这里）：
 * 1. **必须有 `execCommand` 回退**：局域网分享走 `http://192.168.x.x:port`，不是
 *    安全上下文，`navigator.clipboard` 直接是 `undefined`，只有回退能复制。
 * 2. **按「离按钮最近的容器」取文本**：代码块取 `pre code` 的 `textContent`（保留
 *    原始换行），消息取 `[data-copy-body]` 的 `innerText`（折叠成可读文本），全文
 *    取 `[data-copy-source]`。别再用 `closest('.code')` 那种按类名猜的老写法——
 *    消息里的「复制」按钮根本不在 `.code` 里，取到的是空串（还照样显示「已复制」）。
 * 3. 拿不到内容就**什么都不做**，不要假装复制成功。
 *
 * **CSP 的 hash 只算脚本正文**，不算 `<script>` 标签。0.7.2 之前 hash 是把标签
 * 一起算的，于是浏览器永远对不上、整段脚本被拦掉——「复制」按钮其实一直是死的
 * （无头浏览器日志里那句 `Executing inline script violates ...` 就是它）。
 */
const COPY_SCRIPT_BODY = `
const pickText = (button) => {
  const kind = button.dataset.copy;
  if (kind === 'link') return location.href;
  if (kind === 'code') return button.closest('.code-block')?.querySelector('pre code')?.textContent ?? '';
  if (kind === 'message') return button.closest('.turn')?.querySelector('[data-copy-body]')?.innerText ?? '';
  const source = document.querySelector('[data-copy-source]');
  if (source === null) return '';
  // 会话页：按轮次拼一份干净的逐字稿（带说话人），不要把轮次标签、工具名、
  // 「复制」按钮的文案一起抄进去。文档/目录页没有轮次，退回整块文本。
  const turns = [...source.querySelectorAll('.turn')];
  if (turns.length === 0) return source.innerText;
  return turns.map((turn) => (
    (turn.classList.contains('turn--user') ? '你：' : '助手：') + '\\n' +
    (turn.querySelector('.turn__body')?.innerText ?? '')
  )).join('\\n\\n');
};
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]');
  if (button === null) return;
  const text = pickText(button).trimEnd();
  if (text === '') return;
  const label = button.querySelector('.copy-btn__label');
  const flash = () => {
    button.dataset.done = '1';
    if (label !== null) label.textContent = '已复制';
    setTimeout(() => {
      delete button.dataset.done;
      if (label !== null) label.textContent = '复制';
    }, 1400);
  };
  const legacyCopy = () => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (error) {}
    area.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(flash, () => { legacyCopy(); flash(); });
  } else {
    legacyCopy();
    flash();
  }
});
`;

const COPY_SCRIPT = `<script>${COPY_SCRIPT_BODY}</script>`;

/**
 * 页面 CSP。
 *
 * 分享页是给别人打开的内容页：白名单能挡掉大部分注入，但**挡住一整类**要靠
 * CSP——`script-src` 只放行下面这一段 hash，内联事件（`onerror=`）与任何注入
 * 的 `<script>` 都执行不了。`default-src 'none'` 顺带把 XHR/frame 也关掉。
 * `font-src data:` 是给内嵌 woff2 用的（页面仍然零外链）。
 *
 * 用 `<meta>` 而不是响应头：分享页可以被另存成本地文件打开，那时没有头。
 */
export const PAGE_CSP =
  `default-src 'none'; img-src http: https: data:; media-src http: https:; font-src data:; ` +
  `style-src 'unsafe-inline'; script-src 'sha256-${createHash('sha256').update(COPY_SCRIPT_BODY).digest('base64')}'; ` +
  `base-uri 'none'; form-action 'none'`

/** CSP meta 标签（三套页面共用）。 */
const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">`

/**
 * 分享页主样式：DeepSeek 博客文章版式。
 *
 * 样板是 https://cdn.deepseek.com/harness/dsh-creator-mode-prompt-collection-zh.html
 * （它自己是 deepseek.com/news 文章模板的复刻）：渐变标题区 + 640px 居中正文 +
 * 500 字重的标题层级 + 圆角代码块工具条。这里**整套版式就是基态**，主题只覆盖
 * `:root` 里的变量，所以换主题不会把版式换成另一套。
 *
 * 变量（用户自定义 CSS 也只需要这几个）：
 * `--bg --paper --fg --muted --line --line-subtle --code-bg --surface --accent --star --font-sans --font-mono`。
 * `--muted/--line/--code-bg/--surface` 都由 `--fg` 派生（`color-mix`），所以主题
 * 只要给 `--bg --fg --accent` 就能整套适配，包括深色的 `terminal`。
 */
const PAGE_CSS = `  :root {
    color-scheme: light;
    --bg: #f9f8f8; --paper: #ffffff; --fg: #1e232c; --accent: #4d6bfe; --star: var(--accent);
    --muted: color-mix(in srgb, var(--fg) 68%, transparent);
    --line: color-mix(in srgb, var(--fg) 12%, transparent);
    --line-subtle: color-mix(in srgb, var(--fg) 7%, transparent);
    --code-bg: color-mix(in srgb, var(--fg) 5%, transparent);
    --surface: color-mix(in srgb, var(--fg) 3%, transparent);
    --hero-tint: color-mix(in srgb, var(--accent) 5%, color-mix(in srgb, var(--fg) 4%, var(--paper)));
    --font-sans: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
    --font-mono: "Fragment Mono", ui-monospace, SFMono-Regular, Menlo, Consolas,
      "PingFang SC", "Microsoft YaHei", monospace;
    --radius: 12px;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: var(--font-sans); line-height: 180%;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  ::selection { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .page { position: relative; min-height: 100vh; background: var(--paper); }

  /* ---------- 标题区 ---------- */
  .hero {
    padding: 64px 24px 44px;
    background: linear-gradient(var(--hero-tint) 0%, var(--paper) 100%);
  }
  .hero--compact { padding: 44px 24px 32px; }
  .hero__inner { max-width: 720px; margin: 0 auto; text-align: center; }
  .hero__eyebrow {
    margin: 0 0 18px; font-size: 11.5px; font-weight: 500; line-height: 1.4;
    letter-spacing: .14em; text-transform: uppercase; color: var(--muted);
  }
  .hero__title {
    margin: 0; font-size: 30px; font-weight: 500; line-height: 122%;
    letter-spacing: -.02em; color: var(--fg); overflow-wrap: anywhere;
    /* 长标题别折成「12 个字 + 1 个字」：能平衡就平衡，老浏览器忽略这条。 */
    text-wrap: balance;
  }
  .hero__meta { margin: 18px 0 0; font-size: 13px; line-height: 165%; color: var(--muted); }
  .hero__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 22px; }

  /* ---------- 正文栏 ---------- */
  .ds-blog-main { width: 100%; max-width: 688px; margin: 0 auto; padding: 0 24px 88px; }
  .ds-prose { min-width: 0; font-family: var(--font-sans); line-height: 180%; color: var(--fg); }
  .ds-prose p { margin: 0 0 24px; font-size: 16px; line-height: 180%; }
  .ds-prose > :first-child, .turn__body > :first-child { margin-top: 0; }
  .ds-prose > :last-child, .turn__body > :last-child { margin-bottom: 0; }

  .ds-prose h1, .ds-prose h2, .ds-prose h3,
  .ds-prose h4, .ds-prose h5, .ds-prose h6 {
    font-weight: 500; color: var(--fg); letter-spacing: 0; scroll-margin-top: 80px;
  }
  .ds-prose h1 { font-size: 30px; line-height: 140%; margin: 64px 0 20px; }
  .ds-prose h2 { font-size: 24px; line-height: 140%; margin: 48px 0 16px; }
  .ds-prose h3 { font-size: 20px; line-height: 150%; margin: 36px 0 12px; }
  .ds-prose h4 { font-size: 17px; line-height: 150%; margin: 28px 0 8px; }
  .ds-prose h5 { font-size: 16px; line-height: 150%; margin: 24px 0 8px; }
  .ds-prose h6 { font-size: 14px; line-height: 150%; margin: 24px 0 8px; color: var(--muted); }

  .ds-prose a {
    color: var(--fg); text-decoration: underline; text-decoration-style: dashed;
    text-underline-offset: 3px; text-decoration-thickness: 1px; transition: opacity .15s;
  }
  .ds-prose a:hover { opacity: .7; }
  .ds-prose a[target="_blank"]::after {
    content: ""; display: inline-block; width: 11px; height: 11px; margin-left: 2px;
    background: currentColor; vertical-align: baseline;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M5 3h8v8M13 3L3 13' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M5 3h8v8M13 3L3 13' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  .ds-prose ul, .ds-prose ol { margin: 0 0 24px; padding-left: 24px; }
  .ds-prose ul { list-style: disc; }
  .ds-prose ol { list-style: decimal; }
  .ds-prose li { font-size: 16px; line-height: 180%; margin: 0 0 8px; }
  .ds-prose li:last-child { margin-bottom: 0; }
  .ds-prose li > ul, .ds-prose li > ol { margin: 8px 0 0; }

  .ds-prose blockquote {
    margin: 24px 0; padding-left: 24px; border-left: 3px solid var(--line); color: var(--muted);
  }
  .ds-prose blockquote p { margin-bottom: 0; color: inherit; }

  .ds-prose img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .ds-prose figure { margin: 32px 0; }
  .ds-prose figcaption { margin-top: 10px; font-size: 13px; line-height: 150%; color: var(--muted); text-align: center; }
  .ds-prose hr { border: 0; border-top: 1px solid var(--line-subtle); margin: 40px 0; }
  .ds-prose small { display: block; font-size: 13px; line-height: 150%; color: var(--muted); }
  .ds-prose strong { font-weight: 500; }
  .ds-prose mark { background: color-mix(in srgb, var(--accent) 18%, transparent); color: inherit; }
  .ds-prose kbd {
    font-family: var(--font-mono); font-size: 12px; padding: 1px 5px;
    border: 1px solid var(--line); border-radius: 5px; background: var(--code-bg);
  }
  .ds-prose details {
    margin: 24px 0; padding: 12px 16px;
    border: 1px solid var(--line-subtle); border-radius: var(--radius);
  }
  .ds-prose summary { cursor: pointer; color: var(--muted); }
  .ds-prose summary:hover { color: var(--fg); }

  /* ---------- 表格 ---------- */
  .table-wrap {
    margin: 24px 0; border: 1px solid var(--line); border-radius: var(--radius); overflow-x: auto;
  }
  .ds-prose table { width: 100%; border-collapse: collapse; font-size: 15px; }
  .ds-prose th { text-align: left; font-weight: 500; background: var(--surface); }
  .ds-prose th, .ds-prose td {
    line-height: 150%; padding: 12px 16px; border-bottom: 1px solid var(--line);
  }
  .ds-prose tr:last-child td, .ds-prose tr:last-child th { border-bottom: 0; }

  /* ---------- 代码块 ---------- */
  .ds-prose code {
    font-family: var(--font-mono); font-size: 13.5px; padding: 2px 6px;
    border-radius: 8px; background: var(--code-bg); color: var(--fg);
  }
  .code-block {
    margin: 24px 0; border: 1px solid var(--line-subtle); border-radius: var(--radius);
    background: var(--code-bg); overflow: hidden;
  }
  .code-block__bar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 7px 7px 7px 14px; border-bottom: 1px solid var(--line-subtle);
    background: color-mix(in srgb, var(--paper) 42%, transparent);
  }
  .code-block__lang {
    font-family: var(--font-mono); font-size: 11.5px; line-height: 1; letter-spacing: .02em;
    color: var(--muted);
  }
  .code-block pre { margin: 0; padding: 20px 24px; overflow-x: auto; }
  .code-block pre code {
    display: block; padding: 0; border-radius: 0; background: none;
    font-size: 13.5px; line-height: 170%; white-space: pre-wrap; overflow-wrap: anywhere;
  }

  .copy-btn {
    appearance: none; display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px;
    background: color-mix(in srgb, var(--paper) 72%, transparent); color: var(--fg);
    font-family: var(--font-sans); font-size: 12px; line-height: 1; font-weight: 400;
    cursor: pointer;
    transition: background .15s, border-color .15s, color .15s;
  }
  .copy-btn::before {
    content: ""; flex: none; width: 12px; height: 12px; background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Crect x='5.75' y='5.75' width='7.5' height='7.5' rx='1.6' stroke='currentColor' stroke-width='1.3'/%3E%3Cpath d='M10.25 3.75v-.5a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h.5' stroke='currentColor' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Crect x='5.75' y='5.75' width='7.5' height='7.5' rx='1.6' stroke='currentColor' stroke-width='1.3'/%3E%3Cpath d='M10.25 3.75v-.5a1.5 1.5 0 0 0-1.5-1.5h-5a1.5 1.5 0 0 0-1.5 1.5v5a1.5 1.5 0 0 0 1.5 1.5h.5' stroke='currentColor' stroke-width='1.3' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
  }
  .copy-btn:hover { background: var(--paper); border-color: color-mix(in srgb, var(--fg) 28%, transparent); }
  .copy-btn:active { background: var(--surface); }
  .copy-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .copy-btn[data-done] {
    color: var(--accent); border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 6%, transparent);
  }

  /* ---------- 会话轮次 ---------- */
  .turn { margin: 0 0 44px; }
  .turn:last-child { margin-bottom: 0; }
  .turn__meta { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; }
  .turn__role {
    font-size: 11.5px; font-weight: 500; line-height: 1; letter-spacing: .1em;
    text-transform: uppercase; color: var(--muted);
  }
  .turn__time { font-family: var(--font-mono); font-size: 11px; color: var(--muted); }
  .turn__grow { flex: 1; }
  .turn__copy {
    appearance: none; border: 0; background: none; padding: 0; cursor: pointer;
    font-family: var(--font-sans); font-size: 11.5px; color: var(--muted);
    opacity: .6; transition: opacity .15s, color .15s;
  }
  .turn:hover .turn__copy, .turn__copy:focus-visible { opacity: 1; }
  .turn__copy:hover { color: var(--fg); }
  .turn__copy[data-done] { color: var(--accent); opacity: 1; }
  .turn--user .turn__body { border-left: 3px solid var(--line); padding-left: 24px; color: var(--muted); }
  .turn--user .turn__body p, .turn--user .turn__body li, .turn--user .turn__body blockquote { color: inherit; }

  .tool-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 0; }
  .tool-chip {
    font-family: var(--font-mono); font-size: 11px; line-height: 1;
    color: var(--muted); border: 1px solid var(--line); border-radius: 6px; padding: 4px 7px;
  }

  /* ---------- 目录页 ---------- */
  .files { list-style: none; margin: 0; padding: 0; }
  .files li {
    display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
    padding: 14px 2px; border-bottom: 1px solid var(--line-subtle);
  }
  .files li:first-child { border-top: 1px solid var(--line-subtle); }
  .files a { color: var(--fg); text-decoration: none; font-size: 15px; overflow-wrap: anywhere; }
  .files a:hover { text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 3px; }
  .files span { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); white-space: nowrap; }

  /* ---------- 页脚 ---------- */
  .page-foot {
    display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
    margin: 64px 0 0; padding-top: 20px; border-top: 1px solid var(--line-subtle);
    font-size: 12px; line-height: 170%; color: var(--muted);
  }
  .page-foot .grow { flex: 1; }
  .page-foot a { color: var(--muted); text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 3px; }
  .page-foot a:hover { color: var(--fg); }
  .page-foot .star { color: var(--star); font-weight: 500; text-decoration: none; }
  .page-foot .star:hover { text-decoration: underline; }

  /* ---------- 断点：和博客一致，768px ---------- */
  @media (min-width: 768px) {
    .hero { padding: 120px 24px 80px; }
    .hero--compact { padding: 72px 24px 44px; }
    .hero__title { font-size: 44px; }
    .ds-blog-main { padding: 0 24px 104px; }
    .ds-prose h1 { font-size: 34px; }
    .ds-prose h2 { font-size: 26px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; }
  }
  @media print {
    body { background: #fff; }
    .hero { padding: 0 0 24px; background: none; }
    .copy-btn, .turn__copy { display: none !important; }
    .ds-blog-main { max-width: none; padding: 0; }
    .turn, .code-block { break-inside: avoid; }
  }`

/**
 * 对一段正文做尽力脱敏。**不是保证**：只挡常见凭据形态与家目录，
 * 挡不住业务机密、客户名、内网 IP。
 * @param {string} text - 原始文本。
 * @returns {string} 脱敏后的文本。
 */
export function redact(text) {
  let out = scrubHomePaths(String(text ?? ''));
  for (const [pattern, replacement] of SECRET_RULES) out = out.replace(pattern, replacement);
  return out;
}


/**
 * 分享页预设风格。
 *
 * **版式只有一套**（DeepSeek 文章模板，见 `PAGE_CSS`），预设只换配色与字体：
 * 深色 `terminal` 也是同一套版式，`--muted/--line/--code-bg/--surface` 由 `--fg`
 * 派生所以自动跟着变。
 */
export const PAGE_THEMES = ['article', 'paper', 'github', 'notion', 'sepia', 'terminal']

const THEME_CSS = {
  // 默认：deepseek.com 文章模板的原色（#1e232c 墨色 / #4d6bfe 品牌蓝 / #f9f8f8 纸面）
  article: `:root {
    --bg: #f9f8f8; --paper: #ffffff; --fg: #1e232c; --accent: #4d6bfe;
    --muted: rgba(0, 0, 0, .65); --hero-tint: #edf2f6;
  }`,
  // 暖纸：米白底，偏阅读
  paper: `:root {
    --bg: #f6f5f2; --paper: #fffefc; --fg: #1b1b1f; --accent: #3f5bd9;
    --muted: rgba(27, 27, 31, .66);
  }`,
  // GitHub README：白底、细边框、系统字体
  github: `:root {
    --bg: #ffffff; --paper: #ffffff; --fg: #1f2328; --accent: #0969da;
    --muted: rgba(31, 35, 40, .68); --line: #d8dee4; --line-subtle: #eaeef2;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica,
      Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
  }`,
  // Notion：极简、大留白
  notion: `:root {
    --bg: #ffffff; --paper: #ffffff; --fg: #37352f; --accent: #2383e2;
    --muted: rgba(55, 53, 47, .65); --line: #e9e9e7; --line-subtle: #f1f1ef;
  }`,
  // 散文/阅读：衬线、米色、宽行距
  sepia: `:root {
    --bg: #f4ecd8; --paper: #f7f0df; --fg: #3b2f22; --accent: #8a5a2b;
    --muted: rgba(59, 47, 34, .68);
    --font-sans: Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif;
  }
  .ds-prose p, .ds-prose li { line-height: 195%; }`,
  // 终端：暗色、等宽
  terminal: `:root {
    --bg: #0d1117; --paper: #0d1117; --fg: #c9d1d9; --accent: #3fb950;
    color-scheme: dark;
    --font-sans: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  .ds-prose p, .ds-prose li { font-size: 14.5px; }`,
}

/**
 * 生成某个风格的 CSS：预设变量 + 用户自定义覆盖（自定义永远最后生效）。
 * `custom` 表示「只用自定义」——那时连预设变量也不给，基态就是 `article`。
 * @param {string} [name]
 * @param {string} [custom]
 * @returns {string}
 */
export function themeCss(name, custom = '') {
  const base = name === 'custom' ? '' : (THEME_CSS[name] ?? THEME_CSS.article);
  // 只挡 style 提前闭合，用户自己的 CSS 允许任意内容
  const safe = String(custom ?? '').replace(/<\/style/gi, '<\\/style');
  if (safe.trim() === '') return base;
  return `${base}\n/* 自定义 */\n${safe}`;
}


/** @param {string} value */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 行内格式：行内代码、粗体、斜体。先转义再套标签。 */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
}

/**
 * 代码块外壳：语言标签 + 复制按钮，和博客一样。
 *
 * 会话正文与 `.md` 产物共用这一段，所以两边观感一致；图标是 CSS 的 mask（不进
 * DOM），因此 `.md` 的标签白名单不需要放行 `svg`。
 * @param {string} lang
 * @param {string} code
 */
function codeBlockHtml(lang, code) {
  const label = lang === '' ? 'code' : lang
  return (
    '<div class="code-block"><div class="code-block__bar">' +
    `<span class="code-block__lang">${escapeHtml(label)}</span>` +
    '<button class="copy-btn" type="button" data-copy="code" aria-label="复制这段代码">' +
    '<span class="copy-btn__label">复制</span></button></div>' +
    `<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code)}</code></pre></div>`
  )
}

/**
 * 极简 Markdown 渲染：标题、无序/有序列表、引用、分隔线、代码围栏、
 * 行内代码/粗体/斜体、段落。不引第三方库——分享页要能离线打开。
 * @param {string} text - 已脱敏的正文。
 * @returns {string} HTML 片段。
 */
function renderBody(text) {
  const chunks = String(text).split(/```/);
  const out = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (i % 2 === 1) {
      const chunk = chunks[i];
      const newline = chunk.indexOf('\n');
      const lang = newline === -1 ? '' : chunk.slice(0, newline).trim();
      const code = newline === -1 ? chunk : chunk.slice(newline + 1);
      out.push(codeBlockHtml(lang, code.replace(/\n$/, '')));
      continue;
    }
    out.push(renderBlocks(chunks[i]));
  }
  return out.join('\n');
}

/** @param {string} chunk */
function renderBlocks(chunk) {
  const lines = chunk.split('\n');
  const out = [];
  let index = 0;
  const isBlank = (line) => line.trim() === '';

  while (index < lines.length) {
    const line = lines[index];
    if (isBlank(line)) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading !== null) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoted = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      out.push(`<blockquote>${renderBlocks(quoted.join('\n'))}</blockquote>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length && !isBlank(lines[index]) && !/^(#{1,6})\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    out.push(`<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('\n');
}

/**
 * 一轮对话。
 *
 * 用户轮是「带左色条的引文」，助手轮是正文流——和博客的正文/引用关系一致，
 * 所以一页里只有一种排版语言，不再用气泡卡片。
 */
function renderMessage(message) {
  const role = message.role === 'user' ? 'user' : 'assistant'
  const time =
    typeof message.time === 'number'
      ? `<time class="turn__time">${escapeHtml(new Date(message.time).toISOString().slice(11, 16))}</time>`
      : ''
  const tools =
    role === 'assistant' && Array.isArray(message.tools) && message.tools.length > 0
      ? `<div class="tool-chips">${message.tools
          .map((tool) => `<span class="tool-chip">${escapeHtml(tool)}</span>`)
          .join('')}</div>`
      : ''
  const copy =
    role === 'assistant'
      ? `<button class="turn__copy" type="button" data-copy="message" aria-label="复制这条回复">` +
        '<span class="copy-btn__label">复制</span></button>'
      : ''
  return `<section class="turn turn--${role}">
  <header class="turn__meta"><span class="turn__role">${role === 'user' ? '你' : '助手'}</span>${time}<span class="turn__grow"></span>${copy}</header>
  <div class="turn__body"${role === 'assistant' ? ' data-copy-body' : ''}>${renderBody(message.text)}</div>
  ${tools}
</section>`
}

/** 移动端地址栏配色：跟着预设的纸面走，别让深色主题顶着一条浅色栏。 */
const THEME_COLOR = {
  article: '#edf2f6',
  paper: '#f6f5f2',
  github: '#ffffff',
  notion: '#ffffff',
  sepia: '#f4ecd8',
  terminal: '#0d1117',
}

/** 三套页面共用的 `<style>`：内嵌字体 + 主样式 + 主题。 */
function styleTag(theme, customCss) {
  return `<style>
${FONT_FACE_CSS}
${PAGE_CSS}
${themeCss(theme, customCss)}
</style>`
}

/** 页脚：来源 + 撤销提示 + 一个 star（纯文本链接，无第三方脚本）。 */
function footer(note) {
  return `  <footer class="page-foot">
    <span>${note}</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>`
}

/** 头部：eyebrow + 标题 + meta + 操作。标题为空时退化成窄条（内容自带 h1 的场合）。
 *
 * eyebrow 只写**文档类型**（会话快照 / Markdown 文档 / 目录）。别把宿主或第三方产品名
 * 写进去：页面是给别人看的，样式可以借，品牌不能带。
 */
function hero(input) {
  const { eyebrow, title, meta, actions, compact = false } = input
  const titleHtml = title === '' ? '' : `<h1 class="hero__title">${escapeHtml(title)}</h1>`
  const metaHtml = meta === '' ? '' : `<p class="hero__meta">${meta}</p>`
  const actionsHtml =
    actions === '' ? '' : `<div class="hero__actions">${actions}</div>`
  return `<header class="hero${compact ? ' hero--compact' : ''}">
  <div class="hero__inner">
    <p class="hero__eyebrow">${escapeHtml(eyebrow)}</p>
    ${titleHtml}
    ${metaHtml}
    ${actionsHtml}
  </div>
</header>`
}

/** 「复制全文」按钮。 */
const COPY_ALL = '<button class="copy-btn" type="button" data-copy="content"><span class="copy-btn__label">复制全文</span></button>'

/**
 * 渲染一个完整的只读会话页。
 *
 * 版式原则：标题只出现一次（标题区），助手正文是**文档流**，用户轮是带左色条的
 * 引文块——一页里只有一种排版语言。
 *
 * @param {object} input
 * @param {string} input.title - 页面标题（会话标题或用户指定）。
 * @param {string} input.sessionId - 会话 id（展示与溯源）。
 * @param {number} input.createdAt - 快照生成时间（epoch ms）。
 * @param {Array<object>} input.messages - 已投影的消息列表。
 * @returns {string} 完整 HTML 文档。
 */
export function renderSessionPage(input) {
  const { title, createdAt, messages, theme, customCss } = input;
  const stamp = new Date(createdAt).toISOString().replace('T', ' ').slice(0, 16);
  const body = messages.map(renderMessage).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${THEME_COLOR[theme] ?? '#edf2f6'}">
${CSP_META}
<title>${escapeHtml(title)}</title>
${styleTag(theme, customCss)}
</head>
<body>
<div class="page">
${hero({
  eyebrow: '会话快照',
  title,
  meta: `${escapeHtml(stamp)} UTC · ${messages.length} 条消息`,
  actions: COPY_ALL,
})}
<main class="ds-blog-main">
  <article class="ds-prose" data-copy-source>
${body}
  </article>
${footer('由 <a href="' + STAR_URL + '" target="_blank" rel="noreferrer">dsh-share-link</a> 生成 · 撤销后立即失效')}
</main>
</div>
${COPY_SCRIPT}
</body>
</html>`;
}

/**
 * 给 Markdown 里的表格套一层圆角外壳。
 *
 * markdown-it 直接吐 `<table>`，而博客版式的表格是「外层圆角 + 横向滚动」的卡片
 * 形态，纯 CSS 做不出圆角裁切（`border-radius` 对 `border-collapse` 的表不生效）。
 * 所以渲染完再包一层——只包表格，别的块不动。
 * @param {string} html
 * @returns {string}
 */
function wrapTables(html) {
  return html
    .replace(/<table\b/g, '<div class="table-wrap"><table')
    .replace(/<\/table>/g, '</table></div>')
}

/**
 * 渲染一个 `.md` 产物。
 *
 * 走 markdown-it（服务端渲染，页面本身仍然零脚本、零外链依赖）而不是极简
 * 手写渲染器：README 里的表格、图片、链接、嵌套列表都是标准 GFM，手写版
 * 只覆盖了标题/列表/代码块，实际用起来整段会掉成纯文本。
 *
 * @param {{title: string, markdown: string, theme?: string, customCss?: string,
 *   images?: Map<string, string>}} input
 *   `images` 是「公网图片地址 → data: URI」：发布时抓下来的图在这里替换，
 *   这样页面依然是离线可打开的。
 * @returns {string} 完整 HTML。
 */
export function renderMarkdownDocument(input) {
  const { title, markdown, theme, customCss, images } = input;
  const body = wrapTables(substituteImages(sanitizeHtml(DOC_MD.render(markdown)), images));
  // README 这类文档自带 `<h1 align="center">`：那时标题区只留一条窄标，别把
  // 同一个标题在页面上印两遍。
  const ownsHeading = /^\s*<h1[\s>]/i.test(body);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${THEME_COLOR[theme] ?? '#edf2f6'}">
${CSP_META}
<title>${escapeHtml(title)}</title>
${styleTag(theme, customCss)}
</head>
<body>
<div class="page">
${hero({
  eyebrow: 'Markdown 文档',
  title: ownsHeading ? '' : title,
  meta: '',
  actions: COPY_ALL,
  compact: ownsHeading,
})}
<main class="ds-blog-main">
  <article class="ds-prose doc" data-copy-source>${body}</article>
${footer('由 <a href="' + STAR_URL + '" target="_blank" rel="noreferrer">dsh-share-link</a> 生成的只读快照')}
</main>
</div>
${COPY_SCRIPT}
</body>
</html>`;
}

/**
 * 目录没有 `index.html` 时的入口页：列出文件，点开即看。
 * @param {{title: string, entries: Array<{name: string, size: number}>}} input
 * @returns {string} 完整 HTML。
 */
export function renderDirectoryIndex(input) {
  const { title, entries, theme, customCss } = input;
  const rows = entries
    .map(
      (entry) =>
        `<li><a href="./${entry.name.split('/').map(encodeURIComponent).join('/')}">${escapeHtml(entry.name)}</a><span>${formatSize(entry.size)}</span></li>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${THEME_COLOR[theme] ?? '#edf2f6'}">
${CSP_META}
<title>${escapeHtml(title)}</title>
${styleTag(theme, customCss)}
</head>
<body>
<div class="page">
${hero({
  eyebrow: '目录',
  title,
  meta: `${entries.length} 个文件 · 只读快照`,
  actions: COPY_ALL,
})}
<main class="ds-blog-main">
  <article class="ds-prose" data-copy-source><ul class="files">
${rows}
  </ul></article>
${footer('由 <a href="' + STAR_URL + '" target="_blank" rel="noreferrer">dsh-share-link</a> 生成')}
</main>
</div>
${COPY_SCRIPT}
</body>
</html>`;
}

/** @param {number} bytes */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
