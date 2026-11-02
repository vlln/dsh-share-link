/**
 * `share_revoke` —— 按 id 撤销一条分享，链接立刻 404。
 *
 * @module dsh-share-link/tools/share-revoke
 */

import { defineTool } from '@deepseek-ai/dsh-tools'

import { TEXT_OUTPUT } from '../tool-kit.mjs'

export const name = 'tool-share-revoke'

export const inject = ['tools', 'shareLink']

export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: 'share_revoke',
      description: 'Revoke one share link by id. The link stops working immediately and its snapshot is deleted from disk.',
      parameters: {
        id: { type: 'string', required: true, description: 'share_session / share_artifact 返回的 id' },
      },
      output: TEXT_OUTPUT,
      execute: async (args) =>
        (await ctx.shareLink.revoke(args.id)) ? `已撤销 ${args.id}，链接立即失效。` : `没有找到 ${args.id}`,
    }),
  )
}
