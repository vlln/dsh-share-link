import { n as describeError, r as describeShare, t as TEXT_OUTPUT } from "../tool-kit-CFU8fmzI.mjs";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/tools/share-session.mjs
/**
* `share_session` —— 把当前会话发布成只读快照。
*
* 独立插件（不是 core 里的一个开关）：默认 `disabled: true`，装的人在 Plugins 页
* 的 Components 里自己打开；关掉它就等于关掉这个工具，不需要额外配置。
*
* @module dsh-share-link/tools/share-session
*/
const name = "tool-share-session";
/** `shareLink` 由 core 插件提供；工具只是它的消费者。 */
const inject = ["tools", "shareLink"];
function apply(ctx) {
	ctx.tools.register(defineTool({
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
			return describeShare(await ctx.shareLink.createSessionShare(sessionId, {
				includeToolCalls: args.include_tool_calls === true,
				channel: args.channel,
				title: args.title,
				ttlHours: args.ttl_hours
			}).catch((error) => {
				throw new Error(describeError(error));
			}));
		}
	}));
}
//#endregion
export { apply, inject, name };
