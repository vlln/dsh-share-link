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
const COPY_SCRIPT = `<script>
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (button === null) return;
  const payload = button.dataset.copy === 'link'
    ? location.href
    : (button.closest('.code')?.querySelector('pre')?.innerText ?? '');
  try {
    await navigator.clipboard.writeText(payload);
    button.dataset.done = '1';
    setTimeout(() => { delete button.dataset.done; }, 1400);
  } catch {}
});
</script>`;

/** 三个页面共用的顶栏与基础排版。 */
const SHARED_CSS = `
  :root {
    color-scheme: light dark;
    --bg: #fbfbfd; --fg: #1c1c21; --muted: #6b6b76; --line: #e6e6ee;
    --card: #ffffff; --soft: #f6f6fa; --code-bg: #f5f5f9; --accent: #4d6bfe; --accent-soft: #eef2ff;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #15151a; --fg: #e9e9ef; --muted: #9a9aa6; --line: #2a2a33;
      --card: #1c1c22; --soft: #202027; --code-bg: #1f1f26; --accent: #8b9bff; --accent-soft: #232338;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); }
  body { font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .bar {
    position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px;
    padding: 10px 20px; background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: saturate(180%) blur(12px); border-bottom: 1px solid var(--line);
  }
  .bar .mark {
    font: 600 12px/1 ui-monospace, Menlo, monospace; letter-spacing: .04em;
    padding: 5px 7px; border-radius: 7px; color: var(--accent);
    background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .bar .title { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar .spacer { flex: 1; }
  [data-copy] {
    font: inherit; font-size: 12px; height: 26px; padding: 0 10px; border-radius: 7px; cursor: pointer;
    border: 1px solid var(--line); background: var(--card); color: var(--muted);
    transition: color .15s, border-color .15s, background .15s;
  }
  [data-copy]:hover { color: var(--fg); border-color: var(--muted); }
  [data-copy][data-done] { color: #1f9d63; border-color: #1f9d63; }
  [data-copy][data-done]::after { content: ' ✓'; }
  .code { margin: 12px 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--code-bg); }
  .code-bar {
    display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 12px;
    border-bottom: 1px solid var(--line); font: 11px/1.6 ui-monospace, Menlo, monospace; color: var(--muted);
  }
  .code-bar span { flex: 1; }
  .code pre { margin: 0; padding: 12px 14px; overflow-x: auto; border: 0; border-radius: 0; background: transparent; }
`

/**
 * 对一段正文做尽力脱敏。**不是保证**：它只挡常见凭据形态与家目录，挡不住
 * 业务机密、客户名、内网 IP。对外分享前仍应人工过一遍。
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
    .replace(/'/g, '&#39;');
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
 * 行内代码/粗体/斜体、段落。不引第三方库——分享页要能离线打开，
 * 构建面越小越好；未知语法按段落原样输出，不会吞内容。
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

/**
 * 把一条消息投影成渲染单元。
 * @param {{role: string, text: string, time?: number, tools?: string[]}} message
 */
function renderMessage(message) {
  const role = message.role === 'user' ? 'user' : 'assistant';
  const label = role === 'user' ? '你' : '助手';
  const tools =
    role === 'assistant' && Array.isArray(message.tools) && message.tools.length > 0
      ? `<div class="tools">${message.tools
          .map((tool) => `<span class="tool">${escapeHtml(tool)}</span>`)
          .join('')}</div>`
      : '';
  const time =
    typeof message.time === 'number'
      ? `<time data-ts="${message.time}">${escapeHtml(new Date(message.time).toISOString().slice(0, 16).replace('T', ' '))} UTC</time>`
      : '';
  return `<article class="msg ${role}">
  <header><span class="who">${label}</span>${time}</header>
  <div class="body">${renderBody(message.text)}</div>
  ${tools}
</article>`;
}

