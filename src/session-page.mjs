/**
 * 会话快照 → 自包含只读 HTML。
 *
 * 设计约束：产物是**纯静态**（无脚本、无外链），所以它既能进隧道，也能直接
 * 发给别人离线打开；同时把「JS 能不能执行」这一整类风险从分享面里去掉。
 *
 * @module dsh-share-link/session-page
 */

import MarkdownIt from 'markdown-it'

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

// .md 里的代码块复用会话页那套「语言标签 + 复制按钮」外壳，观感一致；
// 复制按钮依赖 `.code` 容器与 `data-copy="code"`，这两者由 sanitize 白名单放行。
DOC_MD.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]
  const lang = token.info.trim().split(/\s+/)[0] ?? ''
  const code = escapeHtml(token.content.replace(/\n$/, ''))
  return (
    '<div class="code"><div class="code-bar">' +
    `<span>${escapeHtml(lang === '' ? 'code' : lang)}</span>` +
    '<button type="button" data-copy="code">复制</button></div>' +
    `<pre><code data-lang="${escapeHtml(lang)}">${code}</code></pre></div>`
  )
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

/**
 * 过滤一段 HTML：只留白名单标签与属性。
 *
 * 这是**字符串级**过滤，不是 HTML 解析器——够用是因为输入只来自 markdown-it 的
 * 输出（结构已知、文本已转义），而它要挡的东西很具体：脚本、内联事件、
 * `javascript:` 协议、以及 `<style>` 这类能整页变形的块。
 *
 * @param {string} html
 * @returns {string}
 */
export function sanitizeHtml(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|textarea|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => filterTag(tag))
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
    if (URL_ATTRS.has(key) && !isSafeUrl(value)) continue
    attributes.push(`${key}="${value}"`)
  }
  const open = `<${name}${attributes.length === 0 ? '' : ` ${attributes.join(' ')}`}>`
  return open
}

/**
 * 只放行 http(s) / mailto / 站内相对路径 / `data:image/*`。
 * @param {string} value
 * @returns {boolean}
 */
