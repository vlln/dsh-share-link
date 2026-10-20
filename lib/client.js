window.__ModuleLoader__.load({
	id: "@vlln/dsh-share-link",
	factory: (require) => {
		var module = { exports: {} };
		module.exports;
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/index.ts
		const h = react.default.createElement;
		/** 菜单项与 header 图标之间的桥：谁先拿到点击，都由它把对话框叫起来。 */
		const OPEN_EVENT = "dsh-share-link:open-session";
		/** 会话 header 右上角菜单挂载点；宿主没有"菜单项"插槽，只能在这里做增量。 */
		const UTILITIES_SLOT = "[data-slot=\"conversation.session.header.utilities\"]";
		/** 16×16 链接图标，与官方菜单项图标同尺寸。 */
		const LINK_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" stroke-width="1">
<path d="M6.6 9.4l2.8-2.8" stroke="currentColor" stroke-linecap="round"/>
<path d="M6.1 10.6l-.7.7a2.6 2.6 0 0 1-3.7-3.7l1.9-1.9a2.6 2.6 0 0 1 3.7 0" stroke="currentColor" stroke-linecap="round"/>
<path d="M9.9 5.4l.7-.7a2.6 2.6 0 0 1 3.7 3.7l-1.9 1.9a2.6 2.6 0 0 1-3.7 0" stroke="currentColor" stroke-linecap="round"/>
</svg>`;
		/**
		* 把「分享会话」塞进会话右上角的 `···` 菜单。
		*
		* 宿主没有给菜单项留插槽（那份菜单由 `dsh-session-log-export` 自渲染），所以这里
		* 在菜单出现时**克隆一个既有菜单项**再改写文案与图标——克隆保证内边距、hover、
		* 焦点样式与官方完全一致，不靠猜 class 名。菜单关闭即随组件卸载，重复打开会重新注入。
		*
		* 失效模式是**静默降级**：选择器对不上就不注入，header 上的分享图标仍然可用。
		*/
		function installMenuIntegration() {
			if (typeof document === "undefined") return () => {};
			const enhance = () => {
				const menu = document.querySelector(`${UTILITIES_SLOT} [role="menu"]`);
				if (menu === null || menu.querySelector("[data-dsh-share-menu-item]") !== null) return;
				const item = menu.querySelector("[role=\"menuitem\"]");
				const wrap = item?.parentElement;
				if (item === null || item === void 0 || wrap === null || wrap === void 0) return;
				const english = /download|feedback/i.test(menu.textContent ?? "");
				const clone = wrap.cloneNode(true);
				const button = clone.querySelector("[role=\"menuitem\"]");
				if (button === null) return;
				button.setAttribute("data-dsh-share-menu-item", "true");
				const icon = button.querySelector("svg");
				if (icon !== null) icon.outerHTML = LINK_ICON;
				const label = [...button.querySelectorAll("span")].at(-1);
				if (label !== void 0) label.textContent = english ? "Share conversation…" : "分享会话…";
				button.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					document.dispatchEvent(new KeyboardEvent("keydown", {
						key: "Escape",
						bubbles: true
					}));
					setTimeout(() => document.dispatchEvent(new CustomEvent(OPEN_EVENT)), 40);
				});
				wrap.parentElement?.insertBefore(clone, wrap);
			};
			const observer = new MutationObserver(enhance);
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			enhance();
			return () => observer.disconnect();
		}
		const STYLE_ID = "dsh-share-link-style";
		const CSS = `
[data-dsh-share] { font: inherit; }
[data-dsh-share-btn] {
  display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 8px;
  border: 0; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-text-tertiary, #61666b);
  font: inherit; font-size: 12.5px; line-height: 1; cursor: pointer; white-space: nowrap;
  transition: background .15s ease, color .15s ease;
}
[data-dsh-share-btn]:hover {
  background: var(--dsw-alias-bg-hover, rgba(128,128,140,.10));
  color: var(--dsw-alias-text-primary, #1d1d22);
}
[data-dsh-share-btn]:focus-visible {
  outline: 2px solid var(--dsw-alias-brand, #4d6bfe); outline-offset: 1px;
}
[data-dsh-share-btn][data-icon-only="true"] { width: 28px; height: 28px; padding: 0; justify-content: center; }
[data-dsh-share-overlay] {
  position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center;
  justify-content: center; background: rgba(0,0,0,.32); backdrop-filter: blur(2px);
}
[data-dsh-share-card] {
  width: min(460px, calc(100vw - 32px)); padding: 20px; border-radius: 14px;
  background: var(--dsw-alias-bg-elevated, #fff); color: var(--dsw-alias-text-primary, #1d1d22);
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  box-shadow: 0 18px 48px rgba(0,0,0,.24);
  font: 13.5px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
}
[data-dsh-share-card] h3 { margin: 0 0 4px; font-size: 15px; }
[data-dsh-share-card] p.hint { margin: 0 0 14px; color: var(--dsw-alias-text-secondary, #6b6b76); font-size: 12.5px; }
[data-dsh-share-row] { display: flex; align-items: center; gap: 8px; margin: 12px 0; }
[data-dsh-share-row] label { display: flex; align-items: center; gap: 7px; color: var(--dsw-alias-text-secondary, #5f5f6b); }
[data-dsh-share-link] {
  flex: 1; height: 32px; padding: 0 10px; border-radius: 8px; min-width: 0;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  background: var(--dsw-alias-bg-base, #f7f7fa); color: inherit;
  font: 11.5px/1 ui-monospace, Menlo, monospace; text-overflow: ellipsis;
}
a[data-dsh-share-btn] { text-decoration: none; }
[data-dsh-share-actions] { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
[data-dsh-share-actions] button {
  height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer; font-size: 13px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea); background: transparent; color: inherit;
}
[data-dsh-share-actions] button[data-primary="true"] {
  background: var(--dsw-alias-brand, #4d6bfe); border-color: transparent; color: #fff;
}
[data-dsh-share-actions] button:disabled { opacity: .55; cursor: default; }
[data-dsh-share-error] { color: #d64545; font-size: 12.5px; margin-top: 10px; white-space: pre-wrap; }
[data-dsh-share-ok] { color: #2f9e6b; font-size: 12.5px; margin-top: 10px; }
`;
		function ensureStyle() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = CSS;
			document.head.appendChild(style);
		}
		async function post(path, body) {
			const response = await fetch(path, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
			return payload;
		}
		/** 表单/结果共用的分享对话框。 */
		function ShareDialog(props) {
			const { sessionId, absolutePath, onClose, t } = props;
			const tr = (key, fallback) => typeof t === "function" ? t(key) : fallback;
			const [busy, setBusy] = react.default.useState(false);
			const [entry, setEntry] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const [withTools, setWithTools] = react.default.useState(false);
			const [copied, setCopied] = react.default.useState(false);
			const [revoked, setRevoked] = react.default.useState(false);
			const submit = async () => {
				setBusy(true);
				setError("");
				try {
					const created = typeof absolutePath === "string" && absolutePath !== "" ? await post("/api/share-link/path", { path: absolutePath }) : await post("/api/share-link/session", {
						sessionId,
						includeToolCalls: withTools
					});
					setEntry(created);
				} catch (failure) {
					setError(String(failure?.message ?? failure));
				} finally {
					setBusy(false);
				}
			};
			const copy = async () => {
				try {
					await navigator.clipboard.writeText(entry.url);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {}
			};
			const revoke = async () => {
				setBusy(true);
				try {
					await post("/api/share-link/revoke", { id: entry.id });
					setEntry(null);
					setRevoked(true);
				} catch (failure) {
					setError(String(failure?.message ?? failure));
				} finally {
					setBusy(false);
				}
			};
			react.default.useEffect(() => {
				ensureStyle();
			}, []);
			const target = typeof absolutePath === "string" && absolutePath !== "" ? absolutePath : null;
			const expires = entry !== null ? new Date(entry.expiresAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "";
			return h("div", {
				"data-dsh-share-overlay": true,
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				}
			}, h("div", {
				"data-dsh-share-card": true,
				role: "dialog",
				"aria-modal": "true"
			}, h("h3", null, target === null ? tr("title.session", "Share this conversation") : tr("title.file", "Share this file")), h("p", { className: "hint" }, target === null ? tr("hint.session", "Creates a read-only snapshot link. The recipient needs no dsh install and cannot see your other sessions. Revoking kills it instantly.") : tr("hint.file", "Publishes this file as a read-only link. Revoking kills it instantly.")), target === null && entry === null ? h("div", { "data-dsh-share-row": true }, h("label", null, h("input", {
				type: "checkbox",
				checked: withTools,
				onChange: (event) => setWithTools(event.target.checked)
			}), tr("option.tools", "Include tool-call names (result bodies are never included)"))) : null, target === null ? null : h("div", { "data-dsh-share-row": true }, h("code", { style: { fontSize: "11.5px" } }, target)), entry === null ? null : h("div", { "data-dsh-share-row": true }, h("input", {
				"data-dsh-share-link": true,
				readOnly: true,
				value: entry.url,
				onFocus: (event) => event.target.select()
			}), h("button", {
				"data-dsh-share-btn": true,
				onClick: copy,
				type: "button"
			}, copied ? tr("copied", "Copied") : tr("copy", "Copy")), h("a", {
				"data-dsh-share-btn": true,
				href: entry.url,
				target: "_blank",
				rel: "noreferrer"
			}, tr("open", "Open"))), error === "" ? null : h("div", { "data-dsh-share-error": true }, error), entry === null ? null : h("div", { "data-dsh-share-ok": true }, `${tr("ok", "Link created — ready to send.")} ${tr("expires", "Expires")} ${expires}`), revoked && error === "" ? h("div", { "data-dsh-share-ok": true }, tr("revoked", "Revoked — the link no longer works.")) : null, h("div", { "data-dsh-share-actions": true }, entry !== null ? h("button", {
				disabled: busy,
				onClick: revoke,
				type: "button"
			}, tr("revoke", "Revoke")) : null, h("button", {
				onClick: onClose,
				type: "button"
			}, tr("close", "Close")), entry === null ? h("button", {
				"data-primary": "true",
				disabled: busy,
				onClick: submit,
				type: "button"
			}, busy ? tr("working", "Creating…") : tr("create", "Create link")) : null)));
		}
		/** header「···」菜单项。 */
		function SessionShareAction(props) {
			const [open, setOpen] = react.default.useState(false);
			react.default.useEffect(() => {
				ensureStyle();
				const openFromMenu = () => setOpen(true);
				document.addEventListener(OPEN_EVENT, openFromMenu);
				return () => document.removeEventListener(OPEN_EVENT, openFromMenu);
			}, []);
			const label = typeof props.t === "function" ? props.t("action") : "分享";
			return h("span", { "data-dsh-share": true }, h("button", {
				"data-dsh-share-btn": true,
				"data-icon-only": "true",
				title: label,
				"aria-label": label,
				onClick: () => setOpen(true),
				type: "button"
			}, h("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true"
			}, h("path", {
				d: "M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.23",
				stroke: "currentColor",
				"stroke-width": 1.8,
				"stroke-linecap": "round"
			}), h("path", {
				d: "M14 11a5 5 0 0 0-7.07 0L4.8 13.1a5 5 0 0 0 7.07 7.07l1.4-1.4",
				stroke: "currentColor",
				"stroke-width": 1.8,
				"stroke-linecap": "round"
			}))), open ? h(ShareDialog, {
				sessionId: props.sessionId,
				t: props.t,
				onClose: () => setOpen(false)
			}) : null);
		}
		/** 文件预览 / 交付物上的分享按钮。 */
		function FileShareAction(props) {
			const [open, setOpen] = react.default.useState(false);
			react.default.useEffect(() => {
				ensureStyle();
			}, []);
			const absolutePath = props.absolutePath ?? props.path ?? props.file?.absolutePath ?? props.file?.path;
			if (typeof absolutePath !== "string" || absolutePath === "") return null;
			const label = typeof props.t === "function" ? props.t("action") : "分享";
			return h("span", { "data-dsh-share": true }, h("button", {
				"data-dsh-share-btn": true,
				title: label,
				onClick: () => setOpen(true),
				type: "button"
			}, h("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true"
			}, h("path", {
				d: "M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.23",
				stroke: "currentColor",
				"stroke-width": 1.8,
				"stroke-linecap": "round"
			}), h("path", {
				d: "M14 11a5 5 0 0 0-7.07 0L4.8 13.1a5 5 0 0 0 7.07 7.07l1.4-1.4",
				stroke: "currentColor",
				"stroke-width": 1.8,
				"stroke-linecap": "round"
			})), h("span", null, label)), open ? h(ShareDialog, {
				absolutePath,
				t: props.t,
				onClose: () => setOpen(false)
			}) : null);
		}
		const zh = {
			action: "分享",
			"title.session": "分享这段对话",
			"title.file": "分享这个文件",
			"hint.session": "生成一个只读快照链接：对方无需安装 dsh，也看不到你的其他会话。撤销后立即失效。",
			"hint.file": "把这个文件原样发布成只读链接。撤销后立即失效。",
			"option.tools": "包含工具调用名称（结果正文始终不含）",
			create: "生成链接",
			working: "生成中…",
			copy: "复制",
			copied: "已复制",
			close: "关闭",
			ok: "链接已生成，可直接发给对方。",
			open: "打开",
			revoke: "撤销",
			revoked: "已撤销，链接立即失效。",
			expires: "到期"
		};
		const en = {
			action: "Share",
			"title.session": "Share this conversation",
			"title.file": "Share this file",
			"hint.session": "Creates a read-only snapshot link. The recipient needs no dsh install and cannot see your other sessions. Revoking kills it instantly.",
			"hint.file": "Publishes this file as a read-only link. Revoking kills it instantly.",
			"option.tools": "Include tool-call names (result bodies are never included)",
			create: "Create link",
			working: "Creating…",
			copy: "Copy",
			copied: "Copied",
			close: "Close",
			ok: "Link created — ready to send.",
			open: "Open",
			revoke: "Revoke",
			revoked: "Revoked — the link no longer works.",
			expires: "Expires"
		};
		//#endregion
		module.exports = {
			name: "dsh-share-link-client",
			inject: ["locale", "slots"],
			apply(ctx) {
				ctx.locale.register("share-link", {
					zh,
					en
				});
				ctx.effect(() => installMenuIntegration(), "share-link: session menu item");
				ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
					name: "conversation.session.header.utilities",
					id: "share-link",
					order: 40,
					locale: "share-link"
				}, SessionShareAction));
				ctx.slots.inject("sidebar.right.tab.document.actions", () => ctx.slots.register({
					name: "sidebar.right.tab.document.actions",
					id: "share-link",
					order: 40,
					locale: "share-link"
				}, FileShareAction));
				ctx.slots.inject("deliverables.file.actions", () => ctx.slots.register({
					name: "deliverables.file.actions",
					id: "share-link",
					order: 40,
					locale: "share-link"
				}, FileShareAction));
			}
		};
		return module.exports;
	}
});
