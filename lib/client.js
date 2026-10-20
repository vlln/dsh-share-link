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
		/** 每个渠道的说明、步骤、入口链接与需要的字段——普通用户只看这里。 */
		const CHANNEL_INFO = {
			quick: {
				name: (t) => t("channel.quick"),
				desc: (t) => t("channel.quick.desc"),
				fields: [],
				steps: () => []
			},
			surge: {
				name: (t) => t("channel.surge"),
				desc: (t) => t("channel.surge.desc"),
				fields: ["surgeToken"],
				steps: (t) => [t("step.surge.1"), t("step.surge.2")],
				link: {
					href: "https://surge.sh/",
					text: (t) => t("link.surge")
				}
			},
			named: {
				name: (t) => t("channel.named"),
				desc: (t) => t("channel.named.desc"),
				fields: ["tunnelToken", "tunnelHostname"],
				steps: (t) => [
					t("step.named.1"),
					t("step.named.2"),
					t("step.named.3")
				],
				link: {
					href: "https://one.dash.cloudflare.com/",
					text: (t) => t("link.cf")
				}
			},
			lan: {
				name: (t) => t("channel.lan"),
				desc: (t) => t("channel.lan.desc"),
				fields: [],
				steps: () => []
			}
		};
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
			},
			surgePrefix: {
				kind: "text",
				secret: false
			},
			surgeLogin: {
				kind: "text",
				secret: false
			}
		};
		const el = h$1;
		/** 单字段：本地缓冲，失焦 / 回车提交；被拒时回读宿主值。 */
		function Field(props) {
			const { fieldKey, value, disabled, secret, numeric, t, onCommit, resetToken } = props;
			const [reveal, setReveal] = react.default.useState(false);
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
			} }, t(`field.${fieldKey}.hint`))), el("span", { style: {
				display: "inline-flex",
				alignItems: "center",
				gap: 6
			} }, el("input", {
				type: secret && !reveal ? "password" : numeric ? "number" : "text",
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
			}), secret ? el("button", {
				type: "button",
				"data-reveal": fieldKey,
				title: reveal ? t("hide") : t("show"),
				onClick: () => setReveal((value) => !value),
				style: {
					height: 30,
					padding: "0 8px",
					borderRadius: 8,
					cursor: "pointer",
					fontSize: 12,
					border: "0.5px solid var(--dsw-alias-border-l2)",
					background: "transparent",
					color: "var(--dsw-alias-label-tertiary)"
				}
			}, reveal ? t("hide") : t("show")) : null));
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
		/** 用同一套渲染器出的样式预览（iframe srcdoc，禁用脚本）。 */
		function ThemePreview(props) {
			const { theme, customCss } = props;
			const [html, setHtml] = react.default.useState("");
			const [failed, setFailed] = react.default.useState(false);
			react.default.useEffect(() => {
				let alive = true;
				setFailed(false);
				fetch("/api/share-link/preview", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						theme,
						customCss
					})
				}).then((response) => response.ok ? response.text() : Promise.reject(new Error(String(response.status)))).then((text) => {
					if (alive) setHtml(text);
				}).catch(() => {
					if (alive) setFailed(true);
				});
				return () => {
					alive = false;
				};
			}, [theme, customCss]);
			return el("div", {
				"data-share-preview": theme,
				style: { marginTop: 10 }
			}, failed ? el("p", { style: {
				margin: 0,
				fontSize: 12,
				color: "var(--dsw-alias-state-error-primary)"
			} }, "预览生成失败") : el("iframe", {
				title: "share page preview",
				srcDoc: html,
				sandbox: "allow-same-origin",
				style: {
					width: "100%",
					height: 300,
					border: "0.5px solid var(--dsw-alias-border-l2)",
					borderRadius: 12,
					background: "#fff",
					display: "block"
				}
			}));
		}
		/** 自定义 CSS 输入（多行，失焦或 Ctrl/Cmd+Enter 保存）。 */
		function CssArea(props) {
			const { value, disabled, t, onCommit, resetToken } = props;
			const [text, setText] = react.default.useState(value ?? "");
			const [last, setLast] = react.default.useState(value ?? "");
			const [lastReset, setLastReset] = react.default.useState(resetToken);
			if ((value ?? "") !== last || resetToken !== lastReset) {
				setLast(value ?? "");
				setLastReset(resetToken);
				setText(value ?? "");
			}
			return el("textarea", {
				"data-share-css": "true",
				value: text,
				disabled,
				spellCheck: false,
				placeholder: ":root { --accent: #e11d48; }\nbody { letter-spacing: .01em; }",
				onChange: (event) => setText(event.target.value),
				onBlur: () => onCommit(text),
				onKeyDown: (event) => {
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) onCommit(text);
				},
				style: {
					marginTop: 10,
					width: "100%",
					height: 120,
					padding: "10px 12px",
					boxSizing: "border-box",
					font: "12px/1.7 ui-monospace, Menlo, monospace",
					color: "var(--dsw-alias-label-primary)",
					background: "var(--dsw-alias-bg-layer-1, transparent)",
					border: "0.5px solid var(--dsw-alias-border-l4, var(--dsw-alias-border-l2))",
					borderRadius: 10,
					resize: "vertical"
				}
			});
		}
		/** 设置卡本体。 */
		function SettingsCard(props) {
			const state = props.useShareSettings((value) => value);
			const t = props.t;
			const [resetToken, setResetToken] = react.default.useState(0);
			const [failed, setFailed] = react.default.useState("");
			const [advanced, setAdvanced] = react.default.useState(false);
			const [status, setStatus] = react.default.useState(null);
			const [openSection, setOpenSection] = react.default.useState(null);
			const channel = state.value?.defaultChannel ?? "quick";
			react.default.useEffect(() => {
				let alive = true;
				fetch("/api/share-link/status").then((response) => response.ok ? response.json() : null).then((value) => {
					if (alive && value !== null) setStatus(value);
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, [channel]);
			if (props.view === "summary") return t("summary");
			if (!state.available) return null;
			const disabled = state.writable === false;
			const commit = (path, value) => {
				setFailed("");
				Promise.resolve(props.write(path, value)).catch((failure) => {
					setFailed(String(failure?.message ?? failure));
					setResetToken((n) => n + 1);
				});
			};
			const readiness = (id) => status?.channels?.[id];
			const field = (key) => el(Field, {
				key,
				fieldKey: key,
				value: state.value[key],
				disabled,
				secret: (FIELD_SPEC[key] ?? {}).secret === true,
				numeric: (FIELD_SPEC[key] ?? {}).kind === "number",
				t,
				resetToken,
				onCommit: (name, value) => commit(name, value)
			});
			/** 可折叠的通道配置块（Surge / 命名隧道）。 */
			const section = (id, fieldKeys) => {
				const info = CHANNEL_INFO[id];
				const ready = readiness(id);
				const open = openSection === id || openSection === null && ready !== void 0 && ready.ready === false;
				return el("div", {
					key: id,
					"data-share-section": id,
					style: {
						marginTop: 10,
						border: "0.5px solid var(--dsw-alias-border-l2)",
						borderRadius: 12
					}
				}, el("button", {
					type: "button",
					onClick: () => setOpenSection((value) => value === id ? "" : id),
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8,
						width: "100%",
						padding: "10px 14px",
						background: "transparent",
						border: 0,
						cursor: "pointer",
						textAlign: "left",
						color: "inherit",
						fontSize: 13
					}
				}, el("span", { style: { fontWeight: 500 } }, info.name(t)), el("span", {
					"data-share-ready": ready === void 0 ? "unknown" : ready.ready ? "yes" : "no",
					style: {
						fontSize: 11.5,
						padding: "1px 8px",
						borderRadius: 999,
						color: ready?.ready ? "#1f9d63" : "#96631a",
						background: ready?.ready ? "rgba(31,157,99,.10)" : "rgba(183,121,31,.12)"
					}
				}, ready === void 0 ? t("checking") : ready.ready ? t("ready") : ready.detail), el("span", { style: { flex: 1 } }), el("span", { style: {
					color: "var(--dsw-alias-label-tertiary)",
					fontSize: 12
				} }, open ? "▾" : "▸")), open ? el("div", { style: { padding: "0 14px 12px" } }, el("p", { style: {
					margin: "0 0 6px",
					fontSize: 12.5,
					lineHeight: 1.6,
					color: "var(--dsw-alias-label-secondary)"
				} }, info.desc(t)), (info.steps === void 0 ? [] : info.steps(t)).length === 0 ? null : el("ol", { style: {
					margin: "4px 0 10px",
					paddingLeft: 18,
					fontSize: 12.5,
					lineHeight: 1.9,
					color: "var(--dsw-alias-label-secondary)"
				} }, info.steps(t).map((step, index) => el("li", { key: index }, step))), info.link === void 0 ? null : el("div", { style: { margin: "0 0 10px" } }, el("a", {
					href: info.link.href,
					target: "_blank",
					rel: "noreferrer",
					"data-share-outbound": info.link.href,
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						height: 26,
						padding: "0 10px",
						borderRadius: 7,
						fontSize: 12,
						textDecoration: "none",
						color: "var(--dsw-alias-brand, #4d6bfe)",
						border: "0.5px solid var(--dsw-alias-border-l2)",
						background: "var(--dsw-alias-bg-elevated, #fff)"
					}
				}, info.link.text(t), " ↗")), el("div", { style: {
					display: "flex",
					flexDirection: "column"
				} }, fieldKeys.map(field))) : null);
			};
			return el("div", {
				"data-dsh-share-link-settings": "",
				style: {
					display: "flex",
					flexDirection: "column"
				}
			}, status === null ? null : el("div", {
				"data-share-status": readiness(channel)?.ready ? "ready" : "blocked",
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "8px 12px",
					borderRadius: 10,
					fontSize: 12.5,
					marginBottom: 16,
					background: readiness(channel)?.ready ? "rgba(31,157,99,.08)" : "rgba(183,121,31,.10)",
					color: readiness(channel)?.ready ? "#1f9d63" : "#96631a"
				}
			}, el("span", { style: {
				width: 7,
				height: 7,
				borderRadius: 999,
				background: "currentColor",
				flex: "none"
			} }), el("span", null, `${readiness(channel)?.ready ? t("ready") : t("notReady")} · ${CHANNEL_INFO[channel].name(t)}`)), el("div", { style: {
				fontSize: 13,
				fontWeight: 500,
				margin: "0 0 2px"
			} }, t("default.title")), el("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)",
				marginBottom: 10
			} }, t("default.hint")), el("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, CHANNELS.map((item) => el("button", {
				key: item.id,
				type: "button",
				disabled,
				"data-share-channel": item.id,
				"data-active": item.id === channel ? "true" : "false",
				onClick: () => commit("defaultChannel", item.id),
				style: {
					height: 32,
					padding: "0 12px",
					fontSize: 12.5,
					borderRadius: 9,
					cursor: "pointer",
					border: item.id === channel ? "1px solid var(--dsw-alias-brand, #4d6bfe)" : "0.5px solid var(--dsw-alias-border-l2)",
					background: item.id === channel ? "var(--dsw-alias-bg-layer-1)" : "transparent",
					color: item.id === channel ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)",
					fontWeight: item.id === channel ? 600 : 400
				}
			}, item.labelKey === "channel.quick" ? `${t(item.labelKey)} · ${t("recommended")}` : t(item.labelKey)))), section("surge", ["surgeToken"]), section("named", ["tunnelToken", "tunnelHostname"]), el("div", { style: {
				fontSize: 13,
				fontWeight: 500,
				margin: "20px 0 2px"
			} }, t("theme.title")), el("div", { style: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)",
				marginBottom: 10
			} }, t("theme.hint")), el("div", { style: {
				display: "flex",
				gap: 8,
				flexWrap: "wrap"
			} }, [
				"paper",
				"github",
				"notion",
				"sepia",
				"terminal",
				"custom"
			].map((id) => el("button", {
				key: id,
				type: "button",
				disabled,
				"data-share-theme": id,
				"data-active": (state.value.pageTheme ?? "paper") === id ? "true" : "false",
				onClick: () => commit("pageTheme", id),
				style: {
					height: 30,
					padding: "0 11px",
					fontSize: 12.5,
					borderRadius: 8,
					cursor: "pointer",
					border: (state.value.pageTheme ?? "paper") === id ? "1px solid var(--dsw-alias-brand, #4d6bfe)" : "0.5px solid var(--dsw-alias-border-l2)",
					background: (state.value.pageTheme ?? "paper") === id ? "var(--dsw-alias-bg-layer-1)" : "transparent",
					color: (state.value.pageTheme ?? "paper") === id ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-secondary)",
					fontWeight: (state.value.pageTheme ?? "paper") === id ? 600 : 400
				}
			}, t(`theme.${id}`)))), el(ThemePreview, {
				theme: state.value.pageTheme ?? "paper",
				customCss: state.value.pageThemeCss ?? ""
			}), (state.value.pageTheme ?? "paper") === "custom" ? el(CssArea, {
				value: state.value.pageThemeCss ?? "",
				disabled,
				t,
				resetToken,
				onCommit: (value) => commit("pageThemeCss", value)
			}) : null, failed === "" ? null : el("p", {
				role: "status",
				style: {
					margin: "10px 0 0",
					fontSize: 12,
					color: "var(--dsw-alias-state-error-primary)"
				}
			}, t("writeFailed")), el("button", {
				type: "button",
				"data-share-advanced": "toggle",
				"data-open": advanced ? "true" : "false",
				onClick: () => setAdvanced((value) => !value),
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					width: "100%",
					boxSizing: "border-box",
					marginTop: 18,
					padding: "12px 2px",
					border: 0,
					borderTop: "1px solid var(--dsw-alias-border-l2)",
					background: "transparent",
					color: "var(--dsw-alias-label-primary)",
					fontSize: 13,
					fontWeight: 500,
					cursor: "pointer",
					textAlign: "left"
				}
			}, el("span", null, t("advanced")), el("span", { style: { flex: 1 } }), el("span", { style: {
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: 12,
				fontWeight: 400
			} }, advanced ? t("collapse") : t("advanced.hintShort")), el("span", { style: {
				color: "var(--dsw-alias-label-tertiary)",
				transform: advanced ? "rotate(90deg)" : "none",
				transition: "transform .15s ease"
			} }, "›")), advanced ? el("div", { style: {
				marginTop: 6,
				padding: "4px 0 0 12px",
				borderLeft: "2px solid var(--dsw-alias-border-l2)"
			} }, el("p", { style: {
				margin: "0 0 4px",
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary)"
			} }, t("advanced.hint")), [
				"port",
				"ttlHours",
				"surgeDomain",
				"surgePrefix"
			].map((key) => field(key))) : null, el("div", { style: {
				fontSize: 13,
				fontWeight: 500,
				margin: "20px 0 0"
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
			recommended: "推荐",
			checking: "检查中",
			"theme.title": "分享页样式",
			"theme.hint": "选一个预设，或选「自定义」写 CSS（变量：--bg --fg --muted --line --code-bg --accent）。新分享生效，已发布的不会变。",
			"theme.paper": "暖纸",
			"theme.github": "GitHub",
			"theme.notion": "Notion",
			"theme.sepia": "散文",
			"theme.terminal": "终端",
			"theme.custom": "自定义",
			"default.title": "默认分享通道",
			"default.hint": "只决定分享弹窗里默认选中哪个；弹窗里随时可以临时换通道。",
			ready: "可以分享",
			notReady: "还不能分享",
			advanced: "高级设置",
			"advanced.hint": "一般不用改：端口、默认有效期、Surge 域名后缀。",
			"advanced.hintShort": "端口 / 有效期 / 域名",
			collapse: "收起",
			"channel.quick.desc": "零配置：dsh 在跑就有链接，重启换域名。适合临时发给别人看一眼。首次使用会自动下载 cloudflared（约 50 MB，需要能访问 GitHub）。",
			"channel.surge.desc": "免费账号即可，得到永久固定域名，随时可撤销。",
			"channel.named.desc": "需要你自己在 Cloudflare 建隧道并绑定域名。没有自有域名请直接选 Surge。",
			"channel.lan.desc": "只在同一局域网可访问，不出公网。",
			"step.surge.1": "用邮箱在 surge.sh 注册并登录（免费）",
			"step.surge.2": "在终端运行 surge login；或把 surge tokens add 生成的 token 填到下面",
			"link.surge": "打开 surge.sh",
			copy: "复制",
			copied: "已复制",
			show: "显示",
			hide: "隐藏",
			"surge.localLogin": "已使用本机 Surge 登录态，不用填任何东西",
			"surge.useToken": "改用 token",
			"step.named.1": "Cloudflare Zero Trust → Networks → Tunnels → 创建隧道",
			"step.named.2": "给隧道加 Public Hostname，指向 localhost:3089",
			"step.named.3": "把隧道 token 和完整域名填到下面",
			"link.cf": "打开 Cloudflare Zero Trust",
			"field.surgePrefix": "子域前缀",
			readOnly: "当前部署只读，无法修改。",
			writeFailed: "刚才的改动未被接受，已回读当前值。",
			"channel.title": "发布渠道",
			"channel.hint": "选一个渠道，填好参数就能在会话右上角或文件预览里直接出链接。",
			"channel.quick": "快速隧道",
			"channel.named": "命名隧道（自有域名）",
			"channel.surge": "Surge",
			"channel.lan": "仅局域网",
			"field.port": "分享服务端口",
			"field.port.hint": "0 = 随机端口；命名隧道模式必须固定（默认 3089）。",
			"field.ttlHours": "默认有效期（小时）",
			"field.ttlHours.hint": "到期后链接自动失效；撤销是立即失效。",
			"field.tunnelToken": "Cloudflare 隧道 token",
			"field.tunnelToken.hint": "Zero Trust → Networks → Tunnels 里那条隧道的 token。",
			"field.tunnelHostname": "对外域名",
			"field.tunnelHostname.hint": "必须是那条隧道 Routes 里的 Public Hostname（形如 dsh-share-contents.你的域名），Service 指向 localhost:3089。",
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
			recommended: "recommended",
			checking: "checking",
			"theme.title": "Share page style",
			"theme.hint": "Pick a preset, or choose Custom and write CSS (vars: --bg --fg --muted --line --code-bg --accent). Applies to new shares.",
			"theme.paper": "Paper",
			"theme.github": "GitHub",
			"theme.notion": "Notion",
			"theme.sepia": "Sepia",
			"theme.terminal": "Terminal",
			"theme.custom": "Custom",
			"default.title": "Default channel",
			"default.hint": "Only sets what the share dialog preselects; you can switch per share in the dialog.",
			ready: "Ready to share",
			notReady: "Not ready yet",
			advanced: "Advanced",
			"advanced.hint": "Usually not needed: port, default lifetime, Surge domain suffix.",
			"advanced.hintShort": "port / lifetime / domain",
			collapse: "Collapse",
			"channel.quick.desc": "Zero config: the link lives as long as dsh runs; the hostname changes on restart. On first use it downloads cloudflared (~50 MB, needs GitHub access).",
			"channel.surge.desc": "Free account is enough; you get a stable domain that you can revoke any time.",
			"channel.named.desc": "Requires a tunnel you create in Cloudflare plus a domain you own. No domain? Pick Surge.",
			"channel.lan.desc": "Same network only; nothing leaves your machine.",
			"step.surge.1": "Sign up / sign in at surge.sh with an email (free)",
			"step.surge.2": "Run `surge login` in a terminal, or paste a `surge tokens add` token below",
			"link.surge": "Open surge.sh",
			copy: "Copy",
			copied: "Copied",
			show: "Show",
			hide: "Hide",
			"surge.localLogin": "Using this machine's Surge login — nothing to fill in",
			"surge.useToken": "Use a token instead",
			"step.named.1": "Cloudflare Zero Trust → Networks → Tunnels → create a tunnel",
			"step.named.2": "Add a Public Hostname pointing at localhost:3089",
			"step.named.3": "Paste the tunnel token and the full hostname below",
			"link.cf": "Open Cloudflare Zero Trust",
			"field.surgePrefix": "Subdomain prefix",
			readOnly: "This deployment is read-only.",
			writeFailed: "That change was not accepted; values were re-read.",
			"channel.title": "Publishing channel",
			"channel.hint": "Pick one channel and fill in its settings; shares then work from the session menu or a file preview.",
			"channel.quick": "Quick tunnel",
			"channel.named": "Named tunnel (own domain)",
			"channel.surge": "Surge",
			"channel.lan": "LAN only",
			"field.port": "Share server port",
			"field.port.hint": "0 = random. Named tunnels need a fixed port (3089 by default).",
			"field.ttlHours": "Default lifetime (hours)",
			"field.ttlHours.hint": "Links expire after this; revoking kills them immediately.",
			"field.tunnelToken": "Cloudflare tunnel token",
			"field.tunnelToken.hint": "From Zero Trust → Networks → Tunnels.",
			"field.tunnelHostname": "Public hostname",
			"field.tunnelHostname.hint": "Must be the Public Hostname route of that tunnel (e.g. dsh-share-contents.your-domain.com), pointing at localhost:3089.",
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
[data-dsh-share-btn]:hover { background: var(--dsw-alias-bg-hover, rgba(128,128,140,.10)); color: var(--dsw-alias-text-primary, #1d1d22); }
[data-dsh-share-btn]:focus-visible { outline: 2px solid var(--dsw-alias-brand, #4d6bfe); outline-offset: 1px; }
[data-dsh-share-btn][data-icon-only="true"] { width: 28px; height: 28px; padding: 0; justify-content: center; }
a[data-dsh-share-btn] { text-decoration: none; }

[data-dsh-share-overlay] {
  position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center;
  background: rgba(17,17,22,.42); backdrop-filter: blur(3px);
  animation: dsh-share-fade .12s ease-out;
}
@keyframes dsh-share-fade { from { opacity: 0 } to { opacity: 1 } }
[data-dsh-share-card] {
  width: min(520px, calc(100vw - 40px)); border-radius: 16px; overflow: hidden;
  background: var(--dsw-alias-bg-elevated, #fff); color: var(--dsw-alias-text-primary, #1d1d22);
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  box-shadow: 0 24px 64px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.08);
  font: 13.5px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
  animation: dsh-share-pop .14s cubic-bezier(.2,.8,.2,1);
}
@keyframes dsh-share-pop { from { transform: translateY(6px) scale(.99); opacity: .6 } to { transform: none; opacity: 1 } }

[data-dsh-share-head] { display: flex; gap: 12px; padding: 18px 20px 14px; align-items: flex-start; }
[data-dsh-share-badge] {
  flex: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center;
  color: #fff; background: linear-gradient(135deg, #4d6bfe, #2bc4d8);
  box-shadow: 0 4px 12px rgba(77,107,254,.28);
}
[data-dsh-share-head] h3 { margin: 1px 0 2px; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
[data-dsh-share-head] p { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--dsw-alias-text-secondary, #6b6b76); }
[data-dsh-share-x] {
  flex: none; width: 28px; height: 28px; margin-left: auto; border: 0; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-text-tertiary, #8a8a94); cursor: pointer;
  display: grid; place-items: center;
}
[data-dsh-share-x]:hover { background: var(--dsw-alias-bg-hover, rgba(128,128,140,.10)); color: var(--dsw-alias-text-primary, #1d1d22); }

[data-dsh-share-body] { padding: 0 20px 4px; }
[data-dsh-share-option] {
  display: flex; align-items: center; gap: 9px; padding: 10px 12px; margin-bottom: 12px;
  border-radius: 10px; background: var(--dsw-alias-bg-base, #f7f7fa);
  color: var(--dsw-alias-text-secondary, #5f5f6b); font-size: 12.5px; cursor: pointer;
}
[data-dsh-share-option] input { accent-color: var(--dsw-alias-brand, #4d6bfe); }
[data-dsh-share-path] {
  margin: 0 0 12px; padding: 8px 12px; border-radius: 10px; font-size: 12px;
  background: var(--dsw-alias-bg-base, #f7f7fa); color: var(--dsw-alias-text-secondary, #5f5f6b);
  overflow-wrap: anywhere;
}
[data-dsh-share-urlrow] {
  display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 12px; margin-bottom: 4px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea); border-radius: 12px;
  background: var(--dsw-alias-bg-base, #f7f7fa);
}
[data-dsh-share-link] {
  flex: 1; min-width: 0; height: 26px; border: 0; background: transparent; color: inherit;
  font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis;
  outline: none;
}
[data-dsh-share-iconbtn] {
  flex: none; width: 30px; height: 30px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea); background: var(--dsw-alias-bg-elevated, #fff);
  color: var(--dsw-alias-text-secondary, #5f5f6b); display: grid; place-items: center;
  transition: background .15s ease, color .15s ease;
}
[data-dsh-share-iconbtn]:hover { background: var(--dsw-alias-bg-hover, #f0f0f5); color: var(--dsw-alias-text-primary, #1d1d22); }

[data-dsh-share-status] { display: flex; align-items: center; gap: 8px; margin: 10px 0 2px; font-size: 12.5px; }
[data-dsh-share-status][data-tone="ok"] { color: #1f9d63; }
[data-dsh-share-status][data-tone="warn"] { color: #b7791f; }
[data-dsh-share-status][data-tone="error"] { color: #d64545; }
[data-dsh-share-status] .dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex: none; }
[data-dsh-share-status] .grow { flex: 1; }
[data-dsh-share-status] button {
  border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer;
  height: 24px; padding: 0 9px; border-radius: 7px; font-size: 12px;
}
[data-dsh-share-status] button:hover { background: rgba(214,69,69,.08); }

[data-dsh-share-error] { color: #d64545; font-size: 12.5px; margin-top: 10px; white-space: pre-wrap; }
[data-dsh-share-guide] {
  margin: 12px 0 4px; padding: 12px 14px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  background: var(--dsw-alias-bg-base, #f7f7fa);
}
[data-dsh-share-guide] strong { display: block; font-size: 13px; margin-bottom: 4px; }
[data-dsh-share-guide] p { margin: 0 0 10px; font-size: 12.5px; color: var(--dsw-alias-text-secondary, #5f5f6b); }
[data-dsh-share-guide] .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
[data-dsh-share-guide] a[data-dsh-share-btn] {
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
  color: var(--dsw-alias-brand, #4d6bfe); background: var(--dsw-alias-bg-elevated, #fff);
}
[data-dsh-share-guide] code {
  flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all;
  font: 11.5px/1.9 ui-monospace, Menlo, monospace;
  background: var(--dsw-alias-bg-elevated, #fff); padding: 2px 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea);
}

[data-dsh-share-foot] {
  display: flex; align-items: center; gap: 8px; justify-content: flex-end;
  padding: 14px 20px 18px; margin-top: 14px;
  border-top: 1px solid var(--dsw-alias-border-secondary, #ededf2);
}
[data-dsh-share-foot] button {
  height: 32px; padding: 0 14px; border-radius: 9px; cursor: pointer; font-size: 13px;
  border: 1px solid var(--dsw-alias-border-secondary, #e3e3ea); background: transparent; color: inherit;
  transition: background .15s ease;
}
[data-dsh-share-foot] button:hover { background: var(--dsw-alias-bg-hover, rgba(128,128,140,.08)); }
[data-dsh-share-foot] button[data-primary="true"] {
  background: var(--dsw-alias-brand, #4d6bfe); border-color: transparent; color: #fff; font-weight: 500;
}
[data-dsh-share-foot] button[data-primary="true"]:hover { filter: brightness(1.06); }
[data-dsh-share-foot] button:disabled { opacity: .5; cursor: default; }
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
		/** 弹窗里用到的图标（16px，描边跟随 currentColor）。 */
		const ICONS = {
			link: "M6.6 9.4l2.8-2.8M6.1 10.6l-.7.7a2.6 2.6 0 0 1-3.7-3.7l1.9-1.9a2.6 2.6 0 0 1 3.7 0M9.9 5.4l.7-.7a2.6 2.6 0 0 1 3.7 3.7l-1.9 1.9a2.6 2.6 0 0 1-3.7 0",
			copy: "M5.5 5.5V3.9c0-.8.6-1.4 1.4-1.4h5.2c.8 0 1.4.6 1.4 1.4v5.2c0 .8-.6 1.4-1.4 1.4H10.5M3.9 5.5h5.2c.8 0 1.4.6 1.4 1.4v5.2c0 .8-.6 1.4-1.4 1.4H3.9c-.8 0-1.4-.6-1.4-1.4V6.9c0-.8.6-1.4 1.4-1.4z",
			open: "M6.5 3.5h6v6M12.5 3.5L6 10M12 9.5v2.2c0 .7-.6 1.3-1.3 1.3H4.3c-.7 0-1.3-.6-1.3-1.3V5.3c0-.7.6-1.3 1.3-1.3h2.2",
			close: "M4 4l8 8M12 4l-8 8"
		};
		/** 16px 图标元素。 */
		function Icon({ path, size = 16 }) {
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true"
			}, h("path", {
				d: path,
				stroke: "currentColor",
				"stroke-width": 1.4,
				"stroke-linecap": "round",
				"stroke-linejoin": "round"
			}));
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
			const [channel, setChannel] = react.default.useState(null);
			const submit = async () => {
				setBusy(true);
				setError("");
				try {
					const created = typeof absolutePath === "string" && absolutePath !== "" ? await post("/api/share-link/path", {
						path: absolutePath,
						channel
					}) : await post("/api/share-link/session", {
						sessionId,
						includeToolCalls: withTools,
						channel
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
					if (alive && value !== null) {
						setStatus(value);
						setChannel((current) => current ?? value.default ?? "quick");
					}
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, []);
			react.default.useEffect(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [onClose]);
			const target = typeof absolutePath === "string" && absolutePath !== "" ? absolutePath : null;
			const channels = status?.channels ?? {};
			const activeChannel = channel ?? status?.default ?? "quick";
			const activeReady = channels[activeChannel]?.ready !== false;
			const blocked = status !== null && !activeReady;
			const expires = entry !== null ? new Date(entry.expiresAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "";
			return h("div", {
				"data-dsh-share-overlay": true,
				onClick: (event) => {
					if (event.target === event.currentTarget) onClose();
				}
			}, h("div", {
				"data-dsh-share-card": true,
				role: "dialog",
				"aria-modal": "true",
				"aria-label": target === null ? tr("title.session", "Share this conversation") : tr("title.file", "Share this file")
			}, h("div", { "data-dsh-share-head": true }, h("span", { "data-dsh-share-badge": true }, h(Icon, {
				path: ICONS.link,
				size: 18
			})), h("div", { style: { minWidth: 0 } }, h("h3", null, target === null ? tr("title.session", "Share this conversation") : tr("title.file", "Share this file")), h("p", null, target === null ? tr("hint.session", "Creates a read-only snapshot link. The recipient needs no dsh install and cannot see your other sessions.") : tr("hint.file", "Publishes this file as a read-only link."))), h("button", {
				"data-dsh-share-x": true,
				type: "button",
				"aria-label": tr("close", "Close"),
				onClick: onClose
			}, h(Icon, { path: ICONS.close }))), h("div", { "data-dsh-share-body": true }, status === null || entry !== null ? null : h("div", {
				"data-dsh-share-channels": true,
				style: {
					display: "flex",
					gap: 6,
					flexWrap: "wrap",
					marginBottom: 12
				}
			}, [
				"quick",
				"surge",
				"named",
				"lan"
			].map((id) => h("button", {
				key: id,
				type: "button",
				"data-dsh-share-channel": id,
				"data-active": id === activeChannel ? "true" : "false",
				disabled: channels[id]?.ready === false,
				title: channels[id]?.ready === false ? channels[id]?.detail ?? "" : "",
				onClick: () => setChannel(id),
				style: {
					height: 28,
					padding: "0 11px",
					borderRadius: 8,
					fontSize: 12.5,
					cursor: channels[id]?.ready === false ? "not-allowed" : "pointer",
					border: id === activeChannel ? "1px solid var(--dsw-alias-brand, #4d6bfe)" : "1px solid var(--dsw-alias-border-secondary, #e3e3ea)",
					background: id === activeChannel ? "var(--dsw-alias-bg-layer-1, #f7f7fa)" : "transparent",
					color: channels[id]?.ready === false ? "#b6b6bf" : id === activeChannel ? "var(--dsw-alias-text-primary, #1d1d22)" : "var(--dsw-alias-text-secondary, #5f5f6b)",
					fontWeight: id === activeChannel ? 600 : 400
				}
			}, tr(`ch.${id}`, id)))), status !== null && !activeReady && entry === null ? h(GuidePanel, {
				guide: channels[activeChannel]?.guide,
				t
			}) : null, target === null && entry === null ? h("label", { "data-dsh-share-option": true }, h("input", {
				type: "checkbox",
				checked: withTools,
				onChange: (event) => setWithTools(event.target.checked)
			}), tr("option.tools", "Include tool-call names (result bodies are never included)")) : null, target === null ? null : h("div", { "data-dsh-share-path": true }, target), entry === null ? null : h("div", { "data-dsh-share-urlrow": true }, h("input", {
				"data-dsh-share-link": true,
				readOnly: true,
				value: entry.url,
				onFocus: (event) => event.target.select()
			}), h("button", {
				"data-dsh-share-iconbtn": true,
				type: "button",
				title: tr("copy", "Copy"),
				"aria-label": tr("copy", "Copy"),
				onClick: copy
			}, h(Icon, { path: ICONS.copy })), h("a", {
				"data-dsh-share-iconbtn": true,
				href: entry.url,
				target: "_blank",
				rel: "noreferrer",
				title: tr("open", "Open"),
				"aria-label": tr("open", "Open")
			}, h(Icon, { path: ICONS.open }))), entry === null ? null : h("div", {
				"data-dsh-share-status": true,
				"data-tone": "ok"
			}, h("span", { className: "dot" }), h("span", null, `${copied ? tr("copied", "Copied") : tr("ok", "Link created — ready to send.")} · ${tr("expires", "Expires")} ${expires}`), h("span", { className: "grow" }), h("button", {
				type: "button",
				disabled: busy,
				onClick: revoke
			}, tr("revoke", "Revoke"))), revoked && entry === null ? h("div", {
				"data-dsh-share-status": true,
				"data-tone": "warn"
			}, h("span", { className: "dot" }), h("span", null, tr("revoked", "Revoked — the link no longer works."))) : null, error !== "" && guide === null ? h("div", {
				"data-dsh-share-status": true,
				"data-tone": "error"
			}, h("span", { className: "dot" }), h("span", null, error)) : null, guide === null ? null : h(GuidePanel, {
				guide,
				t
			})), h("div", { "data-dsh-share-foot": true }, h("button", {
				type: "button",
				onClick: onClose
			}, tr("close", "Close")), entry !== null ? h("a", {
				href: entry.url,
				target: "_blank",
				rel: "noreferrer",
				style: {
					height: 32,
					padding: "0 14px",
					borderRadius: 9,
					display: "inline-flex",
					alignItems: "center",
					background: "var(--dsw-alias-brand, #4d6bfe)",
					color: "#fff",
					fontSize: 13,
					fontWeight: 500,
					textDecoration: "none"
				}
			}, tr("open", "Open")) : h("button", {
				"data-primary": "true",
				disabled: busy || blocked,
				onClick: submit,
				type: "button"
			}, busy ? tr("working", "Creating…") : blocked ? tr("blocked", "Finish the setup above first") : tr("create", "Create link")))));
		}
		/**
		* 会话分享的**宿主**：不渲染按钮，只负责在收到 `···` 菜单项的 OPEN_EVENT 时把对话框挂出来。
		* 入口只留菜单一项，避免右上角出现两个"分享"。
		*/
		function SessionShareHost(props) {
			const [open, setOpen] = react.default.useState(false);
			react.default.useEffect(() => {
				ensureStyle();
				const openFromMenu = () => setOpen(true);
				document.addEventListener(OPEN_EVENT, openFromMenu);
				return () => document.removeEventListener(OPEN_EVENT, openFromMenu);
			}, []);
			if (!open) return null;
			return h(ShareDialog, {
				sessionId: props.sessionId,
				t: props.t,
				onClose: () => setOpen(false)
			});
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
			"ch.quick": "快速隧道",
			"ch.surge": "Surge",
			"ch.named": "命名隧道",
			"ch.lan": "局域网",
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
			"ch.quick": "Quick tunnel",
			"ch.surge": "Surge",
			"ch.named": "Named tunnel",
			"ch.lan": "LAN",
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
				}, SessionShareHost));
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
