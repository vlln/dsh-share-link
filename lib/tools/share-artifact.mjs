import { n as describeError, r as describeShare, t as TEXT_OUTPUT } from "../tool-kit-OVLm0ysA.mjs";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/tools/share-artifact.mjs
/**
* `share_artifact` —— 把本地文件或目录发布成只读链接。
*
* 独立插件，默认关；开启方式见 README「让 agent 帮你发」。
*
* @module dsh-share-link/tools/share-artifact
*/
const name = "tool-share-artifact";
const inject = ["tools", "shareLink"];
function apply(ctx) {
	ctx.tools.register(defineTool({
		name: "share_artifact",
		description: "Publish a local file or directory (HTML page, Markdown, slides, build output) as a read-only public link. A directory without index.html gets a generated file listing; a single .html file is served at the link root.",
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
			return describeShare(await ctx.shareLink.createPathShare(args.path, {
				cwd,
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
