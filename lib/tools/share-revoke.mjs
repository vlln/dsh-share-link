import { t as TEXT_OUTPUT } from "../tool-kit-OVLm0ysA.mjs";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/tools/share-revoke.mjs
/**
* `share_revoke` —— 按 id 撤销一条分享，链接立刻 404。
*
* @module dsh-share-link/tools/share-revoke
*/
const name = "tool-share-revoke";
const inject = ["tools", "shareLink"];
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "share_revoke",
		description: "Revoke one share link by id. The link stops working immediately and its snapshot is deleted from disk.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "share_session / share_artifact 返回的 id"
		} },
		output: TEXT_OUTPUT,
		execute: async (args) => await ctx.shareLink.revoke(args.id) ? `已撤销 ${args.id}，链接立即失效。` : `没有找到 ${args.id}`
	}));
}
//#endregion
export { apply, inject, name };
