/**
 * 分享页渲染与白名单的回归测试。
 *
 * 这里测的是**安全边界**，不是观感：每一条 `sanitizeHtml` 用例都对应一个真实
 * 能执行的绕过（2026-10-22 审计时实测过），改渲染器时先跑这个。
 *
 *   node --test test/
 */

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'

import {
  PAGE_CSP,
  redact,
  renderMarkdownDocument,
  renderSessionPage,
  sanitizeHtml,
} from '../src/session-page.mjs'

test('单引号属性里夹引号不能逃逸出 onerror', () => {
  const output = sanitizeHtml(`<img src='x" onerror="alert(1)'>`)
  assert.equal(output, '<img src="x&quot; onerror=&quot;alert(1)">')
  assert.ok(!/<img[^>]*\sonerror="alert\(1\)"/.test(output), output)
})

test('协议校验看解码后的值：实体 / 换行 / 大小写都挡掉', () => {
  const payloads = [
    `<a href="java&#115;cript:alert(1)">x</a>`,
    `<a href="java&#x73;cript:alert(1)">x</a>`,
    `<a href="java\nscript:alert(1)">x</a>`,
    `<a href="java&#9;script:alert(1)">x</a>`,
    `<a href=" JaVaScRiPt:alert(1)">x</a>`,
    `<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>`,
  ]
  for (const payload of payloads) {
    assert.equal(sanitizeHtml(payload), '<a>x</a>', payload)
  }
})

test('data: 只允许出现在图片类属性上', () => {
  assert.equal(sanitizeHtml(`<img src="data:image/png;base64,AAA">`), `<img src="data:image/png;base64,AAA">`)
  assert.equal(sanitizeHtml(`<a href="data:text/html,<b>x</b>">x</a>`), '<a>x</a>')
})

test('正常的 https 链接与查询串保持原样（不被二次转义）', () => {
  const link = `<a href="https://example.com/a?x=1&amp;y=2">ok</a>`
  assert.equal(sanitizeHtml(link), link)
})

test('脚本 / 样式 / 框架整块丢弃，内联事件与未知属性被剥掉', () => {
  assert.equal(sanitizeHtml('<script>alert(1)</script>'), '')
  assert.equal(sanitizeHtml('<style>body{}</style>'), '')
  assert.equal(sanitizeHtml('<iframe src="https://x"></iframe>'), '')
  assert.equal(sanitizeHtml('<p onclick="alert(1)">x</p>'), '<p>x</p>')
  assert.equal(sanitizeHtml('<p id="x" style="color:red">x</p>'), '<p>x</p>')
})

test('markdown 产物保留表格 / 图片 / 代码壳', () => {
  const html = renderMarkdownDocument({
    title: 'doc',
    markdown: '# 标题\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n\n![](docs/a.png)',
  })
  assert.match(html, /<table>/)
  assert.match(html, /<h1>标题<\/h1>|# 标题/)
  assert.match(html, /data-copy="code"/)
  assert.match(html, /<img src="docs\/a.png"/)
})

test('分享页带 CSP，且 script-src 的 hash 与页面里的内联脚本逐字节一致', () => {
  const page = renderSessionPage({
    title: 't',
    sessionId: 'session-x',
    createdAt: Date.UTC(2026, 9, 22),
    messages: [{ role: 'user', text: 'hi' }],
  })
  assert.match(page, /<meta http-equiv="Content-Security-Policy"/)
  const script = /<script>([\s\S]*?)<\/script>/.exec(page)?.[1]
  assert.ok(script !== undefined, '页面里应该有复制脚本')
  const hash = createHash('sha256').update(`<script>${script}</script>`).digest('base64')
  assert.ok(PAGE_CSP.includes(`'sha256-${hash}'`), 'CSP hash 与脚本不一致，复制按钮会被浏览器拦掉')
})

test('脱敏：家目录压成 ~，但不动 URL 里的 /home/', () => {
  const text = 'see https://example.com/home/docs and /Users/vlln/Project/x'
  const output = redact(text)
  assert.ok(output.includes('https://example.com/home/docs'), output)
  assert.ok(output.includes('~/Project/x'), output)
  assert.ok(!output.includes('/Users/vlln'), output)
})

test('会话正文不解释 HTML（模型写的 <div> 只是文本）', () => {
  const page = renderSessionPage({
    title: 't',
    sessionId: 's',
    createdAt: Date.UTC(2026, 9, 22),
    messages: [{ role: 'assistant', text: '<div onclick="x">hi</div>' }],
  })
  assert.ok(page.includes('&lt;div onclick=&quot;x&quot;&gt;hi&lt;/div&gt;'), page)
  assert.ok(!page.includes('<div onclick="x">'))
})
