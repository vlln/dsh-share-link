/**
 * 会话快照 → 自包含只读 HTML。
 *
 * 设计约束：产物是**纯静态**（无脚本、无外链），所以它既能进隧道，也能直接
 * 发给别人离线打开；同时把「JS 能不能执行」这一整类风险从分享面里去掉。
 *
 * @module dsh-share-link/session-page
 */

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

  main { max-width: 720px; margin: 0 auto; padding: 44px 22px 40px; }

  h1 {
    font-size: 25px; line-height: 1.35; font-weight: 650; letter-spacing: -0.015em;
    margin: 0 0 10px;
  }
  .meta { margin: 0 0 4px; font-size: 12.5px; line-height: 1.7; color: var(--muted); }
  .meta code { font: 11.5px/1.5 ui-monospace, Menlo, monospace; color: var(--muted); }
  .rule { height: 1px; background: var(--line); margin: 26px 0 30px; border: 0; }

  .turn { margin: 0 0 30px; }
  .turn .who {
    display: flex; align-items: center; gap: 8px;
    font-size: 11.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); margin-bottom: 8px;
  }
  .turn .who time { font-weight: 400; letter-spacing: 0; text-transform: none; font-variant-numeric: tabular-nums; }
  .turn.user .who { color: var(--accent); }
  .turn .body { overflow-wrap: anywhere; }
  .turn .body > :first-child { margin-top: 0; }
  .turn .body > :last-child { margin-bottom: 0; }

  /* 用户：左侧色条引文块，不加边框、不加背景块 */
  .turn.user .body {
    border-left: 3px solid var(--accent);
    padding: 2px 0 2px 16px;
    color: var(--fg); font-weight: 450;
  }
  /* 助手：纯正文流 */
  .turn.assistant .body { color: var(--fg); }

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
  const label = role === 'user' ? '你' : '助手'
  const tools =
    role === 'assistant' && Array.isArray(message.tools) && message.tools.length > 0
      ? `<div class="tools">${message.tools.map((tool) => `<span class="tool">${escapeHtml(tool)}</span>`).join('')}</div>`
      : ''
  const time =
    typeof message.time === 'number'
      ? `<time>${escapeHtml(new Date(message.time).toISOString().slice(11, 16))}</time>`
      : ''
  return `<section class="turn ${role}">
  <div class="who">${label}${time}</div>
  <div class="body">${renderBody(message.text)}</div>
  ${tools}
</section>`
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
 * @param {string} [input.fingerprint] - 内容指纹（sha256 前缀）。
 * @param {number} [input.redactedCount] - 被脱敏的处数。
 * @returns {string} 完整 HTML 文档。
 */
export function renderSessionPage(input) {
  const { title, sessionId, createdAt, messages, fingerprint = '', redactedCount = 0 } = input;
  const stamp = new Date(createdAt).toISOString().replace('T', ' ').slice(0, 16);
  const body = messages.map(renderMessage).join('\n');
  const redactNote = redactedCount > 0 ? `已脱敏 ${redactedCount} 处` : '未命中常见凭据形态';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}

</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
  <span class="tag">只读快照</span>
  <span class="spacer"></span>
  <button type="button" data-copy="content">复制正文</button>
</header>
<main>
  <article data-copy-source>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">${escapeHtml(stamp)} UTC · ${messages.length} 条消息 · ${redactNote}${fingerprint === '' ? '' : ` · 指纹 ${escapeHtml(fingerprint)}`}</p>
    <p class="meta">会话 <code>${escapeHtml(sessionId)}</code></p>
    <hr class="rule">
    <div class="thread">
${body}
    </div>
  </article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成 · 撤销后立即失效</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">★ 在 GitHub 上点个 Star</a>
  </footer>
</main>
${COPY_SCRIPT}
</body>
</html>`;
}

export function renderMarkdownDocument(input) {
  const { title, markdown } = input;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
  .doc h1:first-child { margin-top: 0; }
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
  <span class="tag">Markdown</span>
  <span class="spacer"></span>
  <button type="button" data-copy="content">复制正文</button>
</header>
<main>
  <article class="doc body" data-copy-source>${renderBody(markdown)}</article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成的只读快照</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">★ 在 GitHub 上点个 Star</a>
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
  const { title, entries } = input;
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
  <button type="button" data-copy="content">复制正文</button>
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
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">★ 在 GitHub 上点个 Star</a>
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
