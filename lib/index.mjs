import Schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, networkInterfaces } from "node:os";
import { extname, join, relative, resolve, sep } from "node:path";
import { foldSurface } from "@deepseek-ai/dsh-session";
//#region src/session-page.mjs
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
	[/\b(sk|rk)-[A-Za-z0-9_-]{16,}\b/g, "$1-***"],
	[/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "gh*_***"],
	[/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "github_pat_***"],
	[/\bAKIA[0-9A-Z]{16}\b/g, "AKIA***"],
	[/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{12,}=*/g, "$1 ***"],
	[/((?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[:=]\s*)["']?[^\s"'`,;]{8,}/gi, "$1***"]
];
/** 把绝对家目录压成 `~`：分享页里出现 `/Users/xxx` 等于泄露用户名。 */
function scrubHomePaths(text) {
	return text.replace(/(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)(?=[/\\\s"'`]|$)/g, "~").replace(/[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/g, "~");
}
/** 复制按钮的最小内联脚本：只做剪贴板，不发任何外部请求。 */
const STAR_URL = "https://github.com/vlln/dsh-share-link";
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
<\/script>`;
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
  .star {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    margin-top: 32px; padding: 16px 18px; border-radius: 14px;
    border: 1px solid var(--line); background: var(--card);
  }
  .star .txt { flex: 1; min-width: 200px; font-size: 13px; line-height: 1.6; color: var(--muted); }
  .star .txt b { color: var(--fg); font-weight: 600; }
  .star a {
    flex: none; display: inline-flex; align-items: center; gap: 6px;
    height: 34px; padding: 0 14px; border-radius: 9px; text-decoration: none;
    font-size: 13px; font-weight: 600; color: #6b4b00;
    background: linear-gradient(180deg, #ffd97a, #f7c948); border: 1px solid #e6b83a;
  }
  .star a:hover { filter: brightness(1.03); }
`;
/**
* 对一段正文做尽力脱敏。**不是保证**：它只挡常见凭据形态与家目录，挡不住
* 业务机密、客户名、内网 IP。对外分享前仍应人工过一遍。
* @param {string} text - 原始文本。
* @returns {string} 脱敏后的文本。
*/
function redact(text) {
	let out = scrubHomePaths(String(text ?? ""));
	for (const [pattern, replacement] of SECRET_RULES) out = out.replace(pattern, replacement);
	return out;
}
/** @param {string} value */
function escapeHtml(value) {
	return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** 行内格式：行内代码、粗体、斜体。先转义再套标签。 */
function inline(text) {
	return escapeHtml(text).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
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
			const newline = chunk.indexOf("\n");
			const lang = newline === -1 ? "" : chunk.slice(0, newline).trim();
			const code = newline === -1 ? chunk : chunk.slice(newline + 1);
			out.push(`<div class="code"><div class="code-bar"><span>${escapeHtml(lang === "" ? "code" : lang)}</span><button type="button" data-copy="code">复制</button></div><pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.replace(/\n$/, ""))}</code></pre></div>`);
			continue;
		}
		out.push(renderBlocks(chunks[i]));
	}
	return out.join("\n");
}
/** @param {string} chunk */
function renderBlocks(chunk) {
	const lines = chunk.split("\n");
	const out = [];
	let index = 0;
	const isBlank = (line) => line.trim() === "";
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
			out.push("<hr>");
			index += 1;
			continue;
		}
		if (/^\s*[-*+]\s+/.test(line)) {
			const items = [];
			while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
				items.push(`<li>${inline(lines[index].replace(/^\s*[-*+]\s+/, ""))}</li>`);
				index += 1;
			}
			out.push(`<ul>${items.join("")}</ul>`);
			continue;
		}
		if (/^\s*\d+[.)]\s+/.test(line)) {
			const items = [];
			while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
				items.push(`<li>${inline(lines[index].replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
				index += 1;
			}
			out.push(`<ol>${items.join("")}</ol>`);
			continue;
		}
		if (/^\s*>\s?/.test(line)) {
			const quoted = [];
			while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
				quoted.push(lines[index].replace(/^\s*>\s?/, ""));
				index += 1;
			}
			out.push(`<blockquote>${renderBlocks(quoted.join("\n"))}</blockquote>`);
			continue;
		}
		const paragraph = [];
		while (index < lines.length && !isBlank(lines[index]) && !/^(#{1,6})\s+/.test(lines[index])) {
			paragraph.push(lines[index]);
			index += 1;
		}
		out.push(`<p>${inline(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
	}
	return out.join("\n");
}
/**
* 把一条消息投影成渲染单元。
* @param {{role: string, text: string, time?: number, tools?: string[]}} message
*/
function renderMessage(message) {
	const role = message.role === "user" ? "user" : "assistant";
	const label = role === "user" ? "你" : "助手";
	const tools = role === "assistant" && Array.isArray(message.tools) && message.tools.length > 0 ? `<div class="tools">${message.tools.map((tool) => `<span class="tool">${escapeHtml(tool)}</span>`).join("")}</div>` : "";
	return `<article class="msg ${role}">
  <header><span class="who">${label}</span>${typeof message.time === "number" ? `<time data-ts="${message.time}">${escapeHtml(new Date(message.time).toISOString().slice(0, 16).replace("T", " "))} UTC</time>` : ""}</header>
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
function renderSessionPage(input) {
	const { title, sessionId, createdAt, messages, fingerprint = "", redactedCount = 0 } = input;
	const stamp = new Date(createdAt).toISOString().replace("T", " ").slice(0, 16);
	const body = messages.map(renderMessage).join("\n");
	const redactNote = redactedCount > 0 ? `<span class="badge">已脱敏 ${redactedCount} 处</span>` : "<span class=\"badge\">未命中常见凭据形态</span>";
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
  .msg { margin: 0 0 22px; }
  .msg > header { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
  .who { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; letter-spacing: .02em; color: var(--muted); }
  .who::before { content: ''; width: 7px; height: 7px; border-radius: 999px; background: var(--line); }
  .msg.user .who { color: var(--accent); }
  .msg.user .who::before { background: var(--accent); }
  .msg.assistant .who::before { background: #1f9d63; }
  time { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .body { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; overflow-wrap: anywhere; box-shadow: 0 1px 2px rgba(16,16,24,.04); }
  .msg.user .body { background: var(--user); border-color: transparent; box-shadow: none; }
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
  .star {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    margin-top: 36px; padding: 16px 18px; border-radius: 14px;
    border: 1px solid var(--line); background: var(--card);
  }
  .star .txt { flex: 1; min-width: 200px; font-size: 13px; line-height: 1.6; color: var(--muted); }
  .star .txt b { color: var(--fg); font-weight: 600; }
  .star a {
    flex: none; display: inline-flex; align-items: center; gap: 6px;
    height: 34px; padding: 0 14px; border-radius: 9px; text-decoration: none;
    font-size: 13px; font-weight: 600; color: #6b4b00;
    background: linear-gradient(180deg, #ffd97a, #f7c948);
    border: 1px solid #e6b83a;
    box-shadow: 0 1px 2px rgba(0,0,0,.08);
  }
  .star a:hover { filter: brightness(1.03); }
  footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); }
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
  <button type="button" data-copy="content">复制正文</button>
</header>
<main>
  <article data-copy-source>
  <div class="page-head">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span>只读快照 · 生成于 ${escapeHtml(stamp)} UTC</span>
      <span>会话 <code>${escapeHtml(sessionId)}</code></span>
      ${redactNote}
      ${fingerprint === "" ? "" : `<span>指纹 <code>${escapeHtml(fingerprint)}</code></span>`}
    </div>
  </div>
  ${body}
  </article>
  <section class="star">
    <div class="txt">
      这份快照由开源插件 <b>dsh-share-link</b> 生成。<br>
      如果它帮你省了事，欢迎去仓库点个 Star —— 那是继续维护它的最大动力。
    </div>
    <a href="${STAR_URL}" target="_blank" rel="noreferrer">★ 在 GitHub 上点个 Star</a>
  </section>
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
function renderMarkdownDocument(input) {
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
  <button type="button" data-copy="content">复制正文</button>
</header>
<main>
  <article data-copy-source><div class="doc">${renderBody(markdown)}</div></article>
  <section class="star">
    <div class="txt">这份页面由开源插件 <b>dsh-share-link</b> 生成。觉得有用的话，欢迎去仓库点个 Star。</div>
    <a href="${STAR_URL}" target="_blank" rel="noreferrer">★ 在 GitHub 上点个 Star</a>
  </section>
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
function renderDirectoryIndex(input) {
	const { title, entries } = input;
	const rows = entries.map((entry) => `<li><a href="./${entry.name.split("/").map(encodeURIComponent).join("/")}">${escapeHtml(entry.name)}</a><span>${formatSize(entry.size)}</span></li>`).join("\n");
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
  <button type="button" data-copy="content">复制正文</button>
</header>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p class="hint">只读目录快照 · 由 dsh-share-link 生成</p>
  <article data-copy-source>
  <ul>
${rows}
  </ul>
  </article>
  <section class="star">
    <div class="txt">这份目录由开源插件 <b>dsh-share-link</b> 生成。觉得有用的话，欢迎去仓库点个 Star。</div>
    <a href="${STAR_URL}" target="_blank" rel="noreferrer">★ 在 GitHub 上点个 Star</a>
  </section>
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
//#endregion
//#region src/share-link.mjs
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
/** 单文件 / 单目录的体积与数量上限，防止误分享整个 home。 */
const LIMITS = {
	maxBytes: 100 * 1024 * 1024,
	maxFiles: 2e3
};
const MIME = {
	".html": "text/html; charset=utf-8",
	".htm": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".pdf": "application/pdf",
	".woff2": "font/woff2",
	".woff": "font/woff"
};
/** @param {string} file */
function mimeOf(file) {
	return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}
/**
* dsh 自己注入到 user 位置的「上下文噪音」前缀。
*
* 会话 surface 上的 `user/message` 既包含人类直接输入，也包含 harness 注入的
* 运行时上下文、system-reminder、技能清单等。分享页要的是**对话**，所以按
* 已知前缀丢掉后者——这是尽力而为的过滤，不是分类器。
*/
const INJECTED_PREFIXES = [
	"Current runtime context.",
	"<system-reminder>",
	"<available_skills>",
	"<environment",
	"Token budget",
	"Available skills",
	"Time sampled while"
];
/** 出现在注入上下文正文里的特征句（前缀之外的第二道网）。 */
const INJECTED_MARKERS = [
	"Browser time zone for this request",
	"Elapsed since the preceding model-visible message",
	"This snapshot supersedes earlier runtime-context snapshots"
];
/** @param {string} text */
function isInjectedContext(text) {
	const head = text.trimStart();
	if (INJECTED_PREFIXES.some((prefix) => head.startsWith(prefix))) return true;
	return INJECTED_MARKERS.some((marker) => head.includes(marker));
}
/**
* 从 surface 事件里投影出可渲染的消息。
* 只保留 user/assistant 的 **文本**；工具调用默认只留名字，结果正文一律不投影。
* @param {Array<{type: string, data: any, time?: number}>} events
* @param {{includeToolCalls?: boolean}} options
*/
function projectSurface(events, options = {}) {
	const messages = [];
	for (const event of events) {
		const data = event?.data ?? {};
		if (event.type === "user/message") {
			const text = messageText(data.content ?? data);
			if (text.trim() !== "" && !isInjectedContext(text)) messages.push({
				role: "user",
				text
			});
			continue;
		}
		if (event.type === "assistant/message") {
			const message = data.message ?? {};
			const text = messageText(message.content ?? message);
			const tools = options.includeToolCalls === true ? toolNames(message.content) : [];
			if (text.trim() !== "" || tools.length > 0) messages.push({
				role: "assistant",
				text: text.trim() === "" ? "（本步只有工具调用）" : text,
				tools
			});
			continue;
		}
		if (event.type === "tool/result" && options.includeToolCalls === true) {
			const name = data.message?.toolName ?? data.message?.name;
			if (typeof name === "string" && messages.length > 0 && messages.at(-1).role === "assistant") {
				const last = messages.at(-1);
				last.tools = [...last.tools ?? [], name];
			}
		}
	}
	return messages;
}
/** @param {any} content */
function messageText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map((part) => {
		if (typeof part === "string") return part;
		if (part?.type === "text" && typeof part.text === "string") return part.text;
		return "";
	}).filter(Boolean).join("\n");
	if (content && typeof content.text === "string") return content.text;
	return "";
}
/** @param {any} content */
function toolNames(content) {
	if (!Array.isArray(content)) return [];
	const names = [];
	for (const part of content) {
		const name = part?.toolName ?? part?.name;
		if ((part?.type === "tool-call" || part?.type === "tool_call") && typeof name === "string") names.push(name);
	}
	return [...new Set(names)];
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
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkFiles(root, full, acc);
			continue;
		}
		if (!entry.isFile()) continue;
		acc.push({
			name: relative(root, full).split(sep).join("/"),
			size: statSync(full).size
		});
	}
	return acc;
}
/**
* 一条分享的对外 URL。Surge 把整个目录部署成域名根；隧道/局域网走 `/s/<id>/`。
* @param {{provider?: string, origin: string, id: string, entry?: string}} entry
* @returns {string}
*/
function urlOf(entry) {
	const suffix = entry.entry === void 0 || entry.entry === "index.html" ? "" : entry.entry;
	return entry.provider === "surge" ? `${entry.origin}/${suffix}` : `${entry.origin}/s/${entry.id}/${suffix}`;
}
/** 递归统计目录体积与文件数。 */
function measure(target, acc = {
	bytes: 0,
	files: 0
}) {
	const info = statSync(target);
	if (info.isDirectory()) {
		for (const entry of readdirSync(target)) measure(join(target, entry), acc);
		return acc;
	}
	acc.bytes += info.size;
	acc.files += 1;
	return acc;
}
/** 取本机局域网地址，作为隧道不可用时的降级出口。 */
function lanAddress(port) {
	for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) if (entry.family === "IPv4" && entry.internal === false) return `http://${entry.address}:${port}`;
	return `http://127.0.0.1:${port}`;
}
/** 带引导信息的分享错误：client 半按 `guide` 渲染"去登录 / 去配置"入口。 */
var ShareError = class extends Error {
	/**
	* @param {string} code
	* @param {string} message
	* @param {object} [guide]
	*/
	constructor(code, message, guide) {
		super(message);
		this.name = "ShareError";
		this.code = code;
		this.guide = guide;
	}
};
/** 各通道缺配置时的引导文案。链接都指向官方入口，命令可直接复制。 */
const GUIDES = {
	surgeLogin: {
		code: "surgeLogin",
		title: "需要先登录 Surge",
		body: "Surge 用邮箱注册（免费），登录一次即可。本插件会复用本机的 Surge 登录状态。",
		href: "https://surge.sh/",
		linkText: "打开 surge.sh 注册 / 登录",
		command: "npm i -g surge && surge login"
	},
	surgeMissing: {
		code: "surgeMissing",
		title: "没有找到 surge 命令",
		body: "本机没有装 Surge CLI。装好并登录后，分享会自动走你的账号。",
		href: "https://surge.sh/",
		linkText: "surge.sh",
		command: "npm i -g surge"
	},
	surgeVerify: {
		code: "surgeVerify",
		title: "需要先验证 Surge 邮箱",
		body: "Surge 给这个账号发了验证邮件。点邮件里的链接，或在终端运行 surge verify 重新发送；验证后同一个域名就能打开。",
		href: "https://surge.sh/",
		linkText: "打开 surge.sh",
		command: "surge verify"
	},
	cfToken: {
		code: "cfToken",
		title: "命名隧道缺少 token",
		body: "命名隧道是你在 Cloudflare 上自建的隧道：需要在 Zero Trust 里创建，把 connector token 填到这里，并把域名路由到本机端口。没有自有域名就没法用，改用 Surge 或快速隧道。",
		href: "https://one.dash.cloudflare.com/",
		linkText: "打开 Cloudflare Zero Trust",
		command: null
	},
	cfHostname: {
		code: "cfHostname",
		title: "命名隧道缺少域名",
		body: "配置了 tunnelToken，但没有可访问的域名。命名隧道要在 Routes 里加一条 Published application（需要托管在 Cloudflare 的自有域名）并指向 localhost:3089；没有域名请改用 Surge 或快速隧道。",
		href: "https://one.dash.cloudflare.com/",
		linkText: "打开 Cloudflare Zero Trust",
		command: null
	},
	cfDownload: {
		code: "cfDownload",
		title: "cloudflared 不可用",
		body: "公网链接需要一个 cloudflared 可执行文件。可以自动下载，也可以自己装一个然后填 cloudflaredPath。",
		href: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
		linkText: "下载 cloudflared",
		command: "brew install cloudflared"
	}
};
/**
* 本机是否有 Surge 的登录态。Surge 把凭据写在 `~/.netrc` 的 `machine surge.sh` 段。
* @returns {boolean}
*/
function hasSurgeCredentials() {
	try {
		return readFileSync(join(homedir(), ".netrc"), "utf8").includes("surge.sh");
	} catch {
		return false;
	}
}
var ShareManager = class {
	/**
	* @param {object} options
	* @param {any} options.ctx - host 上下文（用于 sessionQuery / sessions）。
	* @param {object} [options.config]
	*/
	constructor({ ctx, config = {} }) {
		this.ctx = ctx;
		this.config = config;
		this.home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
		this.root = join(this.home, "share-link");
		this.sharesDir = join(this.root, "shares");
		this.indexFile = join(this.root, "index.json");
		this.port = 0;
		this.server = null;
		this.tunnel = null;
		this.tunnelOrigin = null;
		this.tunnelStarting = null;
	}
	async start() {
		mkdirSync(this.sharesDir, { recursive: true });
		await this.#listen();
		this.sweep();
	}
	async stop() {
		await this.#closeTunnel();
		await new Promise((done) => {
			if (this.server === null) return done();
			this.server.close(() => done());
			this.server = null;
		});
	}
	#listen() {
		if (this.server !== null) return Promise.resolve();
		const namedCapable = this.config.defaultChannel === "named" || (this.config.tunnelToken ?? "") !== "" && (this.config.tunnelHostname ?? "") !== "";
		const requested = Number.isInteger(this.config.port) && this.config.port > 0 ? this.config.port : namedCapable ? 3089 : 0;
		return new Promise((resolvePromise, reject) => {
			const server = createServer((request, response) => this.#serve(request, response));
			server.on("error", reject);
			server.listen(requested, "127.0.0.1", () => {
				this.server = server;
				this.port = server.address().port;
				resolvePromise();
			});
		});
	}
	get origin() {
		return this.tunnelOrigin ?? lanAddress(this.port);
	}
	#readIndex() {
		try {
			return JSON.parse(readFileSync(this.indexFile, "utf8"));
		} catch {
			return {};
		}
	}
	#writeIndex(index) {
		writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
	}
	/** 清掉过期条目与它们的目录。 */
	sweep() {
		const index = this.#readIndex();
		let dirty = false;
		const now = Date.now();
		for (const [id, entry] of Object.entries(index)) if (typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
			rmSync(join(this.sharesDir, id), {
				recursive: true,
				force: true
			});
			delete index[id];
			dirty = true;
		}
		if (dirty) this.#writeIndex(index);
	}
	/**
	* 把通道 id 解析成发布时需要的形态。
	* @param {string} [id] quick | surge | named | lan；省略时用默认通道
	*/
	resolveChannel(id) {
		switch (id ?? this.config.defaultChannel ?? "quick") {
			case "surge": return {
				id: "surge",
				provider: "surge"
			};
			case "lan": return {
				id: "lan",
				provider: "lan"
			};
			case "named": return {
				id: "named",
				provider: "tunnel",
				tunnelMode: "named"
			};
			default: return {
				id: "quick",
				provider: "tunnel",
				tunnelMode: "quick"
			};
		}
	}
	/**
	* 通道就绪情况：client 半在打开分享框时就查这个，未就绪直接给引导，而不是等失败。
	* @returns {Promise<{provider: string, ready: boolean, guide?: object, detail: string}>}
	*/
	async status() {
		const channels = {};
		channels.surge = await this.#surgeStatus();
		channels.quick = {
			ready: true,
			detail: "首次分享会自动下载 cloudflared"
		};
		channels.lan = {
			ready: true,
			detail: "仅同一局域网可访问"
		};
		channels.named = (this.config.tunnelToken ?? "") !== "" && (this.config.tunnelHostname ?? "") !== "" ? {
			ready: true,
			detail: `命名隧道 ${this.config.tunnelHostname}`
		} : (this.config.tunnelToken ?? "") === "" ? {
			ready: false,
			guide: GUIDES.cfToken,
			detail: "缺隧道 token"
		} : {
			ready: false,
			guide: GUIDES.cfHostname,
			detail: "缺对外域名"
		};
		const current = this.resolveChannel();
		const active = channels[current.id] ?? {
			ready: false,
			detail: ""
		};
		return {
			default: current.id,
			channels,
			provider: current.provider,
			ready: active.ready,
			via: active.via,
			detail: active.detail,
			guide: active.guide
		};
	}
	async #surgeStatus() {
		if (await whichTool("surge") === void 0) return {
			ready: false,
			guide: GUIDES.surgeMissing,
			detail: "没有 surge 可执行文件"
		};
		const via = typeof this.config.surgeToken === "string" && this.config.surgeToken !== "" ? "config-token" : (process.env.SURGE_TOKEN ?? "") !== "" ? "env-token" : hasSurgeCredentials() ? "netrc" : void 0;
		return via === void 0 ? {
			ready: false,
			guide: GUIDES.surgeLogin,
			detail: "surge 未登录"
		} : {
			ready: true,
			via,
			detail: via === "netrc" ? "surge 本机已登录" : "surge 已配置 token"
		};
	}
	list() {
		this.sweep();
		return Object.values(this.#readIndex()).map((entry) => ({
			...entry,
			url: urlOf(entry)
		})).sort((a, b) => b.createdAt - a.createdAt);
	}
	async revoke(id) {
		const index = this.#readIndex();
		if (index[id] === void 0) return false;
		const entry = index[id];
		if (entry.provider === "surge" && entry.domain !== void 0) await runTool("surge", ["teardown", entry.domain], this.#toolEnv()).catch(() => {});
		rmSync(join(this.sharesDir, id), {
			recursive: true,
			force: true
		});
		delete index[id];
		this.#writeIndex(index);
		return true;
	}
	/**
	* 分享当前会话的快照。
	* @param {string} sessionId
	* @param {{includeToolCalls?: boolean, ttlHours?: number, title?: string}} [options]
	*/
	async createSessionShare(sessionId, options = {}) {
		if (typeof sessionId !== "string" || sessionId === "") throw new Error("createSessionShare 需要 sessionId");
		const { header, messages } = await this.#readTranscript(sessionId, options);
		const rawText = JSON.stringify(messages);
		const safeMessages = messages.map((message) => ({
			...message,
			text: redact(message.text)
		}));
		const redactedCount = JSON.stringify(safeMessages) === rawText ? 0 : 1;
		let title = options.title;
		if (title === void 0) title = await this.#readTitle(sessionId);
		if (title === void 0 || title === "") title = `会话 ${sessionId.slice(0, 8)}`;
		const html = renderSessionPage({
			title,
			sessionId,
			createdAt: Date.now(),
			messages: safeMessages,
			fingerprint: createHash("sha256").update(rawText).digest("hex").slice(0, 16),
			redactedCount
		});
		return this.#publish({
			kind: "session",
			title,
			body: { "index.html": html },
			channel: options.channel,
			ttlHours: options.ttlHours,
			files: messages.length
		});
	}
	/**
	* 分享一个本地文件或目录（产物：HTML / Markdown / PPT / 截图…）。
	* @param {string} path - 绝对路径或相对 cwd 的路径。
	* @param {{title?: string, ttlHours?: number, cwd?: string}} [options]
	*/
	async createPathShare(path, options = {}) {
		const target = resolve(options.cwd ?? process.cwd(), path);
		if (!existsSync(target)) throw new Error(`路径不存在：${target}`);
		const info = statSync(target);
		const size = measure(target);
		if (size.bytes > LIMITS.maxBytes) throw new Error(`超过 ${LIMITS.maxBytes} 字节上限：${size.bytes}`);
		if (size.files > LIMITS.maxFiles) throw new Error(`超过 ${LIMITS.maxFiles} 个文件上限：${size.files}`);
		const body = {};
		let entry = "index.html";
		if (info.isDirectory()) {
			body[""] = target;
			if (!existsSync(join(target, "index.html"))) {
				const entries = walkFiles(target, target).sort((a, b) => a.name.localeCompare(b.name, "zh"));
				body["index.html"] = renderDirectoryIndex({
					title: target.split(sep).at(-1) ?? "files",
					entries
				});
			}
		} else if (/\.html?$/i.test(target)) body["index.html"] = readFileSync(target, "utf8");
		else if (/\.md$/i.test(target)) body["index.html"] = renderMarkdownDocument({
			title: (target.split(sep).at(-1) ?? "document").replace(/\.md$/i, ""),
			markdown: readFileSync(target, "utf8")
		});
		else {
			const name = target.split(sep).at(-1) ?? "file";
			body[name] = readFileSync(target);
			entry = name;
		}
		const title = options.title ?? (info.isDirectory() ? target.split(sep).at(-1) : target.split(sep).at(-1));
		return this.#publish({
			kind: "path",
			title,
			body,
			channel: options.channel,
			ttlHours: options.ttlHours,
			entry,
			source: target,
			files: size.files
		});
	}
	/**
	* 读取一个会话的完整消息序列。
	*
	* 走持久化读句柄而不是 sessionQuery：后者的可见性按 workspace 收窄，
	* 而分享是「按 id 取这一份日志」，不该被索引状态挡住。surface 折叠交给
	* 官方 `foldSurface`，压过缩（replacement）等语义与 GUI 保持一致。
	*/
	async #readTranscript(sessionId, options = {}) {
		const sessions = this.ctx.get("sessions");
		const live = sessions?.get?.(sessionId);
		if (live !== void 0) await sessions.flush(live);
		try {
			const surface = await this.ctx.sessionQuery.readSurface(sessionId);
			const projected = projectSurface(surface.events ?? [], options);
			if (projected.length > 0) return {
				header: surface.session,
				messages: projected
			};
		} catch {}
		const persistence = this.ctx.get("sessionPersistence");
		if (persistence === void 0) throw new Error("宿主未挂载 sessionPersistence，无法读取会话");
		const handle = await persistence.open(sessionId, "read");
		try {
			const { events } = await handle.read(0, void 0);
			const folded = foldSurface(events);
			const messages = [];
			for (const seq of folded.nodes) {
				const message = folded.projectedMessages.get(seq);
				if (message === void 0) continue;
				const role = message.role;
				if (role !== "user" && role !== "assistant") continue;
				const text = messageText(message.content);
				const tools = role === "assistant" && options.includeToolCalls === true ? toolNames(message.content) : [];
				if (text.trim() === "" && tools.length === 0) continue;
				messages.push({
					role,
					text: text.trim() === "" ? "（本步只有工具调用）" : text,
					tools
				});
			}
			return {
				header: handle.header,
				messages
			};
		} finally {
			await handle.close();
		}
	}
	async #readTitle(sessionId) {
		try {
			const snapshot = await this.ctx.sessionQuery?.readTitle?.(sessionId);
			const title = snapshot?.title ?? snapshot?.value;
			return typeof title === "string" && title !== "" ? title : void 0;
		} catch {
			return;
		}
	}
	/**
	* @param {{kind: string, title: string, body: Record<string, string|Buffer>, ttlHours?: number, entry?: string, source?: string, files?: number}} input
	*/
	async #publish(input) {
		const id = randomBytes(16).toString("hex");
		const dir = join(this.sharesDir, id);
		mkdirSync(dir, { recursive: true });
		for (const [name, content] of Object.entries(input.body)) {
			if (name === "") {
				cpSync(content, dir, { recursive: true });
				continue;
			}
			writeFileSync(join(dir, name), content);
		}
		const ttlHours = Number.isFinite(input.ttlHours) && input.ttlHours > 0 ? input.ttlHours : this.config.ttlHours ?? 168;
		const channel = this.resolveChannel(input.channel);
		let origin;
		let provider;
		let domain;
		let degraded = false;
		let degradedReason;
		if (channel.provider === "surge") {
			const deployed = await this.#deploySurge(dir, `${this.config.surgePrefix ?? "dsh-share"}-${id.slice(0, 8)}`);
			origin = deployed.url;
			domain = deployed.domain;
			provider = "surge";
		} else if (channel.provider === "lan") {
			await this.#listen();
			origin = lanAddress(this.port);
			provider = "lan";
		} else {
			await this.#ensureOrigin(channel.tunnelMode);
			origin = this.origin;
			provider = this.tunnelOrigin === null ? "lan" : "tunnel";
			if (provider === "lan" && this.degradedReason !== void 0) {
				degraded = true;
				degradedReason = this.degradedReason;
			}
		}
		const createdAt = Date.now();
		const entry = {
			id,
			kind: input.kind,
			title: input.title,
			createdAt,
			expiresAt: createdAt + ttlHours * 3600 * 1e3,
			provider,
			channel: channel.id,
			domain,
			origin,
			degraded: degraded || void 0,
			degradedReason,
			entry: input.entry ?? "index.html",
			source: input.source,
			files: input.files ?? 1
		};
		const index = this.#readIndex();
		index[id] = entry;
		this.#writeIndex(index);
		return {
			...entry,
			url: urlOf(entry)
		};
	}
	/** 外部发布工具的进程环境（Surge token 从配置注入，不落盘）。 */
	#toolEnv() {
		const env = { ...process.env };
		if (typeof this.config.surgeLogin === "string" && this.config.surgeLogin !== "") env.SURGE_LOGIN = this.config.surgeLogin;
		if (typeof this.config.surgeToken === "string" && this.config.surgeToken !== "") env.SURGE_TOKEN = this.config.surgeToken;
		return env;
	}
	/**
	* 把已落盘的分享目录发到 Surge（持久链接，`surge teardown <domain>` 可撤销）。
	* @param {string} dir
	* @param {string} slug
	*/
	async #deploySurge(dir, slug) {
		const domain = typeof this.config.surgeDomain === "string" && this.config.surgeDomain !== "" ? `${slug}.${this.config.surgeDomain}` : `${slug}.surge.sh`;
		let output = "";
		try {
			output = await runTool("surge", [dir, domain], this.#toolEnv());
			if (/email verification|surge verify/i.test(output)) throw new ShareError("surge-verify", "Surge 要求先验证邮箱，链接现在打不开（403）", GUIDES.surgeVerify);
		} catch (error) {
			if (error instanceof ShareError) throw error;
			const text = String(error?.message ?? error);
			if (/not logged in|login required|unauthor|forbidden|401|403/i.test(text)) throw new ShareError("surge-login", `Surge 没有登录：${text}`, GUIDES.surgeLogin);
			if (/ENOENT|not found/i.test(text)) throw new ShareError("surge-missing", `找不到 surge 命令：${text}`, GUIDES.surgeMissing);
			throw new ShareError("surge-failed", text, GUIDES.surgeLogin);
		}
		return {
			domain,
			url: `https://${domain}`
		};
	}
	async #ensureOrigin(mode = "quick") {
		if (this.tunnelOrigin !== null && this.tunnelMode === mode) return this.tunnelOrigin;
		if (this.tunnelOrigin !== null && this.tunnelMode !== mode) await this.#closeTunnel();
		if (this.tunnelStarting !== null) return await this.tunnelStarting;
		this.tunnelStarting = this.#startTunnel(mode).finally(() => {
			this.tunnelStarting = null;
		});
		await this.tunnelStarting;
		return this.tunnelOrigin;
	}
	async #startTunnel(mode = "quick") {
		if (mode === "named") {
			const token = this.config.tunnelToken;
			if (typeof token !== "string" || token === "") throw new Error("命名隧道缺少 token");
			return await this.#startNamedTunnel(token);
		}
		let binary;
		try {
			binary = await resolveCloudflared(this.root, this.config.cloudflaredPath);
		} catch (error) {
			this.ctx.logger?.warn?.(`[share-link] cloudflared 不可用，降级为局域网链接：${String(error)}`);
			return;
		}
		const child = spawn(binary, [
			"tunnel",
			"--url",
			`http://127.0.0.1:${this.port}`,
			"--no-autoupdate"
		], { stdio: [
			"ignore",
			"pipe",
			"pipe"
		] });
		this.tunnel = child;
		const origin = await new Promise((resolvePromise, reject) => {
			const timer = setTimeout(() => reject(/* @__PURE__ */ new Error("cloudflared 30s 内没有给出公网地址")), 3e4);
			const onData = (chunk) => {
				const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
				if (match === null) return;
				clearTimeout(timer);
				resolvePromise(match[0]);
			};
			child.stdout.on("data", onData);
			child.stderr.on("data", onData);
			child.on("exit", (code) => {
				clearTimeout(timer);
				reject(/* @__PURE__ */ new Error(`cloudflared 退出（code ${code}）`));
			});
		}).catch((error) => {
			child.kill("SIGTERM");
			this.tunnel = null;
			this.degradedReason = String(error?.message ?? error);
			this.ctx.logger?.warn?.(`[share-link] 隧道启动失败，降级为局域网链接：${String(error)}`);
			return null;
		});
		this.tunnelOrigin = origin;
		this.tunnelMode = mode;
		child.on("exit", () => {
			if (this.tunnel !== child) return;
			this.tunnel = null;
			this.tunnelOrigin = null;
			this.tunnelMode = null;
		});
		return origin;
	}
	/**
	* 命名隧道：地址固定（`https://<tunnelHostname>`），因此分享服务端口也必须固定。
	* @param {string} token
	*/
	async #startNamedTunnel(token) {
		const hostname = this.config.tunnelHostname;
		if (typeof hostname !== "string" || hostname === "") throw new Error("配置了 tunnelToken 但缺少 tunnelHostname：请填写你在 Cloudflare 上绑定的域名");
		const child = spawn(await resolveCloudflared(this.root, this.config.cloudflaredPath), [
			"tunnel",
			"--no-autoupdate",
			"run",
			"--token",
			token
		], { stdio: [
			"ignore",
			"pipe",
			"pipe"
		] });
		this.tunnel = child;
		await new Promise((done) => setTimeout(done, 2500));
		if (child.exitCode !== null) {
			this.tunnel = null;
			throw new Error("cloudflared 命名隧道启动失败：token 无效，或该隧道没有指向本机端口");
		}
		this.tunnelOrigin = `https://${hostname}`;
		this.tunnelMode = "named";
		return this.tunnelOrigin;
	}
	async #closeTunnel() {
		const child = this.tunnel;
		this.tunnel = null;
		this.tunnelOrigin = null;
		if (child === null) return;
		child.kill("SIGTERM");
	}
	#serve(request, response) {
		const url = new URL(request.url ?? "/", `http://127.0.0.1:${this.port}`);
		const send = (status, body, headers = {}) => {
			response.writeHead(status, {
				"cache-control": "no-store",
				"x-content-type-options": "nosniff",
				"x-robots-tag": "noindex, nofollow",
				"referrer-policy": "no-referrer",
				...headers
			});
			response.end(body);
		};
		if (request.method !== "GET" && request.method !== "HEAD") return send(405, "method not allowed");
		if (url.pathname === "/healthz") return send(200, "ok");
		const match = url.pathname.match(/^\/s\/([a-f0-9]{8,64})(\/.*)?$/);
		if (match === null) return send(404, "not found");
		const [, id, rest = "/"] = match;
		if (this.#readIndex()[id] === void 0) return send(404, "not found");
		const base = join(this.sharesDir, id);
		const file = resolve(base, `.${rest === "/" ? "/index.html" : rest}`);
		if (!file.startsWith(base + sep)) return send(403, "forbidden");
		if (!existsSync(file) || statSync(file).isDirectory()) return send(404, "not found");
		return send(200, readFileSync(file), { "content-type": mimeOf(file) });
	}
};
/**
* 找到可用的 cloudflared：显式配置 > PATH > 本插件缓存目录 > 现下载。
* @param {string} root - `$DSH_HOME/share-link`。
* @param {string} [explicit]
* @returns {Promise<string>}
*/
async function resolveCloudflared(root, explicit) {
	if (typeof explicit === "string" && explicit !== "") return explicit;
	const cached = join(root, "bin", "cloudflared");
	if (existsSync(cached)) return cached;
	for (const dir of (process.env.PATH ?? "").split(":")) {
		const candidate = join(dir, "cloudflared");
		if (existsSync(candidate)) return candidate;
	}
	return await downloadCloudflared(join(root, "bin"));
}
/**
* 下载 cloudflared（仅 macOS/Linux）。走 GitHub Releases，失败时尝试镜像。
* @param {string} binDir
* @returns {Promise<string>}
*/
async function downloadCloudflared(binDir) {
	mkdirSync(binDir, { recursive: true });
	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	const asset = `cloudflared-${process.platform === "darwin" ? "darwin" : "linux"}-${arch}.tgz`;
	const bases = [`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`, `https://ghproxy.net/https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`];
	const errors = [];
	for (const url of bases) try {
		const response = await fetch(url, { redirect: "follow" });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const archive = join(binDir, `${asset}.tmp`);
		writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
		await new Promise((done, fail) => {
			const tar = spawn("tar", [
				"-xzf",
				archive,
				"-C",
				binDir
			], { stdio: "inherit" });
			tar.on("exit", (code) => code === 0 ? done() : fail(/* @__PURE__ */ new Error(`tar 退出 ${code}`)));
			tar.on("error", fail);
		});
		rmSync(archive, { force: true });
		const binary = join(binDir, "cloudflared");
		if (!existsSync(binary)) throw new Error("解压后没有 cloudflared");
		return binary;
	} catch (error) {
		errors.push(`${url}: ${String(error)}`);
	}
	throw new Error(`下载 cloudflared 失败\n${errors.join("\n")}`);
}
/**
* 运行一个外部发布工具：优先用 PATH 上的同名可执行文件，否则退回 `npx --yes <name>`。
* @param {string} name
* @param {string[]} args
* @param {NodeJS.ProcessEnv} env
* @returns {Promise<string>} 合并后的 stdout + stderr。
*/
function runTool(name, args, env) {
	return whichTool(name).then((binary) => new Promise((resolvePromise, reject) => {
		const argv = binary === void 0 ? [
			"--yes",
			name,
			...args
		] : args;
		const child = spawn(binary ?? "npx", argv, {
			env,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += String(chunk);
		});
		child.stderr.on("data", (chunk) => {
			output += String(chunk);
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolvePromise(output);
			else reject(/* @__PURE__ */ new Error(`${name} 退出 ${code}：${output.slice(-400)}`));
		});
	}));
}
/**
* 在 PATH 上找可执行文件。
* @param {string} name
* @returns {Promise<string|undefined>}
*/
async function whichTool(name) {
	for (const dir of (process.env.PATH ?? "").split(":")) {
		if (dir === "") continue;
		const candidate = join(dir, name);
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {}
	}
}
//#endregion
//#region src/index.mjs
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
const name = "dsh-share-link";
/** 分享服务依赖的宿主能力：工具注册、会话读取、同源 HTTP 路由。 */
const inject = [
	"tools",
	"sessionQuery",
	"connection"
];
/** 配置项。`port` 传 0 表示随机端口（推荐，避免与宿主端口冲突）。 */
/** 配置默认值（设置卡与运行时共用同一份，避免两处漂移）。 */
const DEFAULTS = Object.freeze({
	defaultChannel: "quick",
	provider: "tunnel",
	tunnelMode: "quick",
	port: 0,
	ttlHours: 168,
	cloudflaredPath: "",
	tunnelToken: "",
	tunnelHostname: "",
	surgeLogin: "",
	surgeToken: "",
	surgeDomain: "",
	surgePrefix: "dsh-share"
});
const Config = Schema.object({
	defaultChannel: Schema.union([
		"quick",
		"surge",
		"named",
		"lan"
	]).default(DEFAULTS.defaultChannel).volatile().description("分享弹窗里默认选中的通道"),
	provider: Schema.union([
		"tunnel",
		"lan",
		"surge"
	]).default(DEFAULTS.provider).volatile().description("tunnel = 公网 cloudflared（可撤销）；lan = 仅同局域网；surge = Surge 持久域名（可 teardown）"),
	tunnelMode: Schema.union(["quick", "named"]).default(DEFAULTS.tunnelMode).volatile().description("quick = cloudflared 临时域名；named = 你在 Cloudflare 自建的固定域名隧道（需要自有域名）"),
	port: Schema.natural().default(DEFAULTS.port).volatile().description("只读分享服务端口，0 = 随机（命名隧道模式下自动用 3089）"),
	ttlHours: Schema.natural().min(1).max(720).default(DEFAULTS.ttlHours).volatile().description("分享链接默认有效期（小时）"),
	cloudflaredPath: Schema.string().default(DEFAULTS.cloudflaredPath).volatile().description("已有 cloudflared 可执行文件路径；留空则自动查找/下载"),
	tunnelToken: Schema.string().default(DEFAULTS.tunnelToken).volatile().description("Cloudflare 命名隧道的 token；填了就产出固定域名链接"),
	tunnelHostname: Schema.string().default(DEFAULTS.tunnelHostname).volatile().description("命名隧道绑定的域名，例如 share.example.com"),
	surgeLogin: Schema.string().default(DEFAULTS.surgeLogin).volatile().description("Surge 账号邮箱；配合 surgeToken 免交互登录"),
	surgeToken: Schema.string().default(DEFAULTS.surgeToken).volatile().description("Surge token（`surge tokens add`）；只注入给子进程，不落盘"),
	surgeDomain: Schema.string().default(DEFAULTS.surgeDomain).volatile().description("Surge 域名后缀，例如 example.com；留空用 slug.surge.sh"),
	surgePrefix: Schema.string().default(DEFAULTS.surgePrefix).volatile().description("Surge 子域前缀，最终域名是 <prefix>-<id>.surge.sh")
});
/**
* 解引用 volatile 叶并补默认值。volatile 叶在运行时是 `{ get() }` 包装，
* 每次要用就重读——别缓存引用本身。
* @param {any} raw
*/
function readConfig(raw) {
	const unwrap = (value) => {
		if (value !== null && typeof value === "object" && typeof value.get === "function" && Object.keys(value).length === 1) return unwrap(value.get());
		if (Array.isArray(value)) return value.map(unwrap);
		if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrap(item)]));
		return value;
	};
	return {
		...DEFAULTS,
		...unwrap(raw ?? {})
	};
}
/** 通道的中文说法，用于工具回复。 */
const CHANNEL_LABEL = {
	tunnel: "公网隧道",
	lan: "局域网",
	surge: "Surge 持久域名"
};
const TEXT_OUTPUT = {
	schema: { type: "string" },
	render: (_args, value) => [{
		type: "text",
		text: value
	}]
};
/** 失败时把引导也交给 agent，让它能直接告诉用户下一步点什么。 */
function describeError(error) {
	const message = String(error?.message ?? error);
	if (!(error instanceof ShareError) || error.guide === void 0) return message;
	const { title, body, href, linkText, command } = error.guide;
	return [
		message,
		`引导：${title}——${body}`,
		href === void 0 ? "" : `入口：${linkText ?? href} ${href}`,
		command === void 0 || command === null ? "" : `命令：${command}`
	].filter(Boolean).join("\n");
}
/** 分享成功后的统一文案：链接 + 有效期 + 撤销提示。 */
function describeShare(entry) {
	const expires = new Date(entry.expiresAt).toISOString().replace("T", " ").slice(0, 16);
	return [
		`已发布：${entry.url}`,
		`类型：${entry.kind === "session" ? "会话快照（只读）" : "文件/目录（只读）"} · 通道：${CHANNEL_LABEL[entry.provider] ?? entry.provider} · 到期：${expires} UTC`,
		entry.degraded === true ? `⚠️ 已降级为局域网链接：${entry.degradedReason ?? "公网通道不可用"}（链接只在同一网络内可访问）` : "",
		`撤销：share_revoke id=${entry.id}`
	].filter(Boolean).join("\n");
}
/**
* 注册分享服务、工具与同源路由。
* @param {any} ctx - host 上下文。
* @param {any} [config]
*/
function apply(ctx, config = {}) {
	let liveConfig = readConfig(config);
	const manager = new ShareManager({
		ctx,
		config: liveConfig
	});
	ctx.effect(() => ctx.on("loader/volatile-update", () => {
		liveConfig = readConfig(config);
		manager.config = liveConfig;
	}), "share-link: live config");
	ctx.effect(() => {
		manager.start().catch((error) => {
			ctx.logger?.warn?.(`[share-link] 分享服务未启动：${String(error)}`);
		});
		return () => {
			manager.stop();
		};
	}, "share-link: readonly server");
	ctx.effect(() => ctx.tools.register(defineTool({
		name: "share_session",
		description: "Publish a read-only snapshot of the current session as a public link. Use when the user asks to share this conversation. The snapshot is static, redacted, and stops working after revocation or expiry.",
		parameters: {
			include_tool_calls: {
				type: "boolean",
				description: "是否在快照里保留工具名（结果正文始终不保留）"
			},
			channel: {
				type: "string",
				description: "通道：quick | surge | named | lan；默认取设置里的默认通道"
			},
			title: {
				type: "string",
				description: "分享页标题；默认用会话标题"
			},
			ttl_hours: {
				type: "number",
				description: "链接有效期（小时），默认取插件配置"
			}
		},
		output: TEXT_OUTPUT,
		execute: async (args, exec) => {
			const sessionId = exec.agent?.session?.id;
			if (typeof sessionId !== "string") throw new Error("share_session 需要 agent 绑定的会话");
			return describeShare(await manager.createSessionShare(sessionId, {
				includeToolCalls: args.include_tool_calls === true,
				channel: args.channel,
				title: args.title,
				ttlHours: args.ttl_hours
			}).catch((error) => {
				throw new Error(describeError(error));
			}));
		}
	})), "share-link: tool share_session");
	ctx.effect(() => ctx.tools.register(defineTool({
		name: "share_artifact",
		description: "Publish a local file or directory (HTML page, Markdown, slides, build output) as a read-only public link. Directories must contain index.html; a single .html file is served at the link root.",
		parameters: {
			path: {
				type: "string",
				required: true,
				description: "文件或目录路径，绝对路径或相对会话工作目录"
			},
			channel: {
				type: "string",
				description: "通道：quick | surge | named | lan；默认取设置里的默认通道"
			},
			title: {
				type: "string",
				description: "分享页标题；默认用文件名"
			},
			ttl_hours: {
				type: "number",
				description: "链接有效期（小时）"
			}
		},
		output: TEXT_OUTPUT,
		execute: async (args, exec) => {
			const cwd = exec.agent?.session?.header?.cwd ?? process.cwd();
			return describeShare(await manager.createPathShare(args.path, {
				cwd,
				title: args.title,
				ttlHours: args.ttl_hours
			}).catch((error) => {
				throw new Error(describeError(error));
			}));
		}
	})), "share-link: tool share_artifact");
	ctx.effect(() => ctx.tools.register(defineTool({
		name: "share_list",
		description: "List the currently active share links with their ids, kinds, and expiry.",
		parameters: {},
		output: TEXT_OUTPUT,
		execute: async () => {
			const entries = manager.list();
			if (entries.length === 0) return "当前没有活跃的分享链接。";
			return entries.map((entry) => `${entry.id}  ${entry.kind === "session" ? "会话" : "文件"}  ${new Date(entry.createdAt).toISOString().slice(0, 16)} UTC  ${entry.url}`).join("\n");
		}
	})), "share-link: tool share_list");
	ctx.effect(() => ctx.tools.register(defineTool({
		name: "share_revoke",
		description: "Revoke one share link by id. The link stops working immediately and its snapshot is deleted from disk.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "share_session / share_artifact 返回的 id"
		} },
		output: TEXT_OUTPUT,
		execute: async (args) => await manager.revoke(args.id) ? `已撤销 ${args.id}，链接立即失效。` : `没有找到 ${args.id}`
	})), "share-link: tool share_revoke");
	const route = (path, methods, handler) => ctx.connection.fetch.register({
		path,
		methods,
		requestBody: "buffered",
		fetch: async (request) => {
			const origin = request.headers.get("origin");
			const host = request.headers.get("host");
			if (origin !== null && host !== null && new URL(origin).host !== host) return json({ error: "cross-origin request rejected" }, 403);
			try {
				return await handler(request);
			} catch (error) {
				return json({
					error: String(error?.message ?? error),
					code: error?.code,
					guide: error?.guide
				}, 400);
			}
		}
	});
	route("/api/share-link/session", ["POST"], async (request) => {
		const body = await readJson(request);
		return json(await manager.createSessionShare(body.sessionId, {
			includeToolCalls: body.includeToolCalls === true,
			channel: body.channel,
			title: body.title,
			ttlHours: body.ttlHours
		}));
	});
	route("/api/share-link/path", ["POST"], async (request) => {
		const body = await readJson(request);
		return json(await manager.createPathShare(body.path, {
			channel: body.channel,
			title: body.title,
			ttlHours: body.ttlHours,
			cwd: body.cwd
		}));
	});
	route("/api/share-link/status", ["GET"], async () => json(await manager.status()));
	route("/api/share-link/list", ["GET"], async () => json({ items: manager.list() }));
	route("/api/share-link/revoke", ["POST"], async (request) => {
		const body = await readJson(request);
		return json({ revoked: await manager.revoke(body.id) });
	});
}
/** @param {any} request */
async function readJson(request) {
	const text = await request.text();
	if (text.trim() === "") return {};
	return JSON.parse(text);
}
/** @param {unknown} payload @param {number} [status] */
function json(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}
//#endregion
export { Config, DEFAULTS, apply, inject, name, readConfig };
