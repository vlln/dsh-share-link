import { n as ShareError } from "./share-link-D-oVNefx.mjs";
//#region src/tool-kit.mjs
/**
* 四个分享工具共用的「模型可见文案」。
*
* 工具已经拆成四个独立插件（`./tools/*`），每个插件只注册一个工具；它们都要用同一套
* 错误引导与成功文案，所以放在这里，避免四份拷贝各自漂移。
*
* 注意：这里是**模型可见文本**（tool description / 返回值），按 DSH 的约定不翻译。
*
* @module dsh-share-link/tool-kit
*/
/** 通道的中文说法，用于工具回复。 */
const CHANNEL_LABEL = {
	tunnel: "公网隧道",
	lan: "局域网",
	surge: "Surge 持久域名"
};
/** 工具统一返回纯文本。 */
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
//#endregion
export { describeError as n, describeShare as r, TEXT_OUTPUT as t };
