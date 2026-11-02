/**
 * `share_list` —— 列出还活着的分享链接。
 *
 * @module dsh-share-link/tools/share-list
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

import { TEXT_OUTPUT } from '../tool-kit.mjs'

export const name = 'tool-share-list'

export const inject = ['tools', 'shareLink']

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'share_list',
      description: 'List the currently active share links with their ids, kinds, and expiry.',
      parameters: {},
      output: TEXT_OUTPUT,
      execute: async () => {
        const entries = ctx.shareLink.list()
        if (entries.length === 0) return '当前没有活跃的分享链接。'
        return entries
          .map(
            (entry) =>
              `${entry.id}  ${entry.kind === 'session' ? '会话' : '文件'}  ${new Date(entry.createdAt).toISOString().slice(0, 16)} UTC  ${entry.url}`,
          )
          .join('\n')
      },
    }),
  )
}