function isSafeUrl(value) {
  const url = value.trim().toLowerCase()
  if (url === '') return false
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url)
  if (scheme === null) return true
  if (scheme[1] === 'http' || scheme[1] === 'https' || scheme[1] === 'mailto') return true
  return scheme[1] === 'data' && url.startsWith('data:image/')
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
  return text
    .replace(/(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)(?=[/\\\s"'`]|$)/g, '~')
    .replace(/[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/g, '~');
}


/** 复制按钮的最小内联脚本：只做剪贴板，不发任何外部请求。 */
const STAR_URL = 'https://github.com/vlln/dsh-share-link';

const COPY_SCRIPT = `<script>
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (button === null) return;
  const kind = button.dataset.copy;
  const payload = kind === 'link'
    ? location.href
    : kind === 'content'
      ? (document.querySelector('[data-copy-source]')?.innerText ?? '').trim()
      : (button.closest('.code')?.querySelector('pre')?.innerText ?? '');
  try {
    await navigator.clipboard.writeText(payload);
    button.dataset.done = '1';
    setTimeout(() => { delete button.dataset.done; }, 1400);
  } catch {}
});
</script>`;

const PAGE_CSS = `  :root {
    color-scheme: light dark;
    --bg: #f6f5f2; --paper: #fffefc; --fg: #1b1b1f; --muted: #6e6e78;
    --line: #e7e4dd; --code-bg: #f4f2ee; --accent: #3f5bd9; --star: #8a6d1f;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121215; --paper: #17171b; --fg: #eaeaef; --muted: #9a9aa5;
      --line: #29292f; --code-bg: #1e1e24; --accent: #94a3f5; --star: #d8b45a;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); }
  body {
    font: 15.5px/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .bar {
    position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px;
    height: 46px; padding: 0 20px;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .bar .brand { font-size: 12.5px; font-weight: 600; letter-spacing: .01em; }
  .bar .tag {
    font-size: 11px; color: var(--muted); padding: 2px 7px; border-radius: 999px;
    border: 1px solid var(--line); background: var(--paper);
  }
  .bar .spacer { flex: 1; }
  .bar [data-copy] { font-size: 12px; }

  button[data-copy] {
    font: inherit; font-size: 12px; height: 24px; padding: 0 4px; cursor: pointer;
    border: 0; background: transparent; color: var(--muted);
    transition: color .15s;
  }
  button[data-copy]:hover { color: var(--fg); }
  button[data-copy][data-done] { color: #1f9d63; }
  button[data-copy][data-done]::after { content: ' ✓'; }

  main { max-width: 720px; margin: 0 auto; padding: 44px 22px 40px; }

  h1 {
    font-size: 25px; line-height: 1.35; font-weight: 650; letter-spacing: -0.015em;
    margin: 0 0 10px;
  }
  .subline { display: flex; align-items: center; gap: 12px; margin: 0 0 4px; }
  .subline .grow { flex: 1; }
  .meta { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--muted); }
  .meta code { font: 11.5px/1.5 ui-monospace, Menlo, monospace; color: var(--muted); }
  .rule { height: 1px; background: var(--line); margin: 26px 0 30px; border: 0; }

  .msg { margin: 0 0 26px; }
  .msg.user { display: flex; justify-content: flex-end; }
  .msg.user .bubble {
    max-width: 78%; padding: 10px 15px; border-radius: 16px 16px 5px 16px;
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    color: var(--fg); overflow-wrap: anywhere;
  }
  .msg.assistant .text { overflow-wrap: anywhere; }
  .msg .text > :first-child, .msg .bubble > :first-child { margin-top: 0; }
  .msg .text > :last-child, .msg .bubble > :last-child { margin-bottom: 0; }
  .msg.assistant .foot {
    display: flex; align-items: center; gap: 10px; margin-top: 10px;
    font-size: 11.5px; color: var(--muted);
  }
  .msg.assistant .foot button {
    border: 0; background: transparent; padding: 0; cursor: pointer;
    font: inherit; font-size: 11.5px; color: var(--muted);
    opacity: .55; transition: opacity .15s ease;
  }
  .msg.assistant:hover .foot button, .msg.assistant .foot button:focus-visible { opacity: 1; }
  .msg.assistant .foot button:hover { color: var(--fg); text-decoration: underline; }
  .msg.assistant .foot button[data-done] { color: #1f9d63; opacity: 1; }

  .body p { margin: 0 0 12px; }
  .body h1, .body h2, .body h3, .body h4, .body h5, .body h6 { margin: 22px 0 10px; line-height: 1.4; letter-spacing: -0.01em; }
  .body h1 { font-size: 20px; } .body h2 { font-size: 18px; } .body h3 { font-size: 16px; }
  .body h4, .body h5, .body h6 { font-size: 15px; }
  .body ul, .body ol { margin: 8px 0 14px; padding-left: 22px; }
  .body li { margin: 4px 0; }
  .body blockquote { margin: 12px 0; padding: 2px 0 2px 14px; border-left: 2px solid var(--line); color: var(--muted); }
  .body hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
  .body a { color: var(--accent); }

  .code { margin: 14px 0; border-radius: 10px; overflow: hidden; background: var(--code-bg); }
  .code-bar {
    display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 12px;
    font: 11px/1.8 ui-monospace, Menlo, monospace; color: var(--muted);
  }
  .code-bar span { flex: 1; }
  .code-bar button[data-copy] { font-family: inherit; }
  .code pre { margin: 0; padding: 2px 14px 14px; overflow-x: auto; }
  pre code { font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace; }
  :not(pre) > code {
    font: 13px/1.5 ui-monospace, Menlo, monospace; background: var(--code-bg);
    padding: 1.5px 5px; border-radius: 5px;
  }

  .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tool {
    font: 11px/1 ui-monospace, Menlo, monospace; color: var(--muted);
    border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px;
  }

  footer {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    margin-top: 34px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--muted);
  }
  footer .grow { flex: 1; }
  footer a { color: var(--muted); text-underline-offset: 2px; }
  footer a:hover { color: var(--fg); }
  footer .star { color: var(--star); text-decoration: none; font-weight: 600; }
  footer .star:hover { text-decoration: underline; }

  @media print {
    .bar { display: none; }
    main { max-width: none; padding: 0; }
    .turn { break-inside: avoid; }
    body { background: #fff; }
  }`;



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


/** 分享页预设风格。用户也可以给自定义 CSS 覆盖这些变量。 */
export const PAGE_THEMES = ['paper', 'github', 'notion', 'sepia', 'terminal']

const THEME_CSS = {
  // 暖纸：默认，偏阅读
  paper: `:root {
    --bg: #f6f5f2; --paper: #fffefc; --fg: #1b1b1f; --muted: #6e6e78;
    --line: #e7e4dd; --code-bg: #f4f2ee; --accent: #3f5bd9; --star: #8a6d1f;
  }`,
  // GitHub README：白底、细边框、系统字体
  github: `:root {
    --bg: #ffffff; --paper: #ffffff; --fg: #1f2328; --muted: #59636e;
    --line: #d1d9e0; --code-bg: #f6f8fa; --accent: #0969da; --star: #9a6700;
  }
  body { font-size: 15px; line-height: 1.7; }
  h1 { font-size: 24px; font-weight: 600; letter-spacing: 0; }
  .bar { background: #ffffff; border-bottom-color: #d1d9e0; }
  .tag { border-color: #d1d9e0; background: #ffffff; }
  .turn.user .body { border-left-width: 4px; }`,
  // Notion：极简、无边框、大留白
  notion: `:root {
    --bg: #ffffff; --paper: #ffffff; --fg: #37352f; --muted: #787774;
    --line: #e9e9e7; --code-bg: #f7f6f3; --accent: #2383e2; --star: #b07d00;
  }
  body { font-size: 16px; line-height: 1.75; }
  h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  .bar { border-bottom: 0; background: #ffffff; }
  .tag { border: 0; background: #f1f0ee; }
  footer { border-top: 0; }`,
  // 散文/阅读：衬线、米色、宽行距
  sepia: `:root {
    --bg: #f4ecd8; --paper: #f7f0df; --fg: #3b2f22; --muted: #7a6a55;
    --line: #ded1b6; --code-bg: #efe6d0; --accent: #8a5a2b; --star: #8a5a2b;
  }
  body {
    font-family: Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif;
    font-size: 17px; line-height: 1.95;
  }
  h1 { font-size: 28px; font-weight: 600; letter-spacing: 0; }
  .bar { background: #f7f0df; border-bottom-color: #ded1b6; }
  .tag { background: #f7f0df; border-color: #ded1b6; }`,
  // 终端：暗色、等宽
  terminal: `:root {
    --bg: #0d1117; --paper: #0d1117; --fg: #c9d1d9; --muted: #8b949e;
    --line: #21262d; --code-bg: #161b22; --accent: #3fb950; --star: #d29922;
    color-scheme: dark;
  }
  body {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 14px; line-height: 1.8;
  }
  h1 { font-size: 22px; font-weight: 600; letter-spacing: 0; }
  .bar { background: #0d1117; border-bottom-color: #21262d; }
  .tag { background: #161b22; border-color: #21262d; }`,
}

/**
 * 生成某个风格的 CSS：预设变量 + 用户自定义覆盖（自定义永远最后生效）。
 * @param {string} [name]
 * @param {string} [custom]
 * @returns {string}
 */
export function themeCss(name, custom = '') {
  const base = THEME_CSS[name] ?? THEME_CSS.paper;
  // 只挡 style 提前闭合，用户自己的 CSS 允许任意内容
  const safe = String(custom ?? '').replace(/<\/style/gi, '<\\/style');
  return safe.trim() === '' ? base : `${base}\n/* 自定义 */\n${safe}`;
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
      out.push(
        `<div class="code"><div class="code-bar"><span>${escapeHtml(lang === '' ? 'code' : lang)}</span>` +
          `<button type="button" data-copy="code">复制</button></div>` +
          `<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.replace(/\n$/, ''))}</code></pre></div>`,
      );
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

function renderMessage(message) {
  const role = message.role === 'user' ? 'user' : 'assistant'
  const time =
    typeof message.time === 'number'
      ? `<time>${escapeHtml(new Date(message.time).toISOString().slice(11, 16))}</time>`
      : ''
  const tools =
    role === 'assistant' && Array.isArray(message.tools) && message.tools.length > 0
      ? `<div class="tools">${message.tools.map((tool) => `<span class="tool">${escapeHtml(tool)}</span>`).join('')}</div>`
      : ''
  if (role === 'user') {
    return `<div class="msg user"><div class="bubble">${renderBody(message.text)}</div></div>`
  }
  return `<div class="msg assistant">
  <div class="text">${renderBody(message.text)}</div>
  ${tools}
  <div class="foot"><button type="button" data-copy="message" aria-label="复制这条">复制</button>${time}</div>
</div>`
}

/**
 * 渲染一个完整的只读会话页。
 *
 * 版式原则（踩过的三条）：标题只出现一次；助手正文是**文档流**而不是卡片；用户消息用
 * 左侧色条引文块区分。卡片叠卡片、以及 780px 行长是上一版"看起来平"的主因。
 *
 * @param {object} input
 * @param {string} input.title - 页面标题（会话标题或用户指定）。
 * @param {string} input.sessionId - 会话 id（展示与溯源）。
 * @param {number} input.createdAt - 快照生成时间（epoch ms）。
 * @param {Array<object>} input.messages - 已投影的消息列表。
 * @returns {string} 完整 HTML 文档。
 */
export function renderSessionPage(input) {
  const { title, sessionId, createdAt, messages, theme, customCss } = input;
  const stamp = new Date(createdAt).toISOString().replace('T', ' ').slice(0, 16);
  const body = messages.map(renderMessage).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
${themeCss(theme, customCss)}
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
</header>
<main>
  <article data-copy-source>
    <h1>${escapeHtml(title)}</h1>
    <div class="subline">
      <p class="meta">${escapeHtml(stamp)} UTC · ${messages.length} 条消息</p>
      <span class="grow"></span>
      <button type="button" data-copy="content">复制全文</button>
    </div>
    <hr class="rule">
    <div class="thread">
${body}
    </div>
  </article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成 · 撤销后立即失效</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>
</main>
${COPY_SCRIPT}
</body>
</html>`;
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
  const body = substituteImages(sanitizeHtml(DOC_MD.render(markdown)), images);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
${themeCss(theme, customCss)}
  .doc h1:first-child, .doc > :first-child { margin-top: 0; }
  .doc img { max-width: 100%; height: auto; }
  .doc table { display: block; width: max-content; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  .doc th, .doc td { border: 1px solid var(--line); padding: 7px 11px; text-align: left; vertical-align: top; }
  .doc th { background: var(--code-bg); font-weight: 600; white-space: nowrap; }
  .doc details { margin: 14px 0; padding: 8px 13px; border: 1px solid var(--line); border-radius: 9px; }
  .doc summary { cursor: pointer; color: var(--muted); }
  .doc kbd { font: 12px/1.4 ui-monospace, Menlo, monospace; padding: 1px 5px; border: 1px solid var(--line); border-radius: 4px; background: var(--code-bg); }
  .doc img + br { line-height: 1; }
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
  <span class="tag">Markdown</span>
  <span class="spacer"></span>
  <button type="button" data-copy="content">复制全文</button>
</header>
<main>
  <article class="doc body" data-copy-source>${body}</article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成的只读快照</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>
</main>
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
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
${themeCss(theme, customCss)}
  .files { list-style: none; margin: 26px 0 0; padding: 0; }
  .files li { display: flex; justify-content: space-between; gap: 16px; padding: 11px 2px; border-bottom: 1px solid var(--line); }
  .files li:first-child { border-top: 1px solid var(--line); }
  .files a { color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
  .files a:hover { text-decoration: underline; }
  .files span { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
  <span class="tag">目录</span>
  <span class="spacer"></span>
  <button type="button" data-copy="content">复制全文</button>
</header>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${entries.length} 个文件 · 只读目录快照</p>
  <article data-copy-source><ul class="files">
${rows}
  </ul></article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>
</main>
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
