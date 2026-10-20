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
		//#region src/client/settings-card.ts
		const h$1 = react.default.createElement;
		/** 设置命名空间（= 条目 id）。 */
		const NAMESPACE = "dsh-share-link";
		/** bundle 包名（= `plugins.bundle.config` 槽的 key）。 */
		const PACKAGE = "@vlln/dsh-share-link";
		/** 卡片自己的 locale 命名空间。 */
		const NS = "settings.dsh-share-link";
		const CHANNELS = [
			{
				id: "quick",
				provider: "tunnel",
				labelKey: "channel.quick",
				hintKey: "channel.quick.hint"
			},
			{
				id: "named",
				provider: "tunnel",
				labelKey: "channel.named",
				hintKey: "channel.named.hint"
			},
			{
				id: "surge",
				provider: "surge",
				labelKey: "channel.surge",
				hintKey: "channel.surge.hint"
			},
			{
				id: "lan",
				provider: "lan",
				labelKey: "channel.lan",
				hintKey: "channel.lan.hint"
			}
		];
		/** 从配置推导当前渠道（命名隧道 = tunnel + 有 token）。 */
		function channelOf(cfg) {
			if (cfg.provider === "surge") return "surge";
			if (cfg.provider === "lan") return "lan";
			return typeof cfg.tunnelToken === "string" && cfg.tunnelToken !== "" ? "named" : "quick";
		}
		/** 渠道相关的字段（端口与有效期对所有渠道通用）。 */
		const CHANNEL_FIELDS = {
			quick: [],
			named: ["tunnelToken", "tunnelHostname"],
			surge: [
				"surgeLogin",
				"surgeToken",
				"surgeDomain"
			],
			lan: []
		};
		const COMMON_FIELDS = ["port", "ttlHours"];
		const FIELD_SPEC = {
			port: {
				kind: "number",
				secret: false
			},
			ttlHours: {
				kind: "number",
				secret: false
			},
			tunnelToken: {
				kind: "text",
				secret: true
			},
			tunnelHostname: {
				kind: "text",
				secret: false
			},
			surgeLogin: {
				kind: "text",
				secret: false
			},
			surgeToken: {
				kind: "text",
				secret: true
			},
			surgeDomain: {
				kind: "text",
				secret: false
			}
		};
		const el = h$1;
		/** 单字段：本地缓冲，失焦 / 回车提交；被拒时回读宿主值。 */
		function Field(props) {
			const { fieldKey, value, disabled, secret, numeric, t, onCommit, resetToken } = props;
			const initial = value === void 0 || value === null ? "" : String(value);
			const [text, setText] = react.default.useState(initial);
			const [lastKey, setLastKey] = react.default.useState(initial);
			const [lastReset, setLastReset] = react.default.useState(resetToken);
			if (initial !== lastKey || resetToken !== lastReset) {
				setLastKey(initial);
				setLastReset(resetToken);
				setText(initial);
			}
			const commit = () => {
				const next = numeric ? Number(text === "" ? 0 : text) : text;
				if (numeric && !Number.isFinite(next)) {
					setText(initial);
					return;
				}
				if (String(next) === initial) return;
				onCommit(fieldKey, next);
			};
			return el("label", { style: {
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				padding: "9px 0",
				borderBottom: "0.5px solid var(--dsw-alias-border-l2)"
			} }, el("span", { style: {
				flex: 1,
				minWidth: 0,
				display: "flex",
				flexDirection: "column",
				gap: 2
			} }, el("span", { style: {
				fontSize: 13,
				fontWeight: 500,
				color: "var(--dsw-alias-label-primary)"
			} }, t(`field.${fieldKey}`)), el("span", { style: {
				fontSize: 12,
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-tertiary)"
			} }, t(`field.${fieldKey}.hint`))), el("input", {
				type: secret ? "password" : numeric ? "number" : "text",
				value: text,
				disabled,
				"data-share-field": fieldKey,
				autoComplete: "off",
				onChange: (event) => setText(event.target.value),
				onBlur: commit,
				onKeyDown: (event) => {
					if (event.key === "Enter") commit();
				},
				style: {
					width: 260,
					height: 30,
					padding: "0 10px",
					boxSizing: "border-box",
					fontSize: 12.5,
					fontFamily: numeric ? "inherit" : "ui-monospace, Menlo, monospace",
					color: "var(--dsw-alias-label-primary)",
					background: "var(--dsw-alias-bg-layer-1, transparent)",
					border: "0.5px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l2))",
					borderRadius: 8
				}
			}));
		}
		/** 已发布链接列表 + 撤销。 */
		function SharesPanel(props) {
			const { t } = props;
			const [rows, setRows] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const [pending, setPending] = react.default.useState("");
			const load = react.default.useCallback(() => {
				fetch("/api/share-link/list").then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status)))).then((payload) => setRows(payload.items ?? [])).catch((failure) => setError(String(failure?.message ?? failure)));
			}, []);
			react.default.useEffect(() => {
				load();
			}, [load]);
			const revoke = async (id) => {
				setPending(id);
				setError("");
				try {
					const response = await fetch("/api/share-link/revoke", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ id })
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					load();
				} catch (failure) {
					setError(String(failure?.message ?? failure));
				} finally {
					setPending("");
				}
			};
			if (error !== "") return el("p", { style: {
				margin: "8px 0 0",
				fontSize: 12,
				color: "var(--dsw-alias-state-error-primary)"
			} }, error);
			if (rows === null) return el("p", { style: {
				margin: "8px 0 0",
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)"
			} }, t("shares.loading"));
			if (rows.length === 0) return el("p", { style: {
				margin: "8px 0 0",
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)"
			} }, t("shares.empty"));
			return el("div", { style: {
				display: "flex",
				flexDirection: "column",
				gap: 6,
				marginTop: 8
			} }, rows.map((row) => el("div", {
				key: row.id,
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10,
					fontSize: 12.5
				}
			}, el("span", { style: {
				color: "var(--dsw-alias-label-tertiary)",
				minWidth: 44
			} }, row.kind === "session" ? t("shares.session") : t("shares.file")), el("a", {
				href: row.url,
				target: "_blank",
				rel: "noreferrer",
				style: {
					flex: 1,
					minWidth: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					color: "var(--dsw-alias-brand, #4d6bfe)"
				}
			}, row.url), el("button", {
				type: "button",
				disabled: pending === row.id,
				onClick: () => void revoke(row.id),
				style: {
					height: 24,
					padding: "0 10px",
					fontSize: 12,
					borderRadius: 7,
					cursor: "pointer",
					border: "0.5px solid var(--dsw-alias-border-l2)",
					background: "transparent",
					color: "var(--dsw-alias-label-secondary)"
				}
			}, pending === row.id ? t("shares.revoking") : t("shares.revoke")))));
		}
		/** 设置卡本体。 */
		function SettingsCard(props) {
			const state = props.useShareSettings((value) => value);
			const t = props.t;
			const [resetToken, setResetToken] = react.default.useState(0);
			const [failed, setFailed] = react.default.useState("");
			if (props.view === "summary") return t("summary");
			if (!state.available) return null;
			const disabled = state.writable === false;
			const channel = channelOf(state.value);
			const commit = (path, value) => {
				setFailed("");
				Promise.resolve(props.write(path, value)).catch((failure) => {
					setFailed(String(failure?.message ?? failure));
					setResetToken((n) => n + 1);
				});
			};
			const pickChannel = (id) => {
				const target = CHANNELS.find((item) => item.id === id);
				if (target === void 0) return;
				if (target.id === "named" && channel !== "named") {
					commit("provider", "tunnel");
					return;
				}
				commit("provider", target.provider);
				if (target.id === "quick" && typeof state.value.tunnelToken === "string" && state.value.tunnelToken !== "") commit("tunnelToken", "");
			};
			const active = CHANNELS.find((item) => item.id === channel);
			const fields = [...CHANNEL_FIELDS[channel], ...COMMON_FIELDS];
			return el("div", {
				"data-dsh-share-link-settings": "",
				style: {
					display: "flex",
					flexDirection: "column"
				}
			}, disabled ? el("p", {
				role: "status",
				style: {
					margin: "0 0 8px",
					fontSize: 12,
					color: "var(--dsw-alias-label-tertiary)"
				}
			}, t("readOnly")) : null, el("div", { style: {
				fontSize: 13,
				fontWeight: 500,
				margin: "4px 0 2px"
			} }, t("channel.title")), el("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)",
				marginBottom: 8
			} }, t("channel.hint")), el("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, CHANNELS.map((item) => el("button", {
				key: item.id,
				type: "button",
				disabled,
				"data-share-channel": item.id,
				"data-active": item.id === channel ? "true" : "false",
				onClick: () => pickChannel(item.id),
				style: {
					height: 28,
					padding: "0 12px",
					fontSize: 12.5,
					borderRadius: 8,
					cursor: "pointer",
					border: "0.5px solid var(--dsw-alias-border-l2)",
					background: item.id === channel ? "var(--dsw-alias-bg-layer-1)" : "transparent",
					color: item.id === channel ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)",
					fontWeight: item.id === channel ? 500 : 400
				}
			}, t(item.labelKey)))), active === void 0 ? null : el("p", { style: {
				margin: "8px 0 4px",
				fontSize: 12,
				lineHeight: 1.5,
				color: "var(--dsw-alias-label-tertiary)"
			} }, t(active.hintKey)), el("div", { style: {
				display: "flex",
				flexDirection: "column",
				marginTop: 6
			} }, fields.map((key) => el(Field, {
				key,
				fieldKey: key,
				value: state.value[key],
				disabled,
				secret: FIELD_SPEC[key].secret,
				numeric: FIELD_SPEC[key].kind === "number",
				t,
				resetToken,
				onCommit: (field, value) => commit(field, value)
			}))), failed === "" ? null : el("p", {
				role: "status",
				style: {
					margin: "10px 0 0",
					fontSize: 12,
					color: "var(--dsw-alias-state-error-primary)"
				}
			}, t("writeFailed")), el("div", { style: {
				fontSize: 13,
				fontWeight: 500,
				margin: "18px 0 0"
			} }, t("shares.title")), el("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)"
			} }, t("shares.hint")), el(SharesPanel, { t }));
		}
		/**
		* 注册设置卡。
		* @param {any} ctx client 根上下文（inject 需含 slots / locale / configForms）
		* @returns {() => void} disposer
		*/
		function registerSettingsCard(ctx) {
			const scope = ctx.configForms.get(NAMESPACE);
			const offLocale = ctx.locale.register(NS, {
				zh: zh$1,
				en: en$1
			});
			let cache;
			const getSnapshot = () => {
				const snap = scope.getSnapshot();
				if (cache !== void 0 && cache.snap === snap) return cache.state;
				cache = {
					snap,
					state: {
						available: snap.status === "ready",
						writable: snap.writable,
						value: snap.value ?? {}
					}
				};
				return cache.state;
			};
			const write = async (path, value) => {
				if (await scope.mutate([{
					op: "set",
					path: path.split("."),
					value
				}]) !== true) throw new Error(`设置写入未被接受（${path}）`);
			};
			const offServed = ctx.configForms.whileServed([NAMESPACE], () => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: PACKAGE,
				locale: NS,
				inject: () => ({
					hooks: { shareSettings: {
						getSnapshot,
						subscribe: (listener) => scope.subscribe(listener)
					} },
					write
				})
			}, SettingsCard)));
			return () => {
				offServed();
				offLocale();
			};
		}
		const zh$1 = {
			summary: "发布渠道、参数与已发布的链接",
			readOnly: "当前部署只读，无法修改。",
			writeFailed: "刚才的改动未被接受，已回读当前值。",
			"channel.title": "发布渠道",
			"channel.hint": "选一个渠道，填好参数就能在会话右上角或文件预览里直接出链接。",
			"channel.quick": "快速隧道",
			"channel.quick.hint": "cloudflared 临时域名，零配置；进程停掉链接即失效，域名每次重启会变。",
			"channel.named": "命名隧道",
			"channel.named.hint": "固定域名（需 Cloudflare 账号 + 自己的域名）。需要填隧道 token 与域名，端口必须是 3089 或你在 Cloudflare 里配置的那个。",
			"channel.surge": "Surge",
			"channel.surge.hint": "持久域名，可 `surge teardown` 撤销。免费账号即可，域名形如 <prefix>-<id>.surge.sh。",
			"channel.lan": "仅局域网",
			"channel.lan.hint": "只给同一网络的人看，不出公网。",
			"field.port": "分享服务端口",
			"field.port.hint": "0 = 随机端口；命名隧道模式必须固定（默认 3089）。",
			"field.ttlHours": "默认有效期（小时）",
			"field.ttlHours.hint": "到期后链接自动失效；撤销是立即失效。",
			"field.tunnelToken": "Cloudflare 隧道 token",
			"field.tunnelToken.hint": "Zero Trust → Networks → Tunnels 里那条隧道的 token。",
			"field.tunnelHostname": "对外域名",
			"field.tunnelHostname.hint": "例如 share.example.com，需在 Cloudflare 指向本机端口。",
			"field.surgeLogin": "Surge 账号邮箱",
			"field.surgeLogin.hint": "配合 token 免交互登录；已 `surge login` 过可留空。",
			"field.surgeToken": "Surge token",
			"field.surgeToken.hint": "`surge tokens add` 生成；只注入给子进程。",
			"field.surgeDomain": "域名后缀",
			"field.surgeDomain.hint": "留空用 <prefix>-<id>.surge.sh。",
			"shares.title": "已发布的链接",
			"shares.hint": "撤销后立即 404；本地快照同时删除。",
			"shares.empty": "还没有发布过链接。",
			"shares.loading": "读取中…",
			"shares.revoke": "撤销",
			"shares.revoking": "撤销中…",
			"shares.session": "会话",
			"shares.file": "文件"
		};
		const en$1 = {
			summary: "Publishing channels, their settings, and active links",
			readOnly: "This deployment is read-only.",
			writeFailed: "That change was not accepted; values were re-read.",
			"channel.title": "Publishing channel",
			"channel.hint": "Pick one channel and fill in its settings; shares then work from the session menu or a file preview.",
			"channel.quick": "Quick tunnel",
			"channel.quick.hint": "Zero-config cloudflared URL. Dies with the process and the hostname changes on restart.",
			"channel.named": "Named tunnel",
			"channel.named.hint": "Stable hostname (needs Cloudflare + a domain). Requires the tunnel token and hostname; the port must match what the tunnel points at.",
			"channel.surge": "Surge",
			"channel.surge.hint": "Persistent domain, revocable with `surge teardown`. Free account is enough; links look like <prefix>-<id>.surge.sh.",
			"channel.lan": "LAN only",
			"channel.lan.hint": "Only reachable on the same network; nothing leaves your machine.",
			"field.port": "Share server port",
			"field.port.hint": "0 = random. Named tunnels need a fixed port (3089 by default).",
			"field.ttlHours": "Default lifetime (hours)",
			"field.ttlHours.hint": "Links expire after this; revoking kills them immediately.",
			"field.tunnelToken": "Cloudflare tunnel token",
			"field.tunnelToken.hint": "From Zero Trust → Networks → Tunnels.",
			"field.tunnelHostname": "Public hostname",
			"field.tunnelHostname.hint": "e.g. share.example.com, pointed at the local port in Cloudflare.",
			"field.surgeLogin": "Surge account email",
			"field.surgeLogin.hint": "Pairs with the token for non-interactive login; leave empty if already logged in.",
			"field.surgeToken": "Surge token",
			"field.surgeToken.hint": "Created by `surge tokens add`; only injected into the child process.",
			"field.surgeDomain": "Domain suffix",
			"field.surgeDomain.hint": "Leave empty to use <prefix>-<id>.surge.sh.",
			"shares.title": "Active links",
			"shares.hint": "Revoking returns 404 immediately and deletes the local snapshot.",
			"shares.empty": "Nothing shared yet.",
			"shares.loading": "Loading…",
			"shares.revoke": "Revoke",
			"shares.revoking": "Revoking…",
			"shares.session": "session",
			"shares.file": "file"
		};
		//#endregion
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
[data-dsh-share-guide] {
  margin-top: 12px; padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  background: var(--dsw-alias-bg-base, #f7f7fa);
}
[data-dsh-share-guide] strong { display: block; font-size: 13px; margin-bottom: 4px; }
[data-dsh-share-guide] p { margin: 0 0 10px; font-size: 12.5px; color: var(--dsw-alias-text-secondary, #5f5f6b); }
[data-dsh-share-guide] .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
[data-dsh-share-guide] a[data-dsh-share-btn] {
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  color: var(--dsw-alias-brand, #4d6bfe);
}
[data-dsh-share-guide] code {
  flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all;
  font: 11.5px/1.9 ui-monospace, Menlo, monospace;
  background: var(--dsw-alias-bg-elevated, #fff); padding: 2px 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
}
[data-dsh-share-warn] { color: #b7791f; font-size: 12.5px; margin-top: 10px; }
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
			if (!response.ok) {
				const failure = new Error(payload.error ?? `HTTP ${response.status}`);
				failure.guide = payload.guide;
				failure.code = payload.code;
				throw failure;
			}
			return payload;
		}
		/** 引导文案按 code 本地化：宿主只提供动作数据（href / command），文案归客户端。 */
		const GUIDE_COPY = {
			surgeLogin: {
				zh: {
					title: "需要先登录 Surge",
					body: "Surge 用邮箱注册（免费），在终端登录一次即可；插件会复用本机的登录状态。",
					linkText: "打开 surge.sh 注册 / 登录"
				},
				en: {
					title: "Sign in to Surge first",
					body: "Surge accounts are free and email-based. Sign in once in your terminal; the plugin reuses that session.",
					linkText: "Open surge.sh"
				}
			},
			surgeMissing: {
				zh: {
					title: "没有找到 surge 命令",
					body: "本机还没装 Surge CLI。装好并登录后，分享会自动走你自己的账号。",
					linkText: "surge.sh"
				},
				en: {
					title: "surge CLI not found",
					body: "Install the Surge CLI and sign in once; shares will then use your own account.",
					linkText: "surge.sh"
				}
			},
			cfHostname: {
				zh: {
					title: "命名隧道缺少域名",
					body: "配置了 tunnelToken，但没说对外用哪个域名。先在 Cloudflare 建隧道并把域名指到本机 3089 端口，再回来填 tunnelHostname。",
					linkText: "打开 Cloudflare Zero Trust"
				},
				en: {
					title: "Named tunnel has no hostname",
					body: "A tunnel token is configured but no public hostname. Create the tunnel in Cloudflare, point it at localhost:3089, then set tunnelHostname.",
					linkText: "Open Cloudflare Zero Trust"
				}
			},
			cfDownload: {
				zh: {
					title: "cloudflared 不可用",
					body: "公网链接需要一个 cloudflared 可执行文件：可以自动下载，也可以自己装一个再填 cloudflaredPath。",
					linkText: "下载 cloudflared"
				},
				en: {
					title: "cloudflared unavailable",
					body: "A public link needs the cloudflared binary. It can be downloaded automatically, or install one and set cloudflaredPath.",
					linkText: "Download cloudflared"
				}
			}
		};
		/** @returns {'zh' | 'en'} */
		function uiLanguage() {
			return (document.documentElement.lang || "en").toLowerCase().startsWith("zh") ? "zh" : "en";
		}
		/**
		* 引导面板：通道没就绪、或发布失败时给出「去登录 / 去配置」的可点入口，
		* 并附一条可复制的命令。链接一律 target=_blank，不打断当前会话。
		*/
		function GuidePanel(props) {
			const { guide, t } = props;
			if (guide === null || guide === void 0) return null;
			const tr = (key, fallback) => typeof t === "function" ? t(key) : fallback;
			const copyFor = GUIDE_COPY[guide.code]?.[uiLanguage()];
			const title = copyFor?.title ?? guide.title;
			const body = copyFor?.body ?? guide.body;
			const linkText = copyFor?.linkText ?? guide.linkText;
			const [copied, setCopied] = react.default.useState(false);
			const copy = async () => {
				try {
					await navigator.clipboard.writeText(guide.command);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {}
			};
			return h("div", { "data-dsh-share-guide": true }, h("strong", null, title), body === void 0 ? null : h("p", null, body), h("div", { className: "row" }, guide.href === void 0 ? null : h("a", {
				"data-dsh-share-btn": true,
				href: guide.href,
				target: "_blank",
				rel: "noreferrer"
			}, linkText ?? tr("guide.open", "Open")), guide.command === void 0 || guide.command === null ? null : h("code", null, guide.command), guide.command === void 0 || guide.command === null ? null : h("button", {
				"data-dsh-share-btn": true,
				onClick: copy,
				type: "button"
			}, copied ? tr("copied", "Copied") : tr("copy", "Copy"))));
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
			const [status, setStatus] = react.default.useState(null);
			const [guide, setGuide] = react.default.useState(null);
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
					setGuide(failure?.guide ?? null);
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
				let alive = true;
				fetch("/api/share-link/status").then((response) => response.ok ? response.json() : null).then((value) => {
					if (alive && value !== null) setStatus(value);
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, []);
			const target = typeof absolutePath === "string" && absolutePath !== "" ? absolutePath : null;
			const blocked = status !== null && status.ready === false;
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
			}, h("h3", null, target === null ? tr("title.session", "Share this conversation") : tr("title.file", "Share this file")), h("p", { className: "hint" }, target === null ? tr("hint.session", "Creates a read-only snapshot link. The recipient needs no dsh install and cannot see your other sessions. Revoking kills it instantly.") : tr("hint.file", "Publishes this file as a read-only link. Revoking kills it instantly.")), status !== null && status.ready === false && entry === null ? h(GuidePanel, {
				guide: status.guide,
				t
			}) : null, target === null && entry === null ? h("div", { "data-dsh-share-row": true }, h("label", null, h("input", {
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
			}, tr("open", "Open"))), error === "" || guide !== null ? null : h("div", { "data-dsh-share-error": true }, error), guide === null ? null : h(GuidePanel, {
				guide,
				t
			}), entry === null ? null : h("div", { "data-dsh-share-ok": true }, `${tr("ok", "Link created — ready to send.")} ${tr("expires", "Expires")} ${expires}`), revoked && error === "" ? h("div", { "data-dsh-share-ok": true }, tr("revoked", "Revoked — the link no longer works.")) : null, entry !== null && entry.degraded === true ? h("div", { "data-dsh-share-warn": true }, tr("degraded", "公网通道不可用，已降级为局域网链接（仅同一网络可访问）。")) : null, h("div", { "data-dsh-share-actions": true }, entry !== null ? h("button", {
				disabled: busy,
				onClick: revoke,
				type: "button"
			}, tr("revoke", "Revoke")) : null, h("button", {
				onClick: onClose,
				type: "button"
			}, tr("close", "Close")), entry === null ? h("button", {
				"data-primary": "true",
				disabled: busy || blocked,
				onClick: submit,
				type: "button"
			}, busy ? tr("working", "Creating…") : blocked ? tr("blocked", "先完成上面的配置") : tr("create", "Create link")) : null)));
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
			expires: "到期",
			"guide.open": "打开",
			blocked: "先完成上面的配置"
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
			expires: "Expires",
			"guide.open": "Open",
			blocked: "Finish the setup above first"
		};
		//#endregion
		module.exports = {
			name: "dsh-share-link-client",
			inject: [
				"locale",
				"slots",
				"configForms"
			],
			apply(ctx) {
				ctx.locale.register("share-link", {
					zh,
					en
				});
				ctx.effect(() => installMenuIntegration(), "share-link: session menu item");
				ctx.effect(() => registerSettingsCard(ctx), "share-link: settings card");
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
