/**
 * 分享页的 favicon：蓝→青渐变方块 + 白色链接字形，32×32（2× 资源，64×64 PNG）。
 *
 * 为什么内嵌 data URI：分享页的约束是「一个文件、离线能开、零外部请求」，而且页面
 * CSP 是 `default-src 'none'`（`img-src` 放行 `data:`）——外链 favicon 既破坏离线也
 * 会被 CSP 挡掉。占位约 2.2 KB，可以接受。
 *
 * **生成物，别手改**：出处是仓库根目录的 `icon.svg`（同一套渐变与字形）。重新生成
 * 的办法记在 AGENTS.local.md「分享页模板」一节（用无头浏览器把 32×32 的图渲染成
 * 64×64 PNG，再 base64）。
 *
 * @module dsh-share-link/favicon
 */

/** `data:` URI 形式的 32×32 PNG。 */
export const FAVICON_DATA_URI =
  'data:image/png;base64,' + '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'

/** 三套页面 `<head>` 里共用的 `<link>`。 */
export const FAVICON_LINK =
  '<link rel="icon" type="image/png" sizes="32x32" href="' + FAVICON_DATA_URI + '">'