/**
 * 渲染一个完整的只读会话页。
 * @param {object} input
 * @param {string} input.title - 页面标题（会话标题或用户指定）。
 * @param {string} input.sessionId - 会话 id（仅作展示与溯源）。
 * @param {number} input.createdAt - 快照生成时间（epoch ms）。
 * @param {Array<object>} input.messages - 已投影的消息列表。
 * @param {string} [input.fingerprint] - 内容指纹（sha256 前缀）。
 * @param {number} [input.redactedCount] - 被脱敏的处数，用于页面提示。
 * @returns {string} 完整 HTML 文档。
 */
export function renderSessionPage(input) {
  const { title, sessionId, createdAt, messages, fingerprint = '', redactedCount = 0 } = input;
  const stamp = new Date(createdAt).toISOString().replace('T', ' ').slice(0, 16);
  const body = messages.map(renderMessage).join('\n');
  const redactNote =
    redactedCount > 0
      ? `<span class="badge">已脱敏 ${redactedCount} 处</span>`
      : '<span class="badge">未命中常见凭据形态</span>';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #fbfbfd; --fg: #1d1d22; --muted: #6b6b76; --line: #e5e5ec;
    --card: #ffffff; --user: #eef2ff; --code-bg: #f4f4f7; --accent: #4d6bfe;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16161a; --fg: #e9e9ef; --muted: #9a9aa6; --line: #2a2a32;
      --card: #1d1d23; --user: #232336; --code-bg: #212128; --accent: #7d90ff;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 780px; margin: 0 auto; padding: 40px 20px 96px; }
  .page-head { border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 28px; }
  h1 { font-size: 22px; line-height: 1.35; margin: 0 0 10px; letter-spacing: -0.01em; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 12.5px; color: var(--muted); }
  .badge {
    border: 1px solid var(--line); border-radius: 999px; padding: 1px 9px;
    background: var(--card); font-size: 12px;
  }
  .msg { margin: 0 0 20px; }
  .msg > header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; }
  .who { font-size: 12.5px; font-weight: 600; letter-spacing: .02em; color: var(--muted); }
  .msg.user .who { color: var(--accent); }
  time { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .body { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; overflow-wrap: anywhere; }
  .msg.user .body { background: var(--user); border-color: transparent; }
  .body > p:first-child { margin-top: 0; }
  .body > p:last-child { margin-bottom: 0; }
  .body p { margin: 0 0 10px; }
  .body h1, .body h2, .body h3, .body h4, .body h5, .body h6 { margin: 18px 0 10px; line-height: 1.35; letter-spacing: -0.01em; }
  .body h1 { font-size: 20px; } .body h2 { font-size: 18px; } .body h3 { font-size: 16px; }
  .body h4, .body h5, .body h6 { font-size: 15px; }
  .body ul, .body ol { margin: 8px 0 12px; padding-left: 22px; }
  .body li { margin: 3px 0; }
  .body blockquote { margin: 10px 0; padding: 6px 14px; border-left: 3px solid var(--line); color: var(--muted); }
  .body hr { border: 0; border-top: 1px solid var(--line); margin: 18px 0; }
  pre { background: var(--code-bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; overflow-x: auto; margin: 10px 0; }
  pre code { font: 12.5px/1.55 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; background: none; padding: 0; }
  code { font: 12.5px/1.5 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; background: var(--code-bg); padding: 1.5px 5px; border-radius: 5px; }
  .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .tool { font: 11.5px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); border: 1px dashed var(--line); border-radius: 6px; padding: 3px 6px; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
  footer code { font-size: 11.5px; }
  @media print { main { max-width: none; } .msg { break-inside: avoid; } }
${SHARED_CSS}
</style>
</head>
<body>
<header class="bar">
  <span class="mark">dsh</span>
  <span class="title">${escapeHtml(title)}</span>
  <span class="spacer"></span>
  <button type="button" data-copy="link">复制链接</button>
</header>
<main>
  <div class="page-head">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span>只读快照 · 生成于 ${escapeHtml(stamp)} UTC</span>
      <span>会话 <code>${escapeHtml(sessionId)}</code></span>
      ${redactNote}
      ${fingerprint === '' ? '' : `<span>指纹 <code>${escapeHtml(fingerprint)}</code></span>`}
    </div>
  </div>
  ${body}
  <footer>
    这是一份静态快照：不加载任何外部资源（内联脚本只用于复制按钮），不会随原会话更新。
    链接由 <code>dsh-share-link</code> 生成，撤销后立即失效。
  </footer>
</main>
${COPY_SCRIPT}
</body>
</html>`;
}

/**
 * 把一个 Markdown 文件渲染成可直接阅读的静态页。
 *
 * 分享 `.md` 时如果原样发出去，浏览器要么下载、要么显示裸文本——链接就失去
 * 了"点开就能看"的意义。这里复用会话页的 Markdown-lite 与排版。
 * @param {{title: string, markdown: string}} input
 * @returns {string} 完整 HTML。
 */
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
  :root { color-scheme: light dark; --bg:#fbfbfd; --fg:#1d1d22; --muted:#6b6b76; --line:#e5e5ec; --card:#fff; --code-bg:#f4f4f7; }
  @media (prefers-color-scheme: dark) { :root { --bg:#16161a; --fg:#e9e9ef; --muted:#9a9aa6; --line:#2a2a32; --card:#1d1d23; --code-bg:#212128; } }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); }
  body { font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  main { max-width: 780px; margin: 0 auto; padding: 44px 20px 96px; }
  .doc { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 28px 30px; }
  .doc > p:first-child { margin-top: 0; }
  .doc p { margin: 0 0 12px; }
  .doc h1, .doc h2, .doc h3, .doc h4, .doc h5, .doc h6 { margin: 22px 0 10px; line-height: 1.35; letter-spacing: -0.01em; }
  .doc h1 { font-size: 24px; } .doc h2 { font-size: 20px; } .doc h3 { font-size: 17px; }
  .doc h4, .doc h5, .doc h6 { font-size: 15px; }
  .doc ul, .doc ol { margin: 8px 0 14px; padding-left: 22px; }
  .doc li { margin: 4px 0; }
  .doc blockquote { margin: 12px 0; padding: 6px 14px; border-left: 3px solid var(--line); color: var(--muted); }
  .doc hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
  .doc pre { background: var(--code-bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; overflow-x: auto; }
  .doc pre code { background: none; padding: 0; }
  .doc code { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--code-bg); padding: 1.5px 5px; border-radius: 5px; }
  footer { margin-top: 18px; font-size: 12px; color: var(--muted); }
${SHARED_CSS}
</style>
</head>
<body>
<header class="bar">
  <span class="mark">md</span>
  <span class="title">${escapeHtml(title)}</span>
  <span class="spacer"></span>
  <button type="button" data-copy="link">复制链接</button>
</header>
<main>
  <div class="doc">${renderBody(markdown)}</div>
  <footer>只读快照 · 由 dsh-share-link 生成</footer>
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
  :root { color-scheme: light dark; --bg:#fbfbfd; --fg:#1d1d22; --muted:#6b6b76; --line:#e5e5ec; --card:#fff; --accent:#4d6bfe; }
  @media (prefers-color-scheme: dark) { :root { --bg:#16161a; --fg:#e9e9ef; --muted:#9a9aa6; --line:#2a2a32; --card:#1d1d23; --accent:#7d90ff; } }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); }
  body { font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 44px 20px 80px; }
  h1 { font-size: 20px; margin: 0 0 6px; letter-spacing: -0.01em; }
  p.hint { margin: 0 0 22px; color: var(--muted); font-size: 12.5px; }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--card); }
  li { display: flex; justify-content: space-between; gap: 16px; padding: 11px 16px; border-top: 1px solid var(--line); }
  li:first-child { border-top: 0; }
  a { color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
  a:hover { text-decoration: underline; }
  span { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
${SHARED_CSS}
</style>
</head>
<body>
<header class="bar">
  <span class="mark">files</span>
  <span class="title">${escapeHtml(title)}</span>
  <span class="spacer"></span>
  <button type="button" data-copy="link">复制链接</button>
</header>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p class="hint">只读目录快照 · 由 dsh-share-link 生成</p>
  <ul>
${rows}
  </ul>
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
