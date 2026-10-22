import Schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, networkInterfaces } from "node:os";
import { delimiter, dirname, extname, join, relative, resolve, sep } from "node:path";
import { foldSurface } from "@deepseek-ai/dsh-session";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll$1 = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp$1(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp$1(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp$1(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp$1(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region node_modules/.pnpm/mdurl@2.1.0/node_modules/mdurl/lib/decode.mjs
const decodeCache = {};
function getDecodeCache(exclude) {
	let cache = decodeCache[exclude];
	if (cache) return cache;
	cache = decodeCache[exclude] = [];
	for (let i = 0; i < 128; i++) {
		const ch = String.fromCharCode(i);
		cache.push(ch);
	}
	for (let i = 0; i < exclude.length; i++) {
		const ch = exclude.charCodeAt(i);
		cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
	}
	return cache;
}
function decode(string, exclude) {
	if (typeof exclude !== "string") exclude = decode.defaultChars;
	const cache = getDecodeCache(exclude);
	return string.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
		let result = "";
		for (let i = 0, l = seq.length; i < l; i += 3) {
			const b1 = parseInt(seq.slice(i + 1, i + 3), 16);
			if (b1 < 128) {
				result += cache[b1];
				continue;
			}
			if ((b1 & 224) === 192 && i + 3 < l) {
				const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
				if ((b2 & 192) === 128) {
					const chr = b1 << 6 & 1984 | b2 & 63;
					if (chr < 128) result += "��";
					else result += String.fromCharCode(chr);
					i += 3;
					continue;
				}
			}
			if ((b1 & 240) === 224 && i + 6 < l) {
				const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
				const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
				if ((b2 & 192) === 128 && (b3 & 192) === 128) {
					const chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
					if (chr < 2048 || chr >= 55296 && chr <= 57343) result += "���";
					else result += String.fromCharCode(chr);
					i += 6;
					continue;
				}
			}
			if ((b1 & 248) === 240 && i + 9 < l) {
				const b2 = parseInt(seq.slice(i + 4, i + 6), 16);
				const b3 = parseInt(seq.slice(i + 7, i + 9), 16);
				const b4 = parseInt(seq.slice(i + 10, i + 12), 16);
				if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
					let chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
					if (chr < 65536 || chr > 1114111) result += "����";
					else {
						chr -= 65536;
						result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
					}
					i += 9;
					continue;
				}
			}
			result += "�";
		}
		return result;
	});
}
decode.defaultChars = ";/?:@&=+$,#";
decode.componentChars = "";
//#endregion
//#region node_modules/.pnpm/mdurl@2.1.0/node_modules/mdurl/lib/encode.mjs
const encodeCache = {};
function getEncodeCache(exclude) {
	let cache = encodeCache[exclude];
	if (cache) return cache;
	cache = encodeCache[exclude] = [];
	for (let i = 0; i < 128; i++) {
		const ch = String.fromCharCode(i);
		if (/^[0-9a-z]$/i.test(ch)) cache.push(ch);
		else cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
	}
	for (let i = 0; i < exclude.length; i++) cache[exclude.charCodeAt(i)] = exclude[i];
	return cache;
}
function encode(string, exclude, keepEscaped) {
	if (typeof exclude !== "string") {
		keepEscaped = exclude;
		exclude = encode.defaultChars;
	}
	if (typeof keepEscaped === "undefined") keepEscaped = true;
	const cache = getEncodeCache(exclude);
	let result = "";
	for (let i = 0, l = string.length; i < l; i++) {
		const code = string.charCodeAt(i);
		if (keepEscaped && code === 37 && i + 2 < l) {
			if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
				result += string.slice(i, i + 3);
				i += 2;
				continue;
			}
		}
		if (code < 128) {
			result += cache[code];
			continue;
		}
		if (code >= 55296 && code <= 57343) {
			if (code >= 55296 && code <= 56319 && i + 1 < l) {
				const nextCode = string.charCodeAt(i + 1);
				if (nextCode >= 56320 && nextCode <= 57343) {
					result += encodeURIComponent(string[i] + string[i + 1]);
					i++;
					continue;
				}
			}
			result += "%EF%BF%BD";
			continue;
		}
		result += encodeURIComponent(string[i]);
	}
	return result;
}
encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";
//#endregion
//#region node_modules/.pnpm/mdurl@2.1.0/node_modules/mdurl/lib/format.mjs
function format(url) {
	let result = "";
	result += url.protocol || "";
	result += url.slashes ? "//" : "";
	result += url.auth ? url.auth + "@" : "";
	if (url.hostname && url.hostname.indexOf(":") !== -1) result += "[" + url.hostname + "]";
	else result += url.hostname || "";
	result += url.port ? ":" + url.port : "";
	result += url.pathname || "";
	result += url.search || "";
	result += url.hash || "";
	return result;
}
//#endregion
//#region node_modules/.pnpm/mdurl@2.1.0/node_modules/mdurl/lib/parse.mjs
function Url() {
	this.protocol = null;
	this.slashes = null;
	this.auth = null;
	this.port = null;
	this.hostname = null;
	this.hash = null;
	this.search = null;
	this.pathname = null;
}
const protocolPattern = /^([a-z0-9.+-]+:)/i;
const portPattern = /:[0-9]*$/;
const simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
const unwise = [
	"{",
	"}",
	"|",
	"\\",
	"^",
	"`"
].concat([
	"<",
	">",
	"\"",
	"`",
	" ",
	"\r",
	"\n",
	"	"
]);
const autoEscape = ["'"].concat(unwise);
const nonHostChars = [
	"%",
	"/",
	"?",
	";",
	"#"
].concat(autoEscape);
const hostEndingChars = [
	"/",
	"?",
	"#"
];
const hostnameMaxLen = 255;
const hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
const hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
const hostlessProtocol = {
	javascript: true,
	"javascript:": true
};
const slashedProtocol = {
	http: true,
	https: true,
	ftp: true,
	gopher: true,
	file: true,
	"http:": true,
	"https:": true,
	"ftp:": true,
	"gopher:": true,
	"file:": true
};
function urlParse(url, slashesDenoteHost) {
	if (url && url instanceof Url) return url;
	const u = new Url();
	u.parse(url, slashesDenoteHost);
	return u;
}
Url.prototype.parse = function(url, slashesDenoteHost) {
	let lowerProto, hec, slashes;
	let rest = url;
	rest = rest.trim();
	if (!slashesDenoteHost && url.split("#").length === 1) {
		const simplePath = simplePathPattern.exec(rest);
		if (simplePath) {
			this.pathname = simplePath[1];
			if (simplePath[2]) this.search = simplePath[2];
			return this;
		}
	}
	let proto = protocolPattern.exec(rest);
	if (proto) {
		proto = proto[0];
		lowerProto = proto.toLowerCase();
		this.protocol = proto;
		rest = rest.substr(proto.length);
	}
	if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
		slashes = rest.substr(0, 2) === "//";
		if (slashes && !(proto && hostlessProtocol[proto])) {
			rest = rest.substr(2);
			this.slashes = true;
		}
	}
	if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
		let hostEnd = -1;
		for (let i = 0; i < hostEndingChars.length; i++) {
			hec = rest.indexOf(hostEndingChars[i]);
			if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) hostEnd = hec;
		}
		let auth, atSign;
		if (hostEnd === -1) atSign = rest.lastIndexOf("@");
		else atSign = rest.lastIndexOf("@", hostEnd);
		if (atSign !== -1) {
			auth = rest.slice(0, atSign);
			rest = rest.slice(atSign + 1);
			this.auth = auth;
		}
		hostEnd = -1;
		for (let i = 0; i < nonHostChars.length; i++) {
			hec = rest.indexOf(nonHostChars[i]);
			if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) hostEnd = hec;
		}
		if (hostEnd === -1) hostEnd = rest.length;
		if (rest[hostEnd - 1] === ":") hostEnd--;
		const host = rest.slice(0, hostEnd);
		rest = rest.slice(hostEnd);
		this.parseHost(host);
		this.hostname = this.hostname || "";
		const ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
		if (!ipv6Hostname) {
			const hostparts = this.hostname.split(/\./);
			for (let i = 0, l = hostparts.length; i < l; i++) {
				const part = hostparts[i];
				if (!part) continue;
				if (!part.match(hostnamePartPattern)) {
					let newpart = "";
					for (let j = 0, k = part.length; j < k; j++) if (part.charCodeAt(j) > 127) newpart += "x";
					else newpart += part[j];
					if (!newpart.match(hostnamePartPattern)) {
						const validParts = hostparts.slice(0, i);
						const notHost = hostparts.slice(i + 1);
						const bit = part.match(hostnamePartStart);
						if (bit) {
							validParts.push(bit[1]);
							notHost.unshift(bit[2]);
						}
						if (notHost.length) rest = notHost.join(".") + rest;
						this.hostname = validParts.join(".");
						break;
					}
				}
			}
		}
		if (this.hostname.length > hostnameMaxLen) this.hostname = "";
		if (ipv6Hostname) this.hostname = this.hostname.substr(1, this.hostname.length - 2);
	}
	const hash = rest.indexOf("#");
	if (hash !== -1) {
		this.hash = rest.substr(hash);
		rest = rest.slice(0, hash);
	}
	const qm = rest.indexOf("?");
	if (qm !== -1) {
		this.search = rest.substr(qm);
		rest = rest.slice(0, qm);
	}
	if (rest) this.pathname = rest;
	if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) this.pathname = "";
	return this;
};
Url.prototype.parseHost = function(host) {
	let port = portPattern.exec(host);
	if (port) {
		port = port[0];
		if (port !== ":") this.port = port.substr(1);
		host = host.substr(0, host.length - port.length);
	}
	if (host) this.hostname = host;
};
//#endregion
//#region node_modules/.pnpm/mdurl@2.1.0/node_modules/mdurl/index.mjs
var mdurl_exports = /* @__PURE__ */ __exportAll$1({
	decode: () => decode,
	encode: () => encode,
	format: () => format,
	parse: () => urlParse
});
//#endregion
//#region node_modules/.pnpm/uc.micro@3.0.0/node_modules/uc.micro/build/index.mjs
var build_exports = /* @__PURE__ */ __exportAll$1({
	Any: () => Any,
	Cc: () => Cc,
	Cf: () => Cf,
	P: () => P,
	S: () => S,
	Z: () => Z
});
const Any = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
const Cc = /[\0-\x1F\x7F-\x9F]/;
const Cf = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
const P = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B4E\u1B4F\u1B5A-\u1B60\u1B7D-\u1B7F\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDD6E\uDEAD\uDED0\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9\uDFD4\uDFD5\uDFD7\uDFD8]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09\uDFE1]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDD6D-\uDD6F\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD839\uDDFF|\uD83A[\uDD5E\uDD5F]/;
const S = /[\$\+<->\^`\|~\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u07FE\u07FF\u0888\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D4F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u166D\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20C1\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u2429\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2BFF\u2CE5-\u2CEA\u2E50\u2E51\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFF\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E5\u31EF\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uAB6A\uAB6B\uFB29\uFBB2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDCF\uFDFC-\uFDFF\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C-\uDD8E\uDD90-\uDD9C\uDDA0\uDDD0-\uDDFC]|\uD802[\uDC77\uDC78\uDEC8]|\uD803[\uDD8E\uDD8F\uDED1-\uDED8]|\uD805\uDF3F|\uD807[\uDFD5-\uDFF1]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD82F\uDC9C|\uD833[\uDC00-\uDCEF\uDCFA-\uDCFC\uDD00-\uDEB3\uDEBA-\uDED0\uDEE0-\uDEF0\uDF50-\uDFC3]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDEA\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD838[\uDD4F\uDEFF]|\uD83B[\uDCAC\uDCB0\uDD2E\uDEF0\uDEF1]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD0D-\uDDAD\uDDE6-\uDE02\uDE10-\uDE3B\uDE40-\uDE48\uDE50\uDE51\uDE60-\uDE65\uDF00-\uDFFF]|\uD83D[\uDC00-\uDED8\uDEDC-\uDEEC\uDEF0-\uDEFC\uDF00-\uDFD9\uDFE0-\uDFEB\uDFF0]|\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDCB0-\uDCBB\uDCC0\uDCC1\uDCD0-\uDCD8\uDD00-\uDE57\uDE60-\uDE6D\uDE70-\uDE7C\uDE80-\uDE8A\uDE8E-\uDEC6\uDEC8\uDECD-\uDEDC\uDEDF-\uDEEA\uDEEF-\uDEF8\uDF00-\uDF92\uDF94-\uDFEF\uDFFA]/;
const Z = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;
//#endregion
//#region node_modules/.pnpm/entities@8.1.0/node_modules/entities/dist/decode-codepoint.js
/**
* C1 Unicode control character reference replacements (code points 128–159).
* Index i gives the replacement for code point 128+i; 0 means "no replacement".
*/
const c1 = [
	8364,
	0,
	8218,
	402,
	8222,
	8230,
	8224,
	8225,
	710,
	8240,
	352,
	8249,
	338,
	0,
	381,
	0,
	0,
	8216,
	8217,
	8220,
	8221,
	8226,
	8211,
	8212,
	732,
	8482,
	353,
	8250,
	339,
	0,
	382,
	376
];
/**
* True for NUL, UTF-16 surrogates, and values past U+10FFFF.
* @param codePoint Unicode code point to check.
*/
function isInvalidCodePoint(codePoint) {
	return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
/**
* Replace the given code point with U+FFFD if it is NUL (0), a surrogate, or
* outside the valid Unicode range. Code points in the C1 controls range
* (128–159) are remapped to their Windows-1252 equivalents, following the
* HTML spec. All other code points are returned unchanged.
* @param codePoint Unicode code point to convert.
*/
function replaceCodePoint(codePoint) {
	if (isInvalidCodePoint(codePoint)) return 65533;
	if (codePoint >= 128 && codePoint <= 159) return c1[codePoint - 128] || codePoint;
	return codePoint;
}
/**
* Convert the code point of a decoded numeric entity to a string, replacing
* invalid values.
*
* Fast path for plain BMP code points: [1..0x7F] and [0xA0..0xD7FF] pass
* `replaceCodePoint` unchanged (no NUL, C1 remap, surrogate, or out-of-range
* handling) and fit a single charCode. 0xd760 = 0xD800 (the first surrogate)
* - 0xA0.
* @param codePoint Unicode code point to convert.
*/
function codePointToString(codePoint) {
	return codePoint - 1 >>> 0 < 127 || codePoint - 160 >>> 0 < 55136 ? String.fromCharCode(codePoint) : String.fromCodePoint(replaceCodePoint(codePoint));
}
//#endregion
//#region node_modules/.pnpm/entities@8.1.0/node_modules/entities/dist/internal/decode-shared.js
const BASE91_INVERSE = /* #__PURE__ */ (() => {
	const table = /* @__PURE__ */ new Uint8Array(127);
	let code = 0;
	for (let char = 33; char <= 126; char++) if (char !== 34 && char !== 36 && char !== 92) table[char] = code++;
	return table;
})();
/**
* Decode a dictionary-encoded trie string back into its Uint16Array.
*
* Stream layout (consumed in this order):
*   1. dict1 atoms — `dict1AtomCount` uint16 values, delta+RLE encoded.
*   2. dict2 atoms — `atomCount - dict1AtomCount` values, delta+RLE.
*   3. dict2 ngrams — `ngramCount - (dictSize - dict1AtomCount)` entries,
*      each a pair of slot codes that resolve to earlier slots.
*   4. dict1 ngrams — `dictSize - dict1AtomCount` entries, same shape.
*   5. data — slot codes, each expanding to one or more uint16 values.
*
* Codes use a 91-char base (printable ASCII minus `"`, `$`, `\`):
*   - char1 < dictSize  → 1-char code, slot = char1
*   - char1 ≥ dictSize  → 2-char code, slot = dictSize + (char1 - dictSize)*91 + char2
*
* Slot index → token kind:
*   [0, A)                  dict1 atoms     (1-char codes)
*   [A, dictSize)           dict1 ngrams    (1-char codes)
*   [dictSize, dictSize+D)  dict2 atoms     (2-char codes)
*   [dictSize+D, end)       dict2 ngrams    (2-char codes)
*
* Both atom dicts decode before any ngram, and dict2 ngrams decode before
* dict1 ngrams. So every ngram entry references slots whose contents are
* already filled — no forward references to handle.
*
* This runs on library import. Flat typed arrays store each slot as either
* a plain value (`single`, covering every atom) or a range in a shared
* `pool` (ngrams).
* @param input Packed trie string.
* @param resultLength Expected number of uint16 values in the output.
* @param atomCount Total number of distinct uint16 values in the trie.
* @param dict1AtomCount Atoms in the 1-char range (`A` above).
* @param ngramCount Total number of ngram entries (dict1 + dict2).
* @param dictSize Number of 1-char code slots; the rest of `BASE - dictSize`
*   first-byte values are 2-char codes.
*/
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
	const base = 91;
	const inputLength = input.length;
	const twoCharBias = dictSize * (base - 1);
	let pos = 0;
	/** Read one slot code at `pos` and return its slot index, advancing pos. */
	const readSlotCode = () => {
		const c1 = BASE91_INVERSE[input.charCodeAt(pos++)];
		return c1 < dictSize ? c1 : c1 * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
	};
	const dict2AtomCount = atomCount - dict1AtomCount;
	const slotCount = atomCount + ngramCount;
	const single = new Int32Array(slotCount);
	single.fill(-1, dict1AtomCount, dictSize);
	single.fill(-1, dictSize + dict2AtomCount, slotCount);
	const start = new Int32Array(slotCount);
	const length = new Int32Array(slotCount);
	/**
	* Decode `count` ascending uint16 values from a delta+RLE stream into
	* `single[off..off+count)`.
	*
	*   code < 89   → delta = code
	*   code == 89  → run-length: next char encodes runLength-2; emit `runLength` consecutive +1 values
	*   code == 90, next < 90  → escape: delta = 89 + next * BASE + after-next
	*   code == 90, next == 90 → double-escape: extra char for very large deltas
	* @param count
	* @param off
	*/
	function decodeDelta(count, off) {
		let previous = 0;
		let slot = off;
		const end = off + count;
		while (slot < end) {
			const code = BASE91_INVERSE[input.charCodeAt(pos++)];
			if (code < 89) {
				previous += code;
				single[slot++] = previous;
			} else if (code === 89) {
				let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
				while (runLength--) single[slot++] = ++previous;
			} else {
				const next = BASE91_INVERSE[input.charCodeAt(pos++)];
				previous += 89 + (next < 90 ? next * base + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base + BASE91_INVERSE[input.charCodeAt(pos++)]);
				single[slot++] = previous;
			}
		}
	}
	decodeDelta(dict1AtomCount, 0);
	decodeDelta(dict2AtomCount, dictSize);
	const references = new Int32Array(ngramCount * 2);
	let poolSize = 0;
	let ngramIndex = 0;
	/**
	* Read `count` ngram entries (each = 2 slot-code references) for the slots
	* starting at `startSlot`, recording references and assigning pool ranges.
	* @param count
	* @param startSlot
	*/
	function readNgramReferences(count, startSlot) {
		for (let index = 0; index < count; index++) {
			const slot = startSlot + index;
			const a = readSlotCode();
			const b = readSlotCode();
			references[ngramIndex * 2] = a;
			references[ngramIndex * 2 + 1] = b;
			ngramIndex += 1;
			start[slot] = poolSize;
			const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
			length[slot] = entryLength;
			poolSize += entryLength;
		}
	}
	readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
	readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
	const pool = new Uint16Array(poolSize);
	let write = 0;
	for (let index = 0; index < ngramIndex; index++) for (let half = 0; half < 2; half++) {
		const source = references[index * 2 + half];
		const value = single[source];
		if (value < 0) {
			let read = start[source];
			const readEnd = read + length[source];
			while (read < readEnd) pool[write++] = pool[read++];
		} else pool[write++] = value;
	}
	const out = new Uint16Array(resultLength);
	let outIndex = 0;
	while (pos < inputLength) {
		let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
		if (slot >= dictSize) slot = slot * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
		const value = single[slot];
		if (value < 0) {
			let read = start[slot];
			const readEnd = read + length[slot];
			while (read < readEnd) out[outIndex++] = pool[read++];
		} else out[outIndex++] = value;
	}
	return out;
}
//#endregion
//#region node_modules/.pnpm/entities@8.1.0/node_modules/entities/dist/generated/decode-data-html.js
/** Packed HTML decode trie data. */
const htmlDecodeTree = /* #__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);
//#endregion
//#region node_modules/.pnpm/entities@8.1.0/node_modules/entities/dist/internal/bin-trie-flags.js
/**
* Bit flags & masks for the binary trie encoding used for entity decoding.
*
* The trie is a flat `Uint16Array`. Every node starts with one header word:
*
*   15..14 VALUE_LENGTH   Number of words the value occupies, +1.
*                         0 = no value; 1 = value inline in bits 12..0;
*                         2/3 = value in the 1/2 words after the header.
*   13     FLAG13         If VALUE_LENGTH > 0: semicolon required ("strict"
*                         entity; `;` is never stored as a branch).
*                         If VALUE_LENGTH == 0: this node is a compact run.
*   12..7  BRANCH_LENGTH  Number of branches (or run length for runs).
*   6..0   JUMP_TABLE     Jump-table offset / single-branch char / first
*                         run char (see below).
*
* Branch data follows the header and any value words. Its shape is selected
* by (JUMP_TABLE, BRANCH_LENGTH) in the header:
*
*   Single branch  JUMP_TABLE = the only child's char, BRANCH_LENGTH = 0.
*                  No branch words; the child node follows immediately.
*   Jump table     JUMP_TABLE = first covered char (> 0), BRANCH_LENGTH =
*                  table length. One word per covered char: 0 = no branch,
*                  otherwise the child's offset from the END of the table,
*                  +1 (so 0 stays the no-branch sentinel).
*   Dictionary     JUMP_TABLE = 0, BRANCH_LENGTH = number of branches.
*                  ceil(n/2) words of sorted keys packed two per word
*                  (low byte first), then n pointer words storing the
*                  child's offset from the END of the branch data.
*   Compact run    VALUE_LENGTH = 0, FLAG13 set. BRANCH_LENGTH = run
*                  length (3..63), JUMP_TABLE = first char; remaining run
*                  chars packed two per word after the header. The target
*                  node follows the packed words immediately.
*
* Pointers are end-relative (rather than relative to the pointer's own
* position) because that makes the common "child encoded right after the
* branch data" case a small constant, which compresses far better. Offsets
* to already-encoded (shared) nodes wrap via uint16 modulo arithmetic; the
* decoder masks navigation results with `& 0xff_ff` to match.
*/
var BinTrieFlags;
(function(BinTrieFlags) {
	BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
	BinTrieFlags[BinTrieFlags["FLAG13"] = 8192] = "FLAG13";
	BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
	BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
	/** Bits 12..0: the inline value of a VALUE_LENGTH = 1 header word. */
	BinTrieFlags[BinTrieFlags["VALUE_MASK"] = 8191] = "VALUE_MASK";
})(BinTrieFlags || (BinTrieFlags = {}));
//#endregion
//#region node_modules/.pnpm/entities@8.1.0/node_modules/entities/dist/decode.js
var CharCodes;
(function(CharCodes) {
	CharCodes[CharCodes["AMP"] = 38] = "AMP";
	CharCodes[CharCodes["NUM"] = 35] = "NUM";
	CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
	CharCodes[CharCodes["EQUALS"] = 61] = "EQUALS";
	CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
	CharCodes[CharCodes["NINE"] = 57] = "NINE";
	CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
	CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
})(CharCodes || (CharCodes = {}));
/** Bit that needs to be set to convert an upper case ASCII character to lower case */
const TO_LOWER_BIT = 32;
const CONSUMED_SHIFT = 21;
const CODE_POINT_MASK = 2097151;
/**
* Reserved consumed field for counts of at least 2047 characters after `&`.
* The true count is in `longNumericConsumed`.
*/
const CONSUMED_OVERFLOW = 2047;
/**
* Side channel for numeric entities of at least 2048 characters including
* `&`. Set by `parseNumericEntity` when its consumed count reaches the
* reserved value `CONSUMED_OVERFLOW`; callers read the true count from here.
* A module-level slot avoids a tuple allocation on the hot path.
*/
let longNumericConsumed = 0;
/**
* Extract the consumed count from a `parseNumericEntity` packed result,
* recovering the true length from `longNumericConsumed` when the packed
* field contains the sentinel. Read it before the next `parseNumericEntity`
* call, which may overwrite the side channel. This helper owns that protocol.
* @param packed Packed result of `parseNumericEntity`.
*/
function unpackConsumed(packed) {
	const consumed = packed >>> CONSUMED_SHIFT;
	return consumed === CONSUMED_OVERFLOW ? longNumericConsumed : consumed;
}
/**
* Unsigned subtraction trick: (code - lo) >>> 0 wraps negatives to large
* values, so a single `<=` covers the entire [lo..hi] range check.
* @param code Code point to check.
*/
function isNumber(code) {
	return code - CharCodes.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter(code) {
	return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 5;
}
function isAlpha(code) {
	return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 25;
}
/**
* Checks if the given character is a valid end character for an entity in an attribute.
*
* Attribute values that aren't terminated properly aren't parsed, and shouldn't lead to a parser error.
* See the example in https://html.spec.whatwg.org/multipage/parsing.html#named-character-reference-state
* @param code Code point to check.
*/
function isEntityInAttributeInvalidEnd(code) {
	return code === CharCodes.EQUALS || isAlpha(code) || isNumber(code);
}
var EntityDecoderState;
(function(EntityDecoderState) {
	EntityDecoderState[EntityDecoderState["EntityStart"] = 0] = "EntityStart";
	EntityDecoderState[EntityDecoderState["NumericStart"] = 1] = "NumericStart";
	EntityDecoderState[EntityDecoderState["NumericDecimal"] = 2] = "NumericDecimal";
	EntityDecoderState[EntityDecoderState["NumericHex"] = 3] = "NumericHex";
	EntityDecoderState[EntityDecoderState["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
/**
* Decoding mode for named entities.
*/
var DecodingMode;
(function(DecodingMode) {
	/** Entities in text nodes that can end with any character. */
	DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
	/** Only allow entities terminated with a semicolon. */
	DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
	/** Entities in attributes have limitations on ending characters. */
	DecodingMode[DecodingMode["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
/**
* Determines the branch of the current node that is taken given the current
* character. This function is used to traverse the trie.
*
* See `BinTrieFlags` for the branch-data layouts handled here.
* @param decodeTree The trie.
* @param current The current node's header word.
* @param nodeIndex Index of the node's first branch-data word (the header
*   plus any value words have been skipped by the caller).
* @param char The current character.
* @returns The index of the next node, or -1 if no branch is taken.
*/
function determineBranch(decodeTree, current, nodeIndex, char) {
	const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
	const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
	if (jumpOffset) {
		if (branchCount === 0) return char === jumpOffset ? nodeIndex : -1;
		const slot = char - jumpOffset;
		if (slot >>> 0 >= branchCount) return -1;
		const stored = decodeTree[nodeIndex + slot];
		return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
	}
	if (branchCount === 0) return -1;
	const packedKeySlots = branchCount + 1 >> 1;
	const branchEnd = nodeIndex + packedKeySlots + branchCount;
	for (let index = 0; index < branchCount; index++) {
		const key = decodeTree[nodeIndex + (index >> 1)] >> ((index & 1) << 3) & 255;
		if (key === char) return branchEnd + decodeTree[nodeIndex + packedKeySlots + index] & 65535;
		if (key > char) return -1;
	}
	return -1;
}
/**
* Read the decoded value from a trie node.
* @param decodeTree The trie.
* @param nodeIndex The index of the node.
* @param valueLength The length of the value (1, 2, or 3).
* @returns The decoded string.
*/
function readTrieValue(decodeTree, nodeIndex, valueLength) {
	if (valueLength === 1) return String.fromCharCode(decodeTree[nodeIndex] & BinTrieFlags.VALUE_MASK);
	if (valueLength === 2) return String.fromCharCode(decodeTree[nodeIndex + 1]);
	return String.fromCharCode(decodeTree[nodeIndex + 1], decodeTree[nodeIndex + 2]);
}
/**
* Parse a numeric entity (`&#DDD;` or `&#xHHH;`).
*
* Encodes the result as `(consumed << CONSUMED_SHIFT) | codepoint` (see
* the packing comment at the top of the file; overlong entities spill
* their length into `longNumericConsumed`). Returns 0 when no digits were
* found.
*
* This is the sync counterpart of the streaming
* `EntityDecoder#stateNumericDecimal` / `#stateNumericHex`. Digit parsing
* matches those methods; only this packed result needs a value clamp.
* @param input       The input string.
* @param numberStart Index of the `#` character.
* @param inputLength Cached `input.length`.
*/
function parseNumericEntity(input, numberStart, inputLength) {
	let offset = numberStart + 1;
	let cp = 0;
	let digitStart = offset;
	if (offset < inputLength && (input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
		offset += 1;
		digitStart = offset;
		while (offset < inputLength) {
			const char = input.charCodeAt(offset);
			if (isNumber(char)) cp = cp * 16 + (char - CharCodes.ZERO);
			else if (isHexadecimalCharacter(char)) cp = cp * 16 + ((char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10);
			else break;
			offset += 1;
		}
	} else while (offset < inputLength) {
		const digit = input.charCodeAt(offset) - CharCodes.ZERO;
		if (digit >>> 0 > 9) break;
		cp = cp * 10 + digit;
		offset += 1;
	}
	if (offset === digitStart) return 0;
	if (offset < inputLength && input.charCodeAt(offset) === CharCodes.SEMI) offset += 1;
	if (cp > 1114111) cp = 1114112;
	let consumed = offset - numberStart;
	if (consumed >= CONSUMED_OVERFLOW) {
		longNumericConsumed = consumed;
		consumed = CONSUMED_OVERFLOW;
	}
	return consumed << CONSUMED_SHIFT | cp;
}
/**
* Decode all entities in `input` using the HTML trie.
*
* Hard-wired to `htmlDecodeTree`: the inline root navigation below assumes
* the HTML root's jump-table shape, so this must not be generalized to
* other tries (the XML trie's dictionary root would silently match no
* entities — `decodeXML` has its own hand-coded fast path instead).
* @param input      The string to decode.
* @param isStrict Only match semicolon-terminated entities.
* @param isAttribute Whether to apply attribute-specific parsing rules (disallowing certain non-semicolon terminators).
* @returns The decoded string.
*/
function decodeWithTrie(input, isStrict, isAttribute) {
	const decodeTree = htmlDecodeTree;
	let offset = input.indexOf("&");
	if (offset < 0) return input;
	const inputLength = input.length;
	let chunkStart = 0;
	let result = "";
	const root = decodeTree[0];
	const rootJumpOffset = root & BinTrieFlags.JUMP_TABLE;
	const rootBranchCount = (root & BinTrieFlags.BRANCH_LENGTH) >> 7;
	do {
		const entityStart = offset + 1;
		const firstChar = input.charCodeAt(entityStart);
		let consumed;
		let value;
		if (firstChar === CharCodes.NUM) {
			const packed = parseNumericEntity(input, entityStart, inputLength);
			consumed = unpackConsumed(packed);
			if (isStrict && consumed > 0 && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI) consumed = 0;
			value = consumed === 0 ? "" : codePointToString(packed & CODE_POINT_MASK);
		} else if (isAlpha(firstChar)) {
			consumed = 0;
			value = "";
			const rootSlotIndex = firstChar - rootJumpOffset;
			let nodeIndex;
			if (rootSlotIndex >>> 0 < rootBranchCount) {
				const stored = decodeTree[1 + rootSlotIndex];
				nodeIndex = stored === 0 ? -1 : rootBranchCount + stored & 65535;
			} else nodeIndex = -1;
			let bestNodeIndex = 0;
			let bestValueLength = 0;
			let current = nodeIndex < 0 ? 0 : decodeTree[nodeIndex];
			let index = entityStart + 1;
			trie: while (index < inputLength) {
				while ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0) {
					const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
					const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
					if (branchCount === 0) {
						if (input.charCodeAt(index) !== jumpOffset) break trie;
						nodeIndex += 1;
					} else {
						const slot = input.charCodeAt(index) - jumpOffset;
						if (slot >>> 0 >= branchCount) break trie;
						const stored = decodeTree[nodeIndex + 1 + slot];
						if (stored === 0) break trie;
						nodeIndex = nodeIndex + branchCount + stored & 65535;
					}
					current = decodeTree[nodeIndex];
					index += 1;
					if (index >= inputLength) break trie;
				}
				if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
					const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
					if (input.charCodeAt(index) !== (current & BinTrieFlags.JUMP_TABLE)) break;
					index += 1;
					const remaining = runLength - 1;
					let wordIndex = nodeIndex + 1;
					let charIndexInPacked = 0;
					for (; charIndexInPacked + 1 < remaining; charIndexInPacked += 2) {
						const packed = decodeTree[wordIndex];
						if (input.charCodeAt(index) !== (packed & 255)) break trie;
						index += 1;
						if (input.charCodeAt(index) !== (packed >> 8 & 255)) break trie;
						index += 1;
						wordIndex += 1;
					}
					if (charIndexInPacked < remaining) {
						if (input.charCodeAt(index) !== (decodeTree[wordIndex] & 255)) break;
						index += 1;
					}
					nodeIndex += 1 + (runLength >> 1);
					current = decodeTree[nodeIndex];
					continue;
				}
				const valueLength = current >>> 14;
				const char = input.charCodeAt(index);
				if (valueLength !== 0) {
					if (char === CharCodes.SEMI) {
						consumed = index - entityStart + 1;
						value = valueLength === 1 ? String.fromCharCode(current & BinTrieFlags.VALUE_MASK) : readTrieValue(decodeTree, nodeIndex, valueLength);
						break;
					}
					if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
						consumed = index - entityStart;
						bestNodeIndex = nodeIndex;
						bestValueLength = valueLength;
					}
					if (valueLength === 1) break;
				}
				const next = determineBranch(decodeTree, current, nodeIndex + (valueLength || 1), char);
				if (next < 0) break;
				nodeIndex = next;
				current = decodeTree[nodeIndex];
				index += 1;
			}
			if (value === "") {
				const finalVL = current >>> 14;
				if (finalVL !== 0 && !isStrict && (current & BinTrieFlags.FLAG13) === 0) {
					consumed = index - entityStart;
					bestNodeIndex = nodeIndex;
					bestValueLength = finalVL;
				}
				if (consumed > 0) value = readTrieValue(decodeTree, bestNodeIndex, bestValueLength);
			}
		} else {
			consumed = 0;
			value = "";
		}
		if (consumed === 0 || isAttribute && firstChar !== CharCodes.NUM && input.charCodeAt(entityStart + consumed - 1) !== CharCodes.SEMI && entityStart + consumed < inputLength && isEntityInAttributeInvalidEnd(input.charCodeAt(entityStart + consumed))) offset = entityStart;
		else {
			if (chunkStart < offset) result += input.slice(chunkStart, offset);
			result += value;
			offset = chunkStart = entityStart + consumed;
		}
		if (input.charCodeAt(offset) !== CharCodes.AMP) offset = input.indexOf("&", offset);
	} while (offset >= 0);
	return result + input.slice(chunkStart);
}
/**
* Decodes an HTML string, requiring all entities to be terminated by a semicolon.
* @param htmlString The string to decode.
* @returns The decoded string.
*/
function decodeHTMLStrict(htmlString) {
	return decodeWithTrie(htmlString, true, false);
}
//#endregion
//#region node_modules/.pnpm/linkify-it@6.1.0/node_modules/linkify-it/build/index.mjs
var REBuilder = class {
	src_Any = Any.source;
	src_Cc = Cc.source;
	src_Z = Z.source;
	src_P = P.source;
	src_ZPCc = [
		this.src_Z,
		this.src_P,
		this.src_Cc
	].join("|");
	src_ZCc = [this.src_Z, this.src_Cc].join("|");
	cache = {};
	opts = {
		maxLength: 1e4,
		urlAuth: false,
		schema_names: []
	};
	constructor(opts = {}) {
		this.opts = {
			...this.opts,
			...opts
		};
	}
	set(opts = {}) {
		this.opts = {
			...this.opts,
			...opts
		};
		this.cache = {};
		return this;
	}
	escapeRE(str) {
		return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
	}
	nestedPairRE(open, close, depth = 4) {
		const openRE = this.escapeRE(open);
		const closeRE = this.escapeRE(close);
		const atom = `(?:(?!${this.src_ZCc}|${openRE}|${closeRE}).)`;
		let pair = `${openRE}${atom}{0,1000}${closeRE}`;
		for (let level = 2; level <= depth; level++) pair = `${openRE}(?:${atom}|${pair}){0,1000}${closeRE}`;
		return pair;
	}
	get_text_separators() {
		return this.cache.text_separators ??= /[><\uff5c]/;
	}
	get_pseudo_letter() {
		return this.cache.src_pseudo_letter ??= new RegExp(`(?:(?!${this.get_text_separators().source}|${this.src_ZPCc})${this.src_Any})`);
	}
	get_ipv4_addr() {
		return this.cache.src_ip4 ??= /* @__PURE__ */ new RegExp("(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])[.]){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])");
	}
	get_ipv6_addr() {
		const h16 = "[0-9A-Fa-f]{1,4}";
		const ls32 = `(?:(?:${h16}:${h16})|${this.get_ipv4_addr().source})`;
		return this.cache.src_ip6_addr ??= new RegExp(`(?:(?:${h16}:){6}${ls32}|::(?:${h16}:){5}${ls32}|(?:${h16})?::(?:${h16}:){4}${ls32}|(?:(?:${h16}:){0,1}${h16})?::(?:${h16}:){3}${ls32}|(?:(?:${h16}:){0,2}${h16})?::(?:${h16}:){2}${ls32}|(?:(?:${h16}:){0,3}${h16})?::${h16}:${ls32}|(?:(?:${h16}:){0,4}${h16})?::${ls32}|(?:(?:${h16}:){0,5}${h16})?::${h16}|(?:(?:${h16}:){0,6}${h16})?::)`);
	}
	get_ipv6_url_host() {
		return this.cache.src_ip6_host ??= new RegExp(`\\[${this.get_ipv6_addr().source}\\]`);
	}
	get_ipv6_mail_host() {
		return this.cache.src_ipv6_mail_host ??= new RegExp(`\\[IPv6:${this.get_ipv6_addr().source}\\]`);
	}
	get_auth() {
		return this.cache.src_auth ??= new RegExp(`(?:(?:(?!${this.src_ZCc}|[@/\\[\\]()]).){1,50}@)?`);
	}
	get_port() {
		return this.cache.src_port ??= /* @__PURE__ */ new RegExp("(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?");
	}
	get_host_terminator() {
		return this.cache.src_host_terminator ??= new RegExp(`(?=$|${this.get_text_separators().source}|${this.src_ZPCc})(?!${this.opts["---"] ? "-(?!--)|" : "-|"}_|:\\d|\\.-|\\.(?!$|${this.src_ZPCc}))`);
	}
	get_path_terminator() {
		return this.cache.src_path_terminator ??= new RegExp(`${this.src_ZPCc}|${this.get_text_separators().source}`);
	}
	get_path() {
		return this.cache.src_path ??= new RegExp(`(?:[/?#](?:${this.nestedPairRE("[", "]")}|${this.nestedPairRE("(", ")")}|${this.nestedPairRE("{", "}")}|\\"(?:(?!${this.src_ZCc}|["]).){1,100}\\"|\\'(?:(?!${this.src_ZCc}|[']).){1,100}\\'|\\'(?=${this.get_pseudo_letter().source}|[-])|\\.{2,20}[:]?[a-zA-Z0-9%/&]|\\.(?!${this.src_ZCc}|[.]|$)|` + (this.opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-{0,19})|" : "\\-{1,20}|") + `,(?!${this.src_ZCc}|$)|;(?!${this.src_ZCc}|$)|\\!{1,20}(?!${this.src_ZCc}|[!]|$)|\\?(?!${this.src_ZCc}|[?]|$)|` + this.get_path_extra().source + `[\\\\/:%@#&=_~*]|(?!${this.get_path_terminator().source}).){1,${this.opts.maxLength}}|\\/)?`);
	}
	get_mail_name() {
		return this.cache.src_mail_name ??= /* @__PURE__ */ new RegExp("[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9](?:[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9]|[.](?=[-!#$%&'*+/=?^_`{|}~a-zA-Z0-9])){0,63}");
	}
	get_xn() {
		return this.cache.src_xn ??= /* @__PURE__ */ new RegExp("xn--[a-z0-9\\-]{1,59}");
	}
	get_tld() {
		if (this.cache.tld) return this.cache.tld;
		const tlds_src = [...new Set(this.opts.tlds || [])].sort().reverse().join("|");
		this.cache.tld = new RegExp(`${tlds_src || "$#none#$"}|${this.get_xn().source}`);
		return this.cache.tld;
	}
	get_domain_root() {
		return this.cache.src_domain_root ??= new RegExp("(?:" + this.get_xn().source + `|${this.get_pseudo_letter().source}{1,63})`);
	}
	get_domain() {
		return this.cache.src_domain ??= new RegExp("(?:" + this.get_xn().source + `|(?:${this.get_pseudo_letter().source})|(?:${this.get_pseudo_letter().source}(?:-|${this.get_pseudo_letter().source}){0,61}${this.get_pseudo_letter().source}))`);
	}
	get_url_host_port() {
		return this.cache.url_host_port ??= new RegExp("(?:" + this.get_ipv6_url_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,10}${this.get_domain().source}))` + this.get_port().source + this.get_host_terminator().source);
	}
	get_fuzzy_url_host_port() {
		return this.cache.fuzzy_url_host_port ??= new RegExp("(?:" + (this.opts.fuzzyIP ? this.get_ipv4_addr().source + "|" : "") + `(?:(?:(?:${this.get_domain().source})\\.){1,10}(?:${this.get_tld().source})))` + this.get_host_terminator().source);
	}
	get_mail_host() {
		return this.cache.src_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})\\.){0,4}${this.get_domain().source}))` + this.get_host_terminator().source);
	}
	get_fuzzy_mail_host() {
		return this.cache.src_fuzzy_mail_host ??= new RegExp("(?:" + this.get_ipv6_mail_host().source + `|(?:(?:(?:${this.get_domain().source})[.]){1,4}${this.get_domain_root().source}))` + this.get_host_terminator().source);
	}
	get_path_extra() {
		return this.cache.src_path_extra ??= /* @__PURE__ */ new RegExp("");
	}
	get_fuzzy_mail_host_search() {
		return this.cache.mail_fuzzy_host_search ??= new RegExp(`@${this.get_fuzzy_mail_host().source}`, "ig");
	}
	get_fuzzy_link_search() {
		return this.cache.link_fuzzy_search ??= new RegExp(`(^|(?![.:/\\-_@])(?:[$+<=>^\`|\uff5c]|${this.src_ZPCc}))(?:(?![$+<=>^\`|\uff5c])${this.get_fuzzy_url_host_port().source}${this.get_path().source})`, "ig");
	}
	get_http_validator() {
		return this.cache.http_validator ??= new RegExp("\\/\\/" + (this.opts.urlAuth ? this.get_auth().source : "") + this.get_url_host_port().source + this.get_path().source, "iy");
	}
	get_relative_proto_validator() {
		return this.cache.relative_proto_validator ??= new RegExp((this.opts.urlAuth ? this.get_auth().source : "") + `(?:localhost|${this.get_ipv6_url_host().source}|(?:(?:${this.get_domain().source})[.]){1,10}${this.get_domain_root().source})` + this.get_port().source + this.get_host_terminator().source + this.get_path().source, "iy");
	}
	get_mail_name_validator() {
		return this.cache.mail_name_validator ??= new RegExp(`(?:^|${this.get_text_separators().source}|"|\\(|${this.src_ZCc})(${this.get_mail_name().source})$`);
	}
	get_mailto_validator() {
		return this.cache.mailto_validator ??= new RegExp(`${this.get_mail_name().source}@${this.get_mail_host().source}`, "iy");
	}
	get_schema_names() {
		return this.cache.schema_names ??= new RegExp((this.opts.schema_names || []).map((name) => this.escapeRE(name)).join("|"));
	}
	get_schema_search() {
		return this.cache.schema_search ??= new RegExp(`(^|(?!_)(?:[><\uff5c]|${this.src_ZPCc}))(${this.get_schema_names().source})`, "ig");
	}
	get_schema_at_start() {
		return this.cache.schema_at_start ??= new RegExp(`^${this.get_schema_search().source}`, "i");
	}
};
var web_schema = {
	validate: (text, pos, self) => {
		const re = self.re.get_http_validator();
		re.lastIndex = pos;
		const m = re.exec(text);
		return m ? m[0].length : 0;
	},
	normalize: (match, self) => self.normalize(match)
};
var defaultSchemas = {
	"http:": web_schema,
	"https:": web_schema,
	"ftp:": web_schema,
	"//": {
		validate: function(text, pos, self) {
			const re = self.re.get_relative_proto_validator();
			re.lastIndex = pos;
			const m = re.exec(text);
			if (m) {
				if (pos >= 3 && text[pos - 3] === ":") return 0;
				if (pos >= 3 && text[pos - 3] === "/") return 0;
				return m[0].length;
			}
			return 0;
		},
		normalize: (match, self) => self.normalize(match)
	},
	"mailto:": {
		validate: function(text, pos, self) {
			const re = self.re.get_mailto_validator();
			re.lastIndex = pos;
			const m = re.exec(text);
			return m ? m[0].length : 0;
		},
		normalize: (match, self) => self.normalize(match)
	}
};
var tlds_2ch = "a:cdefgilmnoqrstuwxz|b:abdefghijmnorstvwyz|c:acdfghiklmnoruvwxyz|d:ejkmoz|e:cegrstu|f:ijkmor|g:abdefghilmnpqrstuwy|h:kmnrtu|i:delmnoqrst|j:emop|k:eghimnprwyz|l:abcikrstuvy|m:acdeghklmnopqrstuvwxyz|n:acefgilopruz|o:m|p:aefghklmnrstwy|q:a|r:eosuw|s:abcdeghijklmnortuvxyz|t:cdfghjklmnortvwz|u:agksyz|v:aceginu|w:fs|y:et|z:amw";
var tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф";
function unpackTlds() {
	const result = tlds_default.split("|");
	tlds_2ch.split("|").forEach((item) => {
		const sep = item.indexOf(":");
		const prefix = item.slice(0, sep);
		for (const suffix of item.slice(sep + 1)) result.push(prefix + suffix);
	});
	return result;
}
var defaultOptions = {
	fuzzyLink: false,
	fuzzyEmail: true,
	fuzzyIP: false,
	"---": false,
	tlds: unpackTlds(),
	urlAuth: false,
	maxLength: 1e4
};
/**
* Match result returned by {@link LinkifyIt.match} and
* {@link LinkifyIt.matchAtStart}.
*
* @category types
*/
var Match = class {
	/** Prefix (protocol) for matched string. Empty for fuzzy links. */
	schema;
	/** First position of matched string. */
	index;
	/** Next position after matched string. */
	lastIndex;
	/** Matched string. */
	raw;
	/** Normalized text of matched string. */
	text;
	/** Normalized URL of matched string. */
	url;
	constructor(text, schema, index, lastIndex) {
		const raw = text.slice(index, lastIndex);
		this.schema = schema.toLowerCase();
		this.index = index;
		this.lastIndex = lastIndex;
		this.raw = raw;
		this.text = raw;
		this.url = raw;
	}
};
/** Linkifier instance. */
var LinkifyIt = class {
	__opts__;
	__schemas__;
	re;
	/**
	* Creates new linkifier instance.
	*
	* By default understands:
	*
	* - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
	* - "fuzzy" emails (foo@bar.com).
	*
	* See {@link LinkifyConstructorOptions} for available options.
	*
	* @param options Recognition options.
	*
	* @example
	* ```javascript
	* import { LinkifyIt } from 'linkify-it'
	*
	* const linkify = new LinkifyIt({ fuzzyLink: true })
	*
	* linkify
	*   .tlds(require('tlds'))       // Reload with full TLD list
	*   .tlds('onion', true)         // Add unofficial `.onion` domain
	*   .add('ftp:', null)           // Disable `ftp:` protocol
	*   .set({ fuzzyIP: true })      // Enable IPs in fuzzy links
	*
	* console.log(linkify.test('Site github.com!')) // true
	* console.log(linkify.match('Site github.com!'))
	* ```
	*/
	constructor(options = {}) {
		const { rebuilder, ...linkifyOptions } = options;
		this.__opts__ = {
			...defaultOptions,
			...linkifyOptions
		};
		this.__schemas__ = { ...defaultSchemas };
		this.re = rebuilder || new REBuilder();
		this.re.set({
			...this.__opts__,
			schema_names: Object.keys(this.__schemas__)
		});
	}
	/**
	* Add new rule definition.
	*
	* `schema` is a link prefix (usually, protocol name with `:` at the end,
	* `skype:` for example). `linkify-it` makes sure that prefix is not
	* preceded with alphanumeric char and symbols. Only whitespaces and
	* punctuation allowed.
	*
	* `definition` is a rule to check tail after link prefix. To disable an
	* existing rule, pass `null`.
	*
	* @param schema Rule name (fixed pattern prefix).
	* @param definition Schema definition, or `null` to disable the rule.
	*
	* See [twitter mentions example](https://github.com/markdown-it/linkify-it/blob/master/examples/twitter.mjs).
	*/
	add(schema, definition = null) {
		if (!definition) delete this.__schemas__[schema];
		else {
			const def = {
				normalize: (match, self) => self.normalize(match),
				...definition
			};
			this.__schemas__[schema] = def;
		}
		this.re.set({
			...this.__opts__,
			schema_names: Object.keys(this.__schemas__)
		});
		return this;
	}
	/**
	* Set recognition options for links without schema.
	*
	* @param options Recognition options.
	*/
	set(options = {}) {
		this.__opts__ = {
			...this.__opts__,
			...options
		};
		this.re.set({
			...this.__opts__,
			schema_names: Object.keys(this.__schemas__)
		});
		return this;
	}
	/**
	* Searches linkifiable pattern and returns `true` on success or `false` on fail.
	*
	* @param text Text to scan.
	*/
	test(text) {
		if (!text.length) return false;
		let m, re;
		re = this.re.get_schema_search();
		re.lastIndex = 0;
		while ((m = re.exec(text)) !== null) if (this.testSchemaAt(text, m[2], re.lastIndex)) return true;
		if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
			re = this.re.get_fuzzy_link_search();
			re.lastIndex = 0;
			if (re.exec(text) !== null) return true;
		}
		if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
			if (text.indexOf("@") >= 0) {
				const mailHostRe = this.re.get_fuzzy_mail_host_search();
				const mailNameRe = this.re.get_mail_name_validator();
				mailHostRe.lastIndex = 0;
				while ((m = mailHostRe.exec(text)) !== null) {
					const name = text.slice(Math.max(0, m.index - 65), m.index);
					if (mailNameRe.test(name)) return true;
				}
			}
		}
		return false;
	}
	/**
	* Similar to {@link LinkifyIt.test} but checks only specific protocol tail exactly
	* at given position. Returns length of found pattern (0 on fail).
	*
	* @param text Text to scan.
	* @param schema Rule (schema) name.
	* @param pos Text offset to check from.
	*/
	testSchemaAt(text, schema, pos) {
		if (!this.__schemas__[schema.toLowerCase()]) return 0;
		return this.__schemas__[schema.toLowerCase()].validate(text.slice(0, pos + this.__opts__.maxLength), pos, this);
	}
	/**
	* Returns array of found link descriptions or `null` on fail. We strongly
	* recommend to use {@link LinkifyIt.test} first, for best speed.
	*
	* @param text Text to scan.
	*/
	match(text) {
		const result = [];
		const schemaRe = this.re.get_schema_search();
		let fuzzyLinkRe;
		let mailHostRe;
		let mailNameRe;
		let fuzzyLinkCandidate;
		let fuzzyEmailCandidate;
		let schemaPrefix;
		let schemaDone = false;
		let fuzzyLinkDone = false;
		let fuzzyEmailDone = false;
		let pos = 0;
		if (!text.length) return null;
		schemaRe.lastIndex = 0;
		if (this.__opts__.fuzzyLink && this.__schemas__["http:"]) {
			fuzzyLinkRe = this.re.get_fuzzy_link_search();
			fuzzyLinkRe.lastIndex = 0;
		}
		if (this.__opts__.fuzzyEmail && this.__schemas__["mailto:"]) {
			mailHostRe = this.re.get_fuzzy_mail_host_search();
			mailHostRe.lastIndex = 0;
			mailNameRe = this.re.get_mail_name_validator();
		}
		for (;;) {
			const scanFrom = Math.max(pos - 1, 0);
			if (mailHostRe && mailNameRe && !fuzzyEmailDone && (!fuzzyEmailCandidate || fuzzyEmailCandidate.index < pos)) {
				if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
				for (;;) {
					const m = mailHostRe.exec(text);
					if (!m) {
						fuzzyEmailDone = true;
						fuzzyEmailCandidate = void 0;
						break;
					}
					const name = mailNameRe.exec(text.slice(Math.max(0, m.index - 65), m.index));
					if (!name) continue;
					fuzzyEmailCandidate = {
						schema: "mailto:",
						index: m.index - name[1].length,
						lastIndex: m.index + m[0].length
					};
					if (fuzzyEmailCandidate.index >= pos) break;
					if (mailHostRe.lastIndex < scanFrom) mailHostRe.lastIndex = scanFrom;
				}
			}
			if (fuzzyLinkRe && !fuzzyLinkDone && (!fuzzyLinkCandidate || fuzzyLinkCandidate.index < pos)) {
				if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
				for (;;) {
					const m = fuzzyLinkRe.exec(text);
					if (!m) {
						fuzzyLinkDone = true;
						fuzzyLinkCandidate = void 0;
						break;
					}
					fuzzyLinkCandidate = {
						schema: "",
						index: m.index + m[1].length,
						lastIndex: m.index + m[0].length
					};
					if (fuzzyLinkCandidate.index >= pos) break;
					if (fuzzyLinkRe.lastIndex < scanFrom) fuzzyLinkRe.lastIndex = scanFrom;
				}
			}
			let fuzzyCandidate = fuzzyEmailCandidate;
			if (!fuzzyCandidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < fuzzyCandidate.index || fuzzyLinkCandidate.index === fuzzyCandidate.index && fuzzyLinkCandidate.lastIndex > fuzzyCandidate.lastIndex)) fuzzyCandidate = fuzzyLinkCandidate;
			let schemaCandidate;
			if (!schemaDone) for (;;) {
				if (!schemaPrefix) {
					if (schemaRe.lastIndex < scanFrom) schemaRe.lastIndex = scanFrom;
					const m = schemaRe.exec(text);
					if (!m) {
						schemaDone = true;
						break;
					}
					schemaPrefix = {
						schema: m[2],
						index: m.index + m[1].length,
						lastIndex: m.index + m[0].length
					};
				}
				if (schemaPrefix.index < pos) {
					schemaPrefix = void 0;
					continue;
				}
				if (fuzzyCandidate && schemaPrefix.index > fuzzyCandidate.index) break;
				const prefix = schemaPrefix;
				schemaPrefix = void 0;
				const len = this.testSchemaAt(text, prefix.schema, prefix.lastIndex);
				if (len) {
					schemaCandidate = {
						schema: prefix.schema,
						index: prefix.index,
						lastIndex: prefix.lastIndex + len
					};
					break;
				}
			}
			let candidate = schemaCandidate;
			if (!candidate || fuzzyEmailCandidate && (fuzzyEmailCandidate.index < candidate.index || fuzzyEmailCandidate.index === candidate.index && fuzzyEmailCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyEmailCandidate;
			if (!candidate || fuzzyLinkCandidate && (fuzzyLinkCandidate.index < candidate.index || fuzzyLinkCandidate.index === candidate.index && fuzzyLinkCandidate.lastIndex > candidate.lastIndex)) candidate = fuzzyLinkCandidate;
			if (!candidate) break;
			if (candidate === fuzzyEmailCandidate) fuzzyEmailCandidate = void 0;
			else if (candidate === fuzzyLinkCandidate) fuzzyLinkCandidate = void 0;
			const match = new Match(text, candidate.schema, candidate.index, candidate.lastIndex);
			if (match.schema) this.__schemas__[match.schema].normalize(match, this);
			else this.normalize(match);
			result.push(match);
			pos = candidate.lastIndex;
		}
		if (result.length) return result;
		return null;
	}
	/**
	* Returns fully-formed (not fuzzy) link if it starts at the beginning
	* of the string, and null otherwise.
	*
	* @param text Text to scan.
	*/
	matchAtStart(text) {
		if (!text.length) return null;
		const m = this.re.get_schema_at_start().exec(text);
		if (!m) return null;
		const len = this.testSchemaAt(text, m[2], m[0].length);
		if (!len) return null;
		const match = new Match(text, m[2], m.index + m[1].length, m.index + m[0].length + len);
		this.__schemas__[match.schema].normalize(match, this);
		return match;
	}
	/**
	* Load (or merge) new TLDs list. Those are used for fuzzy links (without
	* prefix) to avoid false positives. By default this algorithm is used:
	*
	* - hostname with any 2-letter root zones are ok.
	* - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
	*   are ok.
	* - encoded (`xn--...`) root zones are ok.
	*
	* If list is replaced, then exact match for 2-chars root zones will be checked.
	*
	* @param list List of TLDs.
	* @param keepOld Merge with current list if `true` (`false` by default).
	*/
	tlds(list, keepOld = false) {
		list = Array.isArray(list) ? list : [list];
		if (!keepOld) this.__opts__.tlds = list;
		else this.__opts__.tlds = this.__opts__.tlds.concat(list);
		this.re.set({
			...this.__opts__,
			schema_names: Object.keys(this.__schemas__)
		});
		return this;
	}
	/**
	* Default normalizer (if schema does not define its own).
	*
	* @param match Match to normalize.
	*/
	normalize(match) {
		if (!match.schema) match.url = `http://${match.url}`;
		if (match.schema === "mailto:" && !/^mailto:/i.test(match.url)) match.url = `mailto:${match.url}`;
	}
};
//#endregion
//#region node_modules/.pnpm/markdown-it@15.0.3/node_modules/markdown-it/dist/markdown-it.mjs
/*! markdown-it 15.0.3 https://github.com/markdown-it/markdown-it @license MIT */
var import_punycode = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	/** Highest positive signed 32-bit float value */
	const maxInt = 2147483647;
	/** Bootstring parameters */
	const base = 36;
	const tMin = 1;
	const tMax = 26;
	const skew = 38;
	const damp = 700;
	const initialBias = 72;
	const initialN = 128;
	const delimiter = "-";
	/** Regular expressions */
	const regexPunycode = /^xn--/;
	const regexNonASCII = /[^\0-\x7F]/;
	const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
	/** Error messages */
	const errors = {
		"overflow": "Overflow: input needs wider integers to process",
		"not-basic": "Illegal input >= 0x80 (not a basic code point)",
		"invalid-input": "Invalid input"
	};
	/** Convenience shortcuts */
	const baseMinusTMin = base - tMin;
	const floor = Math.floor;
	const stringFromCharCode = String.fromCharCode;
	/**
	* A generic error utility function.
	* @private
	* @param {String} type The error type.
	* @returns {Error} Throws a `RangeError` with the applicable error message.
	*/
	function error(type) {
		throw new RangeError(errors[type]);
	}
	/**
	* A generic `Array#map` utility function.
	* @private
	* @param {Array} array The array to iterate over.
	* @param {Function} callback The function that gets called for every array
	* item.
	* @returns {Array} A new array of values returned by the callback function.
	*/
	function map(array, callback) {
		const result = [];
		let length = array.length;
		while (length--) result[length] = callback(array[length]);
		return result;
	}
	/**
	* A simple `Array#map`-like wrapper to work with domain name strings or email
	* addresses.
	* @private
	* @param {String} domain The domain name or email address.
	* @param {Function} callback The function that gets called for every
	* character.
	* @returns {String} A new string of characters returned by the callback
	* function.
	*/
	function mapDomain(domain, callback) {
		const parts = domain.split("@");
		let result = "";
		if (parts.length > 1) {
			result = parts[0] + "@";
			domain = parts[1];
		}
		domain = domain.replace(regexSeparators, ".");
		const encoded = map(domain.split("."), callback).join(".");
		return result + encoded;
	}
	/**
	* Creates an array containing the numeric code points of each Unicode
	* character in the string. While JavaScript uses UCS-2 internally,
	* this function will convert a pair of surrogate halves (each of which
	* UCS-2 exposes as separate characters) into a single code point,
	* matching UTF-16.
	* @see `punycode.ucs2.encode`
	* @see <https://mathiasbynens.be/notes/javascript-encoding>
	* @memberOf punycode.ucs2
	* @name decode
	* @param {String} string The Unicode input string (UCS-2).
	* @returns {Array} The new array of code points.
	*/
	function ucs2decode(string) {
		const output = [];
		let counter = 0;
		const length = string.length;
		while (counter < length) {
			const value = string.charCodeAt(counter++);
			if (value >= 55296 && value <= 56319 && counter < length) {
				const extra = string.charCodeAt(counter++);
				if ((extra & 64512) == 56320) output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
				else {
					output.push(value);
					counter--;
				}
			} else output.push(value);
		}
		return output;
	}
	/**
	* Creates a string based on an array of numeric code points.
	* @see `punycode.ucs2.decode`
	* @memberOf punycode.ucs2
	* @name encode
	* @param {Array} codePoints The array of numeric code points.
	* @returns {String} The new Unicode string (UCS-2).
	*/
	const ucs2encode = (codePoints) => String.fromCodePoint(...codePoints);
	/**
	* Converts a basic code point into a digit/integer.
	* @see `digitToBasic()`
	* @private
	* @param {Number} codePoint The basic numeric code point value.
	* @returns {Number} The numeric value of a basic code point (for use in
	* representing integers) in the range `0` to `base - 1`, or `base` if
	* the code point does not represent a value.
	*/
	const basicToDigit = function(codePoint) {
		if (codePoint >= 48 && codePoint < 58) return 26 + (codePoint - 48);
		if (codePoint >= 65 && codePoint < 91) return codePoint - 65;
		if (codePoint >= 97 && codePoint < 123) return codePoint - 97;
		return base;
	};
	/**
	* Converts a digit/integer into a basic code point.
	* @see `basicToDigit()`
	* @private
	* @param {Number} digit The numeric value of a basic code point.
	* @returns {Number} The basic code point whose value (when used for
	* representing integers) is `digit`, which needs to be in the range
	* `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	* used; else, the lowercase form is used. The behavior is undefined
	* if `flag` is non-zero and `digit` has no uppercase form.
	*/
	const digitToBasic = function(digit, flag) {
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	};
	/**
	* Bias adaptation function as per section 3.4 of RFC 3492.
	* https://tools.ietf.org/html/rfc3492#section-3.4
	* @private
	*/
	const adapt = function(delta, numPoints, firstTime) {
		let k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (; delta > 455; k += base) delta = floor(delta / baseMinusTMin);
		return floor(k + 36 * delta / (delta + skew));
	};
	/**
	* Converts a Punycode string of ASCII-only symbols to a string of Unicode
	* symbols.
	* @memberOf punycode
	* @param {String} input The Punycode string of ASCII-only symbols.
	* @returns {String} The resulting string of Unicode symbols.
	*/
	const decode = function(input) {
		const output = [];
		const inputLength = input.length;
		let i = 0;
		let n = initialN;
		let bias = initialBias;
		let basic = input.lastIndexOf(delimiter);
		if (basic < 0) basic = 0;
		for (let j = 0; j < basic; ++j) {
			if (input.charCodeAt(j) >= 128) error("not-basic");
			output.push(input.charCodeAt(j));
		}
		for (let index = basic > 0 ? basic + 1 : 0; index < inputLength;) {
			const oldi = i;
			for (let w = 1, k = base;; k += base) {
				if (index >= inputLength) error("invalid-input");
				const digit = basicToDigit(input.charCodeAt(index++));
				if (digit >= base) error("invalid-input");
				if (digit > floor((maxInt - i) / w)) error("overflow");
				i += digit * w;
				const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
				if (digit < t) break;
				const baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) error("overflow");
				w *= baseMinusT;
			}
			const out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);
			if (floor(i / out) > maxInt - n) error("overflow");
			n += floor(i / out);
			i %= out;
			output.splice(i++, 0, n);
		}
		return String.fromCodePoint(...output);
	};
	/**
	* Converts a string of Unicode symbols (e.g. a domain name label) to a
	* Punycode string of ASCII-only symbols.
	* @memberOf punycode
	* @param {String} input The string of Unicode symbols.
	* @returns {String} The resulting Punycode string of ASCII-only symbols.
	*/
	const encode = function(input) {
		const output = [];
		input = ucs2decode(input);
		const inputLength = input.length;
		let n = initialN;
		let delta = 0;
		let bias = initialBias;
		for (const currentValue of input) if (currentValue < 128) output.push(stringFromCharCode(currentValue));
		const basicLength = output.length;
		let handledCPCount = basicLength;
		if (basicLength) output.push(delimiter);
		while (handledCPCount < inputLength) {
			let m = maxInt;
			for (const currentValue of input) if (currentValue >= n && currentValue < m) m = currentValue;
			const handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) error("overflow");
			delta += (m - n) * handledCPCountPlusOne;
			n = m;
			for (const currentValue of input) {
				if (currentValue < n && ++delta > maxInt) error("overflow");
				if (currentValue === n) {
					let q = delta;
					for (let k = base;; k += base) {
						const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
						if (q < t) break;
						const qMinusT = q - t;
						const baseMinusT = base - t;
						output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
						q = floor(qMinusT / baseMinusT);
					}
					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount === basicLength);
					delta = 0;
					++handledCPCount;
				}
			}
			++delta;
			++n;
		}
		return output.join("");
	};
	/**
	* Converts a Punycode string representing a domain name or an email address
	* to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	* it doesn't matter if you call it on a string that has already been
	* converted to Unicode.
	* @memberOf punycode
	* @param {String} input The Punycoded domain name or email address to
	* convert to Unicode.
	* @returns {String} The Unicode representation of the given Punycode
	* string.
	*/
	const toUnicode = function(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
		});
	};
	/**
	* Converts a Unicode string representing a domain name or an email address to
	* Punycode. Only the non-ASCII parts of the domain name will be converted,
	* i.e. it doesn't matter if you call it with a domain that's already in
	* ASCII.
	* @memberOf punycode
	* @param {String} input The domain name or email address to convert, as a
	* Unicode string.
	* @returns {String} The Punycode representation of the given domain name or
	* email address.
	*/
	const toASCII = function(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
		});
	};
	module.exports = {
		/**
		* A string representing the current Punycode.js version number.
		* @memberOf punycode
		* @type String
		*/
		"version": "2.3.1",
		/**
		* An object of methods to convert from JavaScript's internal character
		* representation (UCS-2) to Unicode code points, and back.
		* @see <https://mathiasbynens.be/notes/javascript-encoding>
		* @memberOf punycode
		* @type Object
		*/
		"ucs2": {
			"decode": ucs2decode,
			"encode": ucs2encode
		},
		"decode": decode,
		"encode": encode,
		"toASCII": toASCII,
		"toUnicode": toUnicode
	};
})))(), 1);
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
/**
* Common utility functions exposed through `md.utils` for use by plugins.
*
* @module md.utils
*/
var utils_exports = /* @__PURE__ */ __exportAll({
	arrayReplaceAt: () => arrayReplaceAt,
	asciiTrim: () => asciiTrim,
	callable: () => callable,
	escapeHtml: () => escapeHtml$1,
	escapeRE: () => escapeRE,
	fromCodePoint: () => fromCodePoint,
	isMdAsciiPunct: () => isMdAsciiPunct,
	isPunctChar: () => isPunctChar,
	isPunctCharCode: () => isPunctCharCode,
	isSpace: () => isSpace,
	isValidEntityCode: () => isValidEntityCode,
	isWhiteSpace: () => isWhiteSpace,
	lib: () => lib,
	normalizeReference: () => normalizeReference,
	unescapeAll: () => unescapeAll,
	unescapeMd: () => unescapeMd
});
function callable(cls) {
	const wrapper = function(...args) {
		return Reflect.construct(cls, args, new.target && new.target !== wrapper ? new.target : cls);
	};
	Object.defineProperty(wrapper, "name", { value: cls.name });
	Object.setPrototypeOf(wrapper, cls);
	wrapper.prototype = cls.prototype;
	return wrapper;
}
/**
* Returns a copy of a token array with the token at `pos` replaced by
* `newElements`. Used to transform token streams without modifying the
* original array.
*/
function arrayReplaceAt(src, pos, newElements) {
	return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}
/** Checks whether a code point can be decoded from a numeric HTML entity. */
function isValidEntityCode(c) {
	if (c >= 55296 && c <= 57343) return false;
	if (c >= 64976 && c <= 65007) return false;
	if ((c & 65535) === 65535 || (c & 65535) === 65534) return false;
	if (c >= 0 && c <= 8) return false;
	if (c === 11) return false;
	if (c >= 14 && c <= 31) return false;
	if (c >= 127 && c <= 159) return false;
	if (c > 1114111) return false;
	return true;
}
/**
* Converts a Unicode code point to a string, like `String.fromCodePoint()`,
* but does not throw for invalid input.
*/
function fromCodePoint(c) {
	if (c > 65535) {
		c -= 65536;
		const surrogate1 = 55296 + (c >> 10);
		const surrogate2 = 56320 + (c & 1023);
		return String.fromCharCode(surrogate1, surrogate2);
	}
	return String.fromCharCode(c);
}
var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
var UNESCAPE_ALL_RE = new RegExp(`${UNESCAPE_MD_RE.source}|${/&([a-z#][a-z0-9]{1,31});/gi.source}`, "gi");
var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
function replaceEntityPattern(match, name) {
	if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
		const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
		if (isValidEntityCode(code)) return fromCodePoint(code);
		return match;
	}
	const decoded = decodeHTMLStrict(match);
	if (decoded !== match) return decoded;
	return match;
}
/** Decodes Markdown backslash escapes. */
function unescapeMd(str) {
	if (str.indexOf("\\") < 0) return str;
	return str.replace(UNESCAPE_MD_RE, "$1");
}
/**
* Decodes Markdown backslash escapes and HTML character references in link
* destinations, link titles, and fenced code info strings.
*/
function unescapeAll(str) {
	if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) return str;
	return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity) {
		if (escaped) return escaped;
		return replaceEntityPattern(match, entity);
	});
}
var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;"
};
function replaceUnsafeChar(ch) {
	return HTML_REPLACEMENTS[ch];
}
/** Escapes HTML special characters in a string. */
function escapeHtml$1(str) {
	if (HTML_ESCAPE_TEST_RE.test(str)) return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
	return str;
}
var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
/** Escapes regular expression metacharacters in a string. */
function escapeRE(str) {
	return str.replace(REGEXP_ESCAPE_RE, "\\$&");
}
/** Checks whether a character code is an ASCII space or tab. */
function isSpace(code) {
	switch (code) {
		case 9:
		case 32: return true;
	}
	return false;
}
/**
* Checks whether a character code is whitespace recognized by Markdown.
*
* Matches the Unicode `Zs` category or `\t`, `\f`, `\v`, `\r`, `\n`.
*/
function isWhiteSpace(code) {
	if (code >= 8192 && code <= 8202) return true;
	switch (code) {
		case 9:
		case 10:
		case 11:
		case 12:
		case 13:
		case 32:
		case 160:
		case 5760:
		case 8239:
		case 8287:
		case 12288: return true;
	}
	return false;
}
/**
* Checks whether a character is Unicode punctuation or a symbol.
*
* Does not support astral characters.
*/
function isPunctChar(ch) {
	return P.test(ch) || S.test(ch);
}
/** Checks whether a Unicode code point is punctuation or a symbol. */
function isPunctCharCode(code) {
	return isPunctChar(fromCodePoint(code));
}
/**
* Markdown ASCII punctuation characters.
*
*     !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @,
*     [, \, ], ^, _, `, {, |, }, or ~
*
* http://spec.commonmark.org/0.15/#ascii-punctuation-character
*
* Don't confuse with Unicode punctuation. It lacks some characters in the
* ASCII range.
*/
function isMdAsciiPunct(ch) {
	switch (ch) {
		case 33:
		case 34:
		case 35:
		case 36:
		case 37:
		case 38:
		case 39:
		case 40:
		case 41:
		case 42:
		case 43:
		case 44:
		case 45:
		case 46:
		case 47:
		case 58:
		case 59:
		case 60:
		case 61:
		case 62:
		case 63:
		case 64:
		case 91:
		case 92:
		case 93:
		case 94:
		case 95:
		case 96:
		case 123:
		case 124:
		case 125:
		case 126: return true;
		default: return false;
	}
}
/** Normalizes `[reference labels]` for case-insensitive lookup. */
function normalizeReference(str) {
	str = str.trim().replace(/\s+/g, " ");
	return str.toLowerCase().toUpperCase();
}
function isAsciiTrimmable(c) {
	return c === 32 || c === 9 || c === 10 || c === 13;
}
/**
* "Light" `.trim()` for blocks (headings, paragraphs), where Unicode spaces
* should be preserved.
*/
function asciiTrim(str) {
	let start = 0;
	for (; start < str.length; start++) if (!isAsciiTrimmable(str.charCodeAt(start))) break;
	let end = str.length - 1;
	for (; end >= start; end--) if (!isAsciiTrimmable(str.charCodeAt(end))) break;
	return str.slice(start, end + 1);
}
/**
* Libraries commonly used by markdown-it and its plugins, re-exported to
* reduce duplicate dependencies in browser bundles.
*/
var lib = {
	mdurl: mdurl_exports,
	ucmicro: build_exports
};
/** Finds the end of a link or image label (`[label]`). */
function parseLinkLabel(state, start, disableNested) {
	let level, found, marker, prevPos;
	const max = state.posMax;
	const oldPos = state.pos;
	state.pos = start + 1;
	level = 1;
	while (state.pos < max) {
		marker = state.src.charCodeAt(state.pos);
		if (marker === 93) {
			level--;
			if (level === 0) {
				found = true;
				break;
			}
		}
		prevPos = state.pos;
		state.md.inline.skipToken(state);
		if (marker === 91) {
			if (prevPos === state.pos - 1) level++;
			else if (disableNested) {
				state.pos = oldPos;
				return -1;
			}
		}
	}
	let labelEnd = -1;
	if (found) labelEnd = state.pos;
	state.pos = oldPos;
	return labelEnd;
}
/** Parses the destination in `[label](destination "title")`. */
function parseLinkDestination(str, start, max) {
	let code;
	let pos = start;
	const result = {
		ok: false,
		pos: 0,
		str: ""
	};
	if (str.charCodeAt(pos) === 60) {
		pos++;
		while (pos < max) {
			code = str.charCodeAt(pos);
			if (code === 10) return result;
			if (code === 60) return result;
			if (code === 62) {
				result.pos = pos + 1;
				result.str = unescapeAll(str.slice(start + 1, pos));
				result.ok = true;
				return result;
			}
			if (code === 92 && pos + 1 < max) {
				pos += 2;
				continue;
			}
			pos++;
		}
		return result;
	}
	let level = 0;
	while (pos < max) {
		code = str.charCodeAt(pos);
		if (code === 32) break;
		if (code < 32 || code === 127) break;
		if (code === 92 && pos + 1 < max) {
			if (str.charCodeAt(pos + 1) === 32) {
				pos++;
				continue;
			}
			pos += 2;
			continue;
		}
		if (code === 40) {
			level++;
			if (level > 32) return result;
		}
		if (code === 41) {
			if (level === 0) break;
			level--;
		}
		pos++;
	}
	if (start === pos) return result;
	if (level !== 0) return result;
	result.str = unescapeAll(str.slice(start, pos));
	result.pos = pos;
	result.ok = true;
	return result;
}
/**
* Parses the optional title in `[label](destination "title")` or
* `[label]: destination "title"`.
*
* `prev_state` continues a reference title on the next source line.
*/
function parseLinkTitle(str, start, max, prev_state) {
	let code;
	let pos = start;
	const state = {
		ok: false,
		can_continue: false,
		pos: 0,
		str: "",
		marker: 0
	};
	if (prev_state) {
		state.str = prev_state.str;
		state.marker = prev_state.marker;
	} else {
		if (pos >= max) return state;
		let marker = str.charCodeAt(pos);
		if (marker !== 34 && marker !== 39 && marker !== 40) return state;
		start++;
		pos++;
		if (marker === 40) marker = 41;
		state.marker = marker;
	}
	while (pos < max) {
		code = str.charCodeAt(pos);
		if (code === state.marker) {
			state.pos = pos + 1;
			state.str += unescapeAll(str.slice(start, pos));
			state.ok = true;
			return state;
		} else if (code === 40 && state.marker === 41) return state;
		else if (code === 92 && pos + 1 < max) pos++;
		pos++;
	}
	state.can_continue = true;
	state.str += unescapeAll(str.slice(start, pos));
	return state;
}
/**
* Functions used to parse links and images, split out of parser rules because
* of their size.
*
* @module md.helpers
*/
var helpers_exports = /* @__PURE__ */ __exportAll({
	parseLinkDestination: () => parseLinkDestination,
	parseLinkLabel: () => parseLinkLabel,
	parseLinkTitle: () => parseLinkTitle
});
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}
/**
* Represents one item in the parsed token stream, storing parsed data and
* providing helpers for managing HTML attributes.
*/
var Token = class {
	constructor(type, tag, nesting) {
		_defineProperty(
			this,
			/**
			* Source map info. Format: `[ line_begin, line_end ]`
			*/
			"map",
			null
		);
		_defineProperty(
			this,
			/**
			* nesting level, the same as `state.level`
			*/
			"level",
			0
		);
		_defineProperty(
			this,
			/**
			* An array of child nodes (inline and img tokens)
			*/
			"children",
			null
		);
		_defineProperty(
			this,
			/**
			* In a case of self-closing tag (code, html, fence, etc.),
			* it has contents of this tag.
			*/
			"content",
			""
		);
		_defineProperty(
			this,
			/**
			* '*' or '_' for emphasis, fence string for fence, etc.
			*/
			"markup",
			""
		);
		_defineProperty(
			this,
			/**
			* Additional information:
			*
			* - Info string for "fence" tokens
			* - The value "auto" for autolink "link_open" and "link_close" tokens
			* - The string value of the item marker for ordered-list "list_item_open" tokens
			*/
			"info",
			""
		);
		_defineProperty(
			this,
			/**
			* True for block-level tokens, false for inline tokens.
			* Used in renderer to calculate line breaks
			*/
			"block",
			false
		);
		_defineProperty(
			this,
			/**
			* If it's true, ignore this element when rendering. Used for tight lists
			* to hide paragraphs.
			*/
			"hidden",
			false
		);
		this.type = type;
		this.tag = tag;
		this.attrs = null;
		this.nesting = nesting;
		this.meta = null;
	}
	/**
	* Search attribute index by name.
	*/
	attrIndex(name) {
		if (!this.attrs) return -1;
		const attrs = this.attrs;
		for (let i = 0, len = attrs.length; i < len; i++) if (attrs[i][0] === name) return i;
		return -1;
	}
	/**
	* Add `[ name, value ]` attribute to list. Init attrs if necessary
	*/
	attrPush(attrData) {
		if (this.attrs) this.attrs.push(attrData);
		else this.attrs = [attrData];
	}
	/**
	* Set `name` attribute to `value`. Override old value if exists.
	*/
	attrSet(name, value) {
		const idx = this.attrIndex(name);
		const attrData = [name, value];
		if (idx < 0) this.attrPush(attrData);
		else this.attrs[idx] = attrData;
	}
	/**
	* Get the value of attribute `name`, or null if it does not exist.
	*/
	attrGet(name) {
		const idx = this.attrIndex(name);
		let value = null;
		if (idx >= 0) value = this.attrs[idx][1];
		return value;
	}
	/**
	* Join value to existing attribute via space. Or create new attribute if not
	* exists. Useful to operate with token classes.
	*/
	attrJoin(name, value) {
		const idx = this.attrIndex(name);
		if (idx < 0) this.attrPush([name, value]);
		else this.attrs[idx][1] = `${this.attrs[idx][1]} ${value}`;
	}
};
/**
* Helper class, used by {@link MarkdownIt.core}, {@link MarkdownIt.block} and
* {@link MarkdownIt.inline} to manage sequences of functions (rules):
*
* - keep rules in defined order
* - assign the name to each rule
* - enable/disable rules
* - add/replace rules
* - allow assign rules to additional named chains (in the same)
* - cacheing lists of active rules
*
* You will not need use this class directly until write plugins. For simple
* rules control use {@link MarkdownIt.disable}, {@link MarkdownIt.enable} and
* {@link MarkdownIt.use}.
*/
var Ruler = class {
	constructor() {
		_defineProperty(
			this,
			/** @internal */
			"__rules__",
			[]
		);
		_defineProperty(
			this,
			/** @internal */
			"__cache__",
			null
		);
	}
	/** @internal */
	__find__(name) {
		for (let i = 0; i < this.__rules__.length; i++) if (this.__rules__[i].name === name) return i;
		return -1;
	}
	/** @internal */
	__compile__() {
		const chains = /* @__PURE__ */ new Set();
		this.__rules__.forEach((rule) => {
			if (!rule.enabled) return;
			rule.alt.forEach((altName) => {
				if (altName) chains.add(altName);
			});
		});
		this.__cache__ = Object.create(null);
		this.__cache__[""] = [];
		this.__rules__.forEach((rule) => {
			if (rule.enabled) this.__cache__[""].push(rule.fn);
		});
		chains.forEach((chain) => {
			this.__cache__[chain] = [];
			this.__rules__.forEach((rule) => {
				if (rule.enabled && rule.alt.indexOf(chain) >= 0) this.__cache__[chain].push(rule.fn);
			});
		});
	}
	/**
	* Replace rule by name with new function & options. Throws error if name not
	* found.
	*
	* @example Replace existing typographer replacement rule with new one
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	* const md = new MarkdownIt()
	*
	* md.core.ruler.at('replacements', function replace(state) {
	*   //...
	* });
	* ```
	*/
	at(name, fn, options = {}) {
		const index = this.__find__(name);
		if (index === -1) throw new Error(`Parser rule not found: ${name}`);
		this.__rules__[index].fn = fn;
		this.__rules__[index].alt = options.alt || [];
		this.__cache__ = null;
	}
	/**
	* Add new rule to chain before one with given name. See also
	* {@link Ruler.after}, {@link Ruler.push}.
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	* const md = new MarkdownIt()
	*
	* md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
	*   //...
	* });
	* ```
	*/
	before(beforeName, ruleName, fn, options = {}) {
		const index = this.__find__(beforeName);
		if (index === -1) throw new Error(`Parser rule not found: ${beforeName}`);
		this.__rules__.splice(index, 0, {
			name: ruleName,
			enabled: true,
			fn,
			alt: options.alt || []
		});
		this.__cache__ = null;
	}
	/**
	* Add new rule to chain after one with given name. See also
	* {@link Ruler.before}, {@link Ruler.push}.
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	* const md = new MarkdownIt()
	*
	* md.inline.ruler.after('text', 'my_rule', function replace(state) {
	*   //...
	* });
	* ```
	*/
	after(afterName, ruleName, fn, options = {}) {
		const index = this.__find__(afterName);
		if (index === -1) throw new Error(`Parser rule not found: ${afterName}`);
		this.__rules__.splice(index + 1, 0, {
			name: ruleName,
			enabled: true,
			fn,
			alt: options.alt || []
		});
		this.__cache__ = null;
	}
	/**
	* Push new rule to the end of chain. See also
	* {@link Ruler.before}, {@link Ruler.after}.
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	* const md = new MarkdownIt()
	*
	* md.core.ruler.push('my_rule', function replace(state) {
	*   //...
	* });
	* ```
	*/
	push(ruleName, fn, options = {}) {
		this.__rules__.push({
			name: ruleName,
			enabled: true,
			fn,
			alt: options.alt || []
		});
		this.__cache__ = null;
	}
	/**
	* Enable rules with given names. If any rule name not found - throw Error.
	* Errors can be disabled by second param.
	*
	* See also {@link Ruler.disable}, {@link Ruler.enableOnly}.
	*
	* Returns list of found rule names (if no exception happened).
	*/
	enable(list, ignoreInvalid = false) {
		if (!Array.isArray(list)) list = [list];
		const result = [];
		list.forEach((name) => {
			const idx = this.__find__(name);
			if (idx < 0) {
				if (ignoreInvalid) return;
				throw new Error(`Rules manager: invalid rule name ${name}`);
			}
			this.__rules__[idx].enabled = true;
			result.push(name);
		});
		this.__cache__ = null;
		return result;
	}
	/**
	* Enable rules with given names, and disable everything else. If any rule name
	* not found - throw Error. Errors can be disabled by second param.
	*
	* See also {@link Ruler.disable}, {@link Ruler.enable}.
	*/
	enableOnly(list, ignoreInvalid = false) {
		if (!Array.isArray(list)) list = [list];
		this.__rules__.forEach((rule) => {
			rule.enabled = false;
		});
		this.enable(list, ignoreInvalid);
	}
	/**
	* Disable rules with given names. If any rule name not found - throw Error.
	* Errors can be disabled by second param.
	*
	* See also {@link Ruler.enable}, {@link Ruler.enableOnly}.
	*
	* Returns list of found rule names (if no exception happened).
	*/
	disable(list, ignoreInvalid = false) {
		if (!Array.isArray(list)) list = [list];
		const result = [];
		list.forEach((name) => {
			const idx = this.__find__(name);
			if (idx < 0) {
				if (ignoreInvalid) return;
				throw new Error(`Rules manager: invalid rule name ${name}`);
			}
			this.__rules__[idx].enabled = false;
			result.push(name);
		});
		this.__cache__ = null;
		return result;
	}
	/**
	* Return array of active functions (rules) for given chain name. It analyzes
	* rules configuration, compiles caches if not exists and returns result.
	*
	* Default chain name is `''` (empty string). It can't be skipped. That's
	* done intentionally, to keep signature monomorphic for high speed.
	*/
	getRules(chainName) {
		if (!this.__cache__) this.__compile__();
		return this.__cache__[chainName] || [];
	}
};
var default_rules = {};
default_rules.code_inline = function(tokens, idx, options, env, slf) {
	const token = tokens[idx];
	return `<code${slf.renderAttrs(token)}>${escapeHtml$1(token.content)}</code>`;
};
default_rules.code_block = function(tokens, idx, options, env, slf) {
	const token = tokens[idx];
	return `<pre${slf.renderAttrs(token)}><code>${escapeHtml$1(tokens[idx].content)}</code></pre>\n`;
};
default_rules.fence = function(tokens, idx, options, env, slf) {
	const token = tokens[idx];
	const info = token.info ? unescapeAll(token.info).trim() : "";
	let langName = "";
	let langAttrs = "";
	if (info) {
		const arr = info.split(/(\s+)/g);
		langName = arr[0];
		langAttrs = arr.slice(2).join("");
	}
	let highlighted;
	if (options.highlight) highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml$1(token.content);
	else highlighted = escapeHtml$1(token.content);
	if (highlighted.indexOf("<pre") === 0) return highlighted + "\n";
	if (info) {
		const i = token.attrIndex("class");
		const tmpAttrs = token.attrs ? token.attrs.slice() : [];
		if (i < 0) tmpAttrs.push(["class", `${options.langPrefix}${langName}`]);
		else {
			tmpAttrs[i] = [tmpAttrs[i][0], tmpAttrs[i][1]];
			tmpAttrs[i][1] += ` ${options.langPrefix}${langName}`;
		}
		const tmpToken = { attrs: tmpAttrs };
		return `<pre><code${slf.renderAttrs(tmpToken)}>${highlighted}</code></pre>\n`;
	}
	return `<pre><code${slf.renderAttrs(token)}>${highlighted}</code></pre>\n`;
};
default_rules.image = function(tokens, idx, options, env, slf) {
	const token = tokens[idx];
	token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
	return slf.renderToken(tokens, idx, options);
};
default_rules.hardbreak = function(tokens, idx, options) {
	return options.xhtmlOut ? "<br />\n" : "<br>\n";
};
default_rules.softbreak = function(tokens, idx, options) {
	return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
};
default_rules.text = function(tokens, idx) {
	return escapeHtml$1(tokens[idx].content);
};
default_rules.html_block = function(tokens, idx) {
	return tokens[idx].content;
};
default_rules.html_inline = function(tokens, idx) {
	return tokens[idx].content;
};
/**
* Generates HTML from parsed token stream. Each instance has independent
* copy of rules. Those can be rewritten with ease. Also, you can add new
* rules if you create plugin and adds new token types.
*
* Creates new renderer instance and fills {@link Renderer.rules} with defaults.
*/
var Renderer = class {
	constructor() {
		_defineProperty(
			this,
			/**
			* Contains render rules for tokens. Can be updated and extended.
			*
			* See [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts)
			* for more details and examples.
			*
			* @example Custom render rules
			* ```javascript
			* import MarkdownIt from 'markdown-it'
			* const md = new MarkdownIt()
			*
			* md.renderer.rules.strong_open  = function () { return '<b>'; };
			* md.renderer.rules.strong_close = function () { return '</b>'; };
			*
			* const result = md.renderInline(...);
			* ```
			*
			* @example Each rule is called as independent static function with fixed signature
			* ```javascript
			* function my_token_render(tokens, idx, options, env, renderer) {
			*   // ...
			*   return renderedHTML;
			* }
			* ```
			*/
			"rules",
			Object.assign({}, default_rules)
		);
	}
	/**
	* Render token attributes to string.
	*/
	renderAttrs(token) {
		let i, l, result;
		if (!token.attrs) return "";
		result = "";
		for (i = 0, l = token.attrs.length; i < l; i++) result += ` ${escapeHtml$1(token.attrs[i][0])}="${escapeHtml$1(String(token.attrs[i][1]))}"`;
		return result;
	}
	/**
	* Default token renderer. Can be overriden by custom function
	* in {@link Renderer.rules}.
	*/
	renderToken(tokens, idx, options) {
		const token = tokens[idx];
		let result = "";
		if (token.hidden) return "";
		let prev = idx - 1;
		while (prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === 0) prev--;
		if (token.block && token.nesting !== -1 && prev >= 0 && tokens[prev].hidden && tokens[prev].nesting === -1) result += "\n";
		result += (token.nesting === -1 ? "</" : "<") + token.tag;
		result += this.renderAttrs(token);
		if (token.nesting === 0 && options.xhtmlOut) result += " /";
		let needLf = false;
		if (token.block) {
			needLf = true;
			if (token.nesting === 1) {
				let next = idx + 1;
				while (next < tokens.length && tokens[next].hidden && tokens[next].nesting === 0) next++;
				if (next < tokens.length) {
					const nextToken = tokens[next];
					if (nextToken.type === "inline" || nextToken.hidden) needLf = false;
					else if (nextToken.nesting === -1 && nextToken.tag === token.tag) needLf = false;
				}
			}
		}
		result += needLf ? ">\n" : ">";
		return result;
	}
	/**
	* The same as {@link Renderer.render}, but for single token of `inline` type.
	*/
	renderInline(tokens, options, env) {
		let result = "";
		const rules = this.rules;
		for (let i = 0, len = tokens.length; i < len; i++) {
			const type = tokens[i].type;
			if (typeof rules[type] !== "undefined") result += rules[type](tokens, i, options, env, this);
			else result += this.renderToken(tokens, i, options);
		}
		return result;
	}
	/**
	* Special kludge for image `alt` attributes to conform CommonMark spec.
	* Don't try to use it! Spec requires to show `alt` content with stripped markup,
	* instead of simple escaping.
	*/
	renderInlineAsText(tokens, options, env) {
		let result = "";
		for (let i = 0, len = tokens.length; i < len; i++) switch (tokens[i].type) {
			case "text":
			case "code_inline":
				result += tokens[i].content;
				break;
			case "image":
				result += this.renderInlineAsText(tokens[i].children, options, env);
				break;
			case "html_inline":
			case "html_block":
				result += tokens[i].content;
				break;
			case "softbreak":
			case "hardbreak": result += "\n";
		}
		return result;
	}
	/**
	* Takes token stream and generates HTML. Probably, you will never need to call
	* this method directly.
	*/
	render(tokens, options, env) {
		let result = "";
		const rules = this.rules;
		for (let i = 0, len = tokens.length; i < len; i++) {
			const type = tokens[i].type;
			if (type === "inline") result += this.renderInline(tokens[i].children, options, env);
			else if (typeof rules[type] !== "undefined") result += rules[type](tokens, i, options, env, this);
			else result += this.renderToken(tokens, i, options);
		}
		return result;
	}
};
/** Mutable state passed through the core rules chain. */
var StateCore = class {
	constructor(src, md, env) {
		_defineProperty(this, "tokens", []);
		_defineProperty(this, "inlineMode", false);
		_defineProperty(this, "Token", Token);
		this.src = src;
		this.env = env;
		this.md = md;
	}
};
var UNNORMALIZED_NEWLINE_RE = /\r\n?/g;
var NULL_RE = /\0/g;
function normalize(state) {
	let str;
	str = state.src.replace(UNNORMALIZED_NEWLINE_RE, "\n");
	str = str.replace(NULL_RE, "�");
	state.src = str;
}
function block(state) {
	let token;
	if (state.inlineMode) {
		token = new state.Token("inline", "", 0);
		token.content = state.src;
		token.map = [0, 1];
		token.children = [];
		state.tokens.push(token);
	} else state.md.block.parse(state.src, state.md, state.env, state.tokens);
}
function strip_references(state) {
	const tokens = state.tokens;
	let last = 0;
	for (let curr = 0; curr < tokens.length; curr++) {
		if (tokens[curr].type === "reference_definition") continue;
		if (curr !== last) tokens[last] = tokens[curr];
		last++;
	}
	if (tokens.length !== last) tokens.length = last;
}
function inline$1(state) {
	const tokens = state.tokens;
	for (let i = 0, l = tokens.length; i < l; i++) {
		const tok = tokens[i];
		if (tok.type === "inline") state.md.inline.parse(tok.content, state.md, state.env, tok.children);
	}
}
function isLinkOpen$1(str) {
	return /^<a[>\s]/i.test(str);
}
function isLinkClose$1(str) {
	return /^<\/a\s*>/i.test(str);
}
function linkify$1(state) {
	const blockTokens = state.tokens;
	if (!state.md.options.linkify) return;
	for (let j = 0, l = blockTokens.length; j < l; j++) {
		if (blockTokens[j].type !== "inline" || !state.md.linkify.test(blockTokens[j].content)) continue;
		const tokens = blockTokens[j].children;
		const replacements = [];
		let htmlLinkLevel = 0;
		for (let i = tokens.length - 1; i >= 0; i--) {
			const currentToken = tokens[i];
			if (currentToken.type === "link_close") {
				i--;
				while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") i--;
				continue;
			}
			if (currentToken.type === "html_inline") {
				if (isLinkOpen$1(currentToken.content) && htmlLinkLevel > 0) htmlLinkLevel--;
				if (isLinkClose$1(currentToken.content)) htmlLinkLevel++;
			}
			if (htmlLinkLevel > 0) continue;
			if (currentToken.type === "text" && state.md.linkify.test(currentToken.content)) {
				const text = currentToken.content;
				let links = state.md.linkify.match(text);
				const nodes = [];
				let level = currentToken.level;
				let lastPos = 0;
				if (links.length > 0 && links[0].index === 0 && i > 0 && tokens[i - 1].type === "text_special") links = links.slice(1);
				for (let ln = 0; ln < links.length; ln++) {
					const url = links[ln].url;
					const fullUrl = state.md.normalizeLink(url);
					if (!state.md.validateLink(fullUrl)) continue;
					let urlText = links[ln].text;
					if (!links[ln].schema) urlText = state.md.normalizeLinkText(`http://${urlText}`).replace(/^http:\/\//, "");
					else if (links[ln].schema === "mailto:" && !/^mailto:/i.test(urlText)) urlText = state.md.normalizeLinkText(`mailto:${urlText}`).replace(/^mailto:/, "");
					else urlText = state.md.normalizeLinkText(urlText);
					const pos = links[ln].index;
					if (pos > lastPos) {
						const token = new state.Token("text", "", 0);
						token.content = text.slice(lastPos, pos);
						token.level = level;
						nodes.push(token);
					}
					const token_o = new state.Token("link_open", "a", 1);
					token_o.attrs = [["href", fullUrl]];
					token_o.level = level++;
					token_o.markup = "linkify";
					token_o.info = "auto";
					nodes.push(token_o);
					const token_t = new state.Token("text", "", 0);
					token_t.content = urlText;
					token_t.level = level;
					nodes.push(token_t);
					const token_c = new state.Token("link_close", "a", -1);
					token_c.level = --level;
					token_c.markup = "linkify";
					token_c.info = "auto";
					nodes.push(token_c);
					lastPos = links[ln].lastIndex;
				}
				if (lastPos < text.length) {
					const token = new state.Token("text", "", 0);
					token.content = text.slice(lastPos);
					token.level = level;
					nodes.push(token);
				}
				replacements.push({
					index: i,
					nodes
				});
			}
		}
		if (replacements.length > 0) {
			let newTokensLength = tokens.length;
			for (const replacement of replacements) newTokensLength += replacement.nodes.length - 1;
			const newTokens = new Array(newTokensLength);
			let replacementIndex = 0;
			let newTokenIndex = 0;
			replacements.reverse();
			for (let i = 0; i < tokens.length; i++) {
				const replacement = replacements[replacementIndex];
				if ((replacement === null || replacement === void 0 ? void 0 : replacement.index) === i) {
					for (const node of replacement.nodes) newTokens[newTokenIndex++] = node;
					replacementIndex++;
				} else newTokens[newTokenIndex++] = tokens[i];
			}
			blockTokens[j].children = newTokens;
		}
	}
}
var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
var SCOPED_ABBR_TEST_RE = /\((c|tm|r)\)/i;
var SCOPED_ABBR_RE = /\((c|tm|r)\)/gi;
var SCOPED_ABBR = {
	c: "©",
	r: "®",
	tm: "™"
};
function replaceFn(match, name) {
	return SCOPED_ABBR[name.toLowerCase()];
}
function replace_scoped(inlineTokens) {
	let inside_autolink = 0;
	for (let i = inlineTokens.length - 1; i >= 0; i--) {
		const token = inlineTokens[i];
		if (token.type === "text" && !inside_autolink) token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
		if (token.type === "link_open" && token.info === "auto") inside_autolink--;
		if (token.type === "link_close" && token.info === "auto") inside_autolink++;
	}
}
function replace_rare(inlineTokens) {
	let inside_autolink = 0;
	for (let i = inlineTokens.length - 1; i >= 0; i--) {
		const token = inlineTokens[i];
		if (token.type === "text" && !inside_autolink) {
			if (RARE_RE.test(token.content)) token.content = token.content.replace(/\+-/g, "±").replace(/\.{2,}/g, "…").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/gm, "$1—").replace(/(^|\s)--(?=\s|$)/gm, "$1–").replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1–");
		}
		if (token.type === "link_open" && token.info === "auto") inside_autolink--;
		if (token.type === "link_close" && token.info === "auto") inside_autolink++;
	}
}
function replace(state) {
	let blkIdx;
	if (!state.md.options.typographer) return;
	for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
		if (state.tokens[blkIdx].type !== "inline") continue;
		if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) replace_scoped(state.tokens[blkIdx].children);
		if (RARE_RE.test(state.tokens[blkIdx].content)) replace_rare(state.tokens[blkIdx].children);
	}
}
var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = "’";
var MAX_OPENERS = 1e3;
function truncateStack(stack, heads, length) {
	while (stack.length > length) {
		const item = stack.pop();
		if (item.isSingleQuote) heads.single = item.prevSameQuoteIdx;
		else heads.double = item.prevSameQuoteIdx;
	}
}
function addReplacement(replacements, tokenIdx, pos, ch) {
	if (!replacements[tokenIdx]) replacements[tokenIdx] = [];
	replacements[tokenIdx].push({
		pos,
		ch
	});
}
function applyReplacements(str, replacements) {
	let result = "";
	let lastPos = 0;
	replacements.sort((a, b) => a.pos - b.pos);
	for (let i = 0; i < replacements.length; i++) {
		const replacement = replacements[i];
		result += str.slice(lastPos, replacement.pos) + replacement.ch;
		lastPos = replacement.pos + 1;
	}
	return result + str.slice(lastPos);
}
function process_inlines(tokens, state) {
	let j;
	const stack = [];
	const heads = {
		single: -1,
		double: -1
	};
	const replacements = {};
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const thisLevel = tokens[i].level;
		for (j = stack.length - 1; j >= 0; j--) if (stack[j].level <= thisLevel) break;
		truncateStack(stack, heads, j + 1);
		if (token.type !== "text") continue;
		const text = token.content;
		let pos = 0;
		const max = text.length;
		OUTER: while (pos < max) {
			QUOTE_RE.lastIndex = pos;
			const t = QUOTE_RE.exec(text);
			if (!t) break;
			let canOpen = true;
			let canClose = true;
			pos = t.index + 1;
			const isSingle = t[0] === "'";
			let lastChar = 32;
			if (t.index - 1 >= 0) lastChar = text.charCodeAt(t.index - 1);
			else for (j = i - 1; j >= 0; j--) {
				if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
				if (!tokens[j].content) continue;
				lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
				break;
			}
			let nextChar = 32;
			if (pos < max) nextChar = text.charCodeAt(pos);
			else for (j = i + 1; j < tokens.length; j++) {
				if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak") break;
				if (!tokens[j].content) continue;
				nextChar = tokens[j].content.charCodeAt(0);
				break;
			}
			const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
			const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
			const isLastWhiteSpace = isWhiteSpace(lastChar);
			const isNextWhiteSpace = isWhiteSpace(nextChar);
			if (isNextWhiteSpace) canOpen = false;
			else if (isNextPunctChar) {
				if (!(isLastWhiteSpace || isLastPunctChar)) canOpen = false;
			}
			if (isLastWhiteSpace) canClose = false;
			else if (isLastPunctChar) {
				if (!(isNextWhiteSpace || isNextPunctChar)) canClose = false;
			}
			if (nextChar === 34 && t[0] === "\"") {
				if (lastChar >= 48 && lastChar <= 57) canClose = canOpen = false;
			}
			if (canOpen && canClose) {
				canOpen = isLastPunctChar;
				canClose = isNextPunctChar;
			}
			if (!canOpen && !canClose) {
				if (isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
				continue;
			}
			if (canClose) {
				j = isSingle ? heads.single : heads.double;
				if (j >= 0 && stack[j].level === thisLevel) {
					const item = stack[j];
					let openQuote;
					let closeQuote;
					if (isSingle) {
						openQuote = state.md.options.quotes[2];
						closeQuote = state.md.options.quotes[3];
					} else {
						openQuote = state.md.options.quotes[0];
						closeQuote = state.md.options.quotes[1];
					}
					addReplacement(replacements, i, t.index, closeQuote);
					addReplacement(replacements, item.tokenIdx, item.contentPos, openQuote);
					truncateStack(stack, heads, j);
					continue OUTER;
				}
			}
			if (canOpen) {
				if (stack.length >= MAX_OPENERS) return;
				stack.push({
					tokenIdx: i,
					contentPos: t.index,
					isSingleQuote: isSingle,
					level: thisLevel,
					prevSameQuoteIdx: isSingle ? heads.single : heads.double
				});
				if (isSingle) heads.single = stack.length - 1;
				else heads.double = stack.length - 1;
			} else if (canClose && isSingle) addReplacement(replacements, i, t.index, APOSTROPHE);
		}
	}
	Object.keys(replacements).forEach(function(tokenIdx) {
		const idx = Number(tokenIdx);
		tokens[idx].content = applyReplacements(tokens[idx].content, replacements[tokenIdx]);
	});
}
function smartquotes(state) {
	if (!state.md.options.typographer) return;
	for (let blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
		if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) continue;
		process_inlines(state.tokens[blkIdx].children, state);
	}
}
function join_alt(tokens) {
	let curr, last;
	const max = tokens.length;
	for (curr = 0; curr < max; curr++) if (tokens[curr].type === "text_special") tokens[curr].type = "text";
	for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
	else {
		if (curr !== last) tokens[last] = tokens[curr];
		last++;
	}
	if (curr !== last) tokens.length = last;
}
function text_join(state) {
	let curr, last;
	const blockTokens = state.tokens;
	const l = blockTokens.length;
	for (let j = 0; j < l; j++) {
		if (blockTokens[j].type !== "inline") continue;
		const tokens = blockTokens[j].children;
		const max = tokens.length;
		for (curr = 0; curr < max; curr++) {
			if (tokens[curr].type === "text_special") tokens[curr].type = "text";
			if (tokens[curr].children) join_alt(tokens[curr].children);
		}
		for (curr = last = 0; curr < max; curr++) if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
		else {
			if (curr !== last) tokens[last] = tokens[curr];
			last++;
		}
		if (curr !== last) tokens.length = last;
	}
}
var _rules$2 = [
	["normalize", normalize],
	["block", block],
	["strip_references", strip_references],
	["inline", inline$1],
	["linkify", linkify$1],
	["replacements", replace],
	["smartquotes", smartquotes],
	["text_join", text_join]
];
/**
* Top-level rules executor. Glues block/inline parsers and does intermediate
* transformations.
*/
var ParserCore = class {
	constructor() {
		_defineProperty(
			this,
			/**
			* {@link Ruler} instance. Keep configuration of core rules.
			*/
			"ruler",
			new Ruler()
		);
		_defineProperty(this, "State", StateCore);
		for (let i = 0; i < _rules$2.length; i++) this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
	}
	/**
	* Executes core chain rules.
	*/
	process(state) {
		const rules = this.ruler.getRules("");
		for (let i = 0, l = rules.length; i < l; i++) rules[i](state);
	}
};
/** Mutable state passed to block rules while tokenizing a source document. */
var StateBlock = class {
	constructor(src, md, env, tokens) {
		_defineProperty(this, "bMarks", []);
		_defineProperty(this, "eMarks", []);
		_defineProperty(this, "tShift", []);
		_defineProperty(this, "sCount", []);
		_defineProperty(this, "bsCount", []);
		_defineProperty(this, "blkIndent", 0);
		_defineProperty(this, "line", 0);
		_defineProperty(this, "lineMax", 0);
		_defineProperty(this, "tight", false);
		_defineProperty(this, "listIndent", -1);
		_defineProperty(this, "parentType", "root");
		_defineProperty(this, "level", 0);
		_defineProperty(this, "Token", Token);
		this.src = src;
		this.md = md;
		this.env = env;
		this.tokens = tokens;
		const s = this.src;
		for (let start = 0, pos = 0, indent = 0, offset = 0, len = s.length, indent_found = false; pos < len; pos++) {
			const ch = s.charCodeAt(pos);
			if (!indent_found) if (isSpace(ch)) {
				indent++;
				if (ch === 9) offset += 4 - offset % 4;
				else offset++;
				continue;
			} else indent_found = true;
			if (ch === 10 || pos === len - 1) {
				if (ch !== 10) pos++;
				this.bMarks.push(start);
				this.eMarks.push(pos);
				this.tShift.push(indent);
				this.sCount.push(offset);
				this.bsCount.push(0);
				indent_found = false;
				indent = 0;
				offset = 0;
				start = pos + 1;
			}
		}
		this.bMarks.push(s.length);
		this.eMarks.push(s.length);
		this.tShift.push(0);
		this.sCount.push(0);
		this.bsCount.push(0);
		this.lineMax = this.bMarks.length - 1;
	}
	push(type, tag, nesting) {
		const token = new Token(type, tag, nesting);
		token.block = true;
		if (nesting < 0) this.level--;
		token.level = this.level;
		if (nesting > 0) this.level++;
		this.tokens.push(token);
		return token;
	}
	isEmpty(line) {
		return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
	}
	skipEmptyLines(from) {
		for (let max = this.lineMax; from < max; from++) if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) break;
		return from;
	}
	skipSpaces(pos) {
		for (let max = this.src.length; pos < max; pos++) if (!isSpace(this.src.charCodeAt(pos))) break;
		return pos;
	}
	skipSpacesBack(pos, min) {
		if (pos <= min) return pos;
		while (pos > min) if (!isSpace(this.src.charCodeAt(--pos))) return pos + 1;
		return pos;
	}
	skipChars(pos, code) {
		for (let max = this.src.length; pos < max; pos++) if (this.src.charCodeAt(pos) !== code) break;
		return pos;
	}
	skipCharsBack(pos, code, min) {
		if (pos <= min) return pos;
		while (pos > min) if (code !== this.src.charCodeAt(--pos)) return pos + 1;
		return pos;
	}
	getLines(begin, end, indent, keepLastLF) {
		if (begin >= end) return "";
		const queue = new Array(end - begin);
		for (let i = 0, line = begin; line < end; line++, i++) {
			let lineIndent = 0;
			const lineStart = this.bMarks[line];
			let first = lineStart;
			let last;
			if (line + 1 < end || keepLastLF) last = this.eMarks[line] + 1;
			else last = this.eMarks[line];
			while (first < last && lineIndent < indent) {
				const ch = this.src.charCodeAt(first);
				if (isSpace(ch)) if (ch === 9) lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
				else lineIndent++;
				else if (first - lineStart < this.tShift[line]) lineIndent++;
				else break;
				first++;
			}
			if (lineIndent > indent) queue[i] = new Array(lineIndent - indent + 1).join(" ") + this.src.slice(first, last);
			else queue[i] = this.src.slice(first, last);
		}
		return queue.join("");
	}
};
var MAX_AUTOCOMPLETED_CELLS = 65536;
function getLine(state, line) {
	const pos = state.bMarks[line] + state.tShift[line];
	const max = state.eMarks[line];
	return state.src.slice(pos, max);
}
function escapedSplit(str) {
	const result = [];
	const max = str.length;
	let pos = 0;
	let ch = str.charCodeAt(pos);
	let isEscaped = false;
	let lastPos = 0;
	let current = "";
	while (pos < max) {
		if (ch === 124) if (!isEscaped) {
			result.push(current + str.substring(lastPos, pos));
			current = "";
			lastPos = pos + 1;
		} else {
			current += str.substring(lastPos, pos - 1);
			lastPos = pos;
		}
		isEscaped = ch === 92;
		pos++;
		ch = str.charCodeAt(pos);
	}
	result.push(current + str.substring(lastPos));
	return result;
}
function table(state, startLine, endLine, silent) {
	if (startLine + 2 > endLine) return false;
	let nextLine = startLine + 1;
	if (state.sCount[nextLine] < state.blkIndent) return false;
	if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
	let pos = state.bMarks[nextLine] + state.tShift[nextLine];
	if (pos >= state.eMarks[nextLine]) return false;
	const firstCh = state.src.charCodeAt(pos++);
	if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) return false;
	if (pos >= state.eMarks[nextLine]) return false;
	const secondCh = state.src.charCodeAt(pos++);
	if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) return false;
	if (firstCh === 45 && isSpace(secondCh)) return false;
	while (pos < state.eMarks[nextLine]) {
		const ch = state.src.charCodeAt(pos);
		if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) return false;
		pos++;
	}
	let lineText = getLine(state, startLine + 1);
	let columns = lineText.split("|");
	const aligns = [];
	for (let i = 0; i < columns.length; i++) {
		const t = columns[i].trim();
		if (!t) if (i === 0 || i === columns.length - 1) continue;
		else return false;
		if (!/^:?-+:?$/.test(t)) return false;
		if (t.charCodeAt(t.length - 1) === 58) aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
		else if (t.charCodeAt(0) === 58) aligns.push("left");
		else aligns.push("");
	}
	lineText = getLine(state, startLine).trim();
	if (lineText.indexOf("|") === -1) return false;
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	columns = escapedSplit(lineText);
	if (columns.length && columns[0] === "") columns.shift();
	if (columns.length && columns[columns.length - 1] === "") columns.pop();
	const columnCount = columns.length;
	if (columnCount === 0 || columnCount !== aligns.length) return false;
	if (silent) return true;
	const oldParentType = state.parentType;
	state.parentType = "table";
	const terminatorRules = state.md.block.ruler.getRules("blockquote");
	const token_to = state.push("table_open", "table", 1);
	const tableLines = [startLine, 0];
	token_to.map = tableLines;
	const token_tho = state.push("thead_open", "thead", 1);
	token_tho.map = [startLine, startLine + 1];
	const token_htro = state.push("tr_open", "tr", 1);
	token_htro.map = [startLine, startLine + 1];
	for (let i = 0; i < columns.length; i++) {
		const token_ho = state.push("th_open", "th", 1);
		if (aligns[i]) token_ho.attrs = [["style", `text-align:${aligns[i]}`]];
		const token_il = state.push("inline", "", 0);
		token_il.content = columns[i].trim();
		token_il.children = [];
		state.push("th_close", "th", -1);
	}
	state.push("tr_close", "tr", -1);
	state.push("thead_close", "thead", -1);
	let tbodyLines;
	let autocompletedCells = 0;
	for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
		if (state.sCount[nextLine] < state.blkIndent) break;
		let terminate = false;
		for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
			terminate = true;
			break;
		}
		if (terminate) break;
		lineText = getLine(state, nextLine).trim();
		if (!lineText) break;
		if (state.sCount[nextLine] - state.blkIndent >= 4) break;
		columns = escapedSplit(lineText);
		if (columns.length && columns[0] === "") columns.shift();
		if (columns.length && columns[columns.length - 1] === "") columns.pop();
		autocompletedCells += columnCount - columns.length;
		if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
		if (nextLine === startLine + 2) {
			const token_tbo = state.push("tbody_open", "tbody", 1);
			token_tbo.map = tbodyLines = [startLine + 2, 0];
		}
		const token_tro = state.push("tr_open", "tr", 1);
		token_tro.map = [nextLine, nextLine + 1];
		for (let i = 0; i < columnCount; i++) {
			const token_tdo = state.push("td_open", "td", 1);
			if (aligns[i]) token_tdo.attrs = [["style", `text-align:${aligns[i]}`]];
			const token_il = state.push("inline", "", 0);
			token_il.content = columns[i] ? columns[i].trim() : "";
			token_il.children = [];
			state.push("td_close", "td", -1);
		}
		state.push("tr_close", "tr", -1);
	}
	if (tbodyLines) {
		state.push("tbody_close", "tbody", -1);
		tbodyLines[1] = nextLine;
	}
	state.push("table_close", "table", -1);
	tableLines[1] = nextLine;
	state.parentType = oldParentType;
	state.line = nextLine;
	return true;
}
function code(state, startLine, endLine) {
	if (state.sCount[startLine] - state.blkIndent < 4) return false;
	let nextLine = startLine + 1;
	let last = nextLine;
	while (nextLine < endLine) {
		if (state.isEmpty(nextLine)) {
			nextLine++;
			continue;
		}
		if (state.sCount[nextLine] - state.blkIndent >= 4) {
			nextLine++;
			last = nextLine;
			continue;
		}
		break;
	}
	state.line = last;
	const token = state.push("code_block", "code", 0);
	token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + "\n";
	token.map = [startLine, state.line];
	return true;
}
function fence(state, startLine, endLine, silent) {
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	let max = state.eMarks[startLine];
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	if (pos + 3 > max) return false;
	const marker = state.src.charCodeAt(pos);
	if (marker !== 126 && marker !== 96) return false;
	let mem = pos;
	pos = state.skipChars(pos, marker);
	let len = pos - mem;
	if (len < 3) return false;
	const markup = state.src.slice(mem, pos);
	const params = state.src.slice(pos, max);
	if (marker === 96) {
		if (params.indexOf(String.fromCharCode(marker)) >= 0) return false;
	}
	if (silent) return true;
	let nextLine = startLine;
	let haveEndMarker = false;
	for (;;) {
		nextLine++;
		if (nextLine >= endLine) break;
		pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
		max = state.eMarks[nextLine];
		if (pos < max && state.sCount[nextLine] < state.blkIndent) break;
		if (state.src.charCodeAt(pos) !== marker) continue;
		if (state.sCount[nextLine] - state.blkIndent >= 4) continue;
		pos = state.skipChars(pos, marker);
		if (pos - mem < len) continue;
		pos = state.skipSpaces(pos);
		if (pos < max) continue;
		haveEndMarker = true;
		break;
	}
	len = state.sCount[startLine];
	state.line = nextLine + (haveEndMarker ? 1 : 0);
	const token = state.push("fence", "code", 0);
	token.info = params;
	token.content = state.getLines(startLine + 1, nextLine, len, true);
	token.markup = markup;
	token.map = [startLine, state.line];
	return true;
}
function blockquote(state, startLine, endLine, silent) {
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	let max = state.eMarks[startLine];
	const oldLineMax = state.lineMax;
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	if (state.src.charCodeAt(pos) !== 62) return false;
	if (silent) return true;
	const oldBMarks = [];
	const oldBSCount = [];
	const oldSCount = [];
	const oldTShift = [];
	const terminatorRules = state.md.block.ruler.getRules("blockquote");
	const oldParentType = state.parentType;
	state.parentType = "blockquote";
	let lastLineEmpty = false;
	let nextLine;
	for (nextLine = startLine; nextLine < endLine; nextLine++) {
		const isOutdented = state.sCount[nextLine] < state.blkIndent;
		pos = state.bMarks[nextLine] + state.tShift[nextLine];
		max = state.eMarks[nextLine];
		if (pos >= max) break;
		if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
			let initial = state.sCount[nextLine] + 1;
			let spaceAfterMarker;
			let adjustTab;
			if (state.src.charCodeAt(pos) === 32) {
				pos++;
				initial++;
				adjustTab = false;
				spaceAfterMarker = true;
			} else if (state.src.charCodeAt(pos) === 9) {
				spaceAfterMarker = true;
				if ((state.bsCount[nextLine] + initial) % 4 === 3) {
					pos++;
					initial++;
					adjustTab = false;
				} else adjustTab = true;
			} else spaceAfterMarker = false;
			let offset = initial;
			oldBMarks.push(state.bMarks[nextLine]);
			state.bMarks[nextLine] = pos;
			while (pos < max) {
				const ch = state.src.charCodeAt(pos);
				if (isSpace(ch)) if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
				else offset++;
				else break;
				pos++;
			}
			lastLineEmpty = pos >= max;
			oldBSCount.push(state.bsCount[nextLine]);
			state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
			oldSCount.push(state.sCount[nextLine]);
			state.sCount[nextLine] = offset - initial;
			oldTShift.push(state.tShift[nextLine]);
			state.tShift[nextLine] = pos - state.bMarks[nextLine];
			continue;
		}
		if (lastLineEmpty) break;
		let terminate = false;
		for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
			terminate = true;
			break;
		}
		if (terminate) {
			state.lineMax = nextLine;
			if (state.blkIndent !== 0) {
				oldBMarks.push(state.bMarks[nextLine]);
				oldBSCount.push(state.bsCount[nextLine]);
				oldTShift.push(state.tShift[nextLine]);
				oldSCount.push(state.sCount[nextLine]);
				state.sCount[nextLine] -= state.blkIndent;
			}
			break;
		}
		oldBMarks.push(state.bMarks[nextLine]);
		oldBSCount.push(state.bsCount[nextLine]);
		oldTShift.push(state.tShift[nextLine]);
		oldSCount.push(state.sCount[nextLine]);
		state.sCount[nextLine] = -1;
	}
	const oldIndent = state.blkIndent;
	state.blkIndent = 0;
	const token_o = state.push("blockquote_open", "blockquote", 1);
	token_o.markup = ">";
	const lines = [startLine, 0];
	token_o.map = lines;
	state.md.block.tokenize(state, startLine, nextLine);
	const token_c = state.push("blockquote_close", "blockquote", -1);
	token_c.markup = ">";
	state.lineMax = oldLineMax;
	state.parentType = oldParentType;
	lines[1] = state.line;
	for (let i = 0; i < oldTShift.length; i++) {
		state.bMarks[i + startLine] = oldBMarks[i];
		state.tShift[i + startLine] = oldTShift[i];
		state.sCount[i + startLine] = oldSCount[i];
		state.bsCount[i + startLine] = oldBSCount[i];
	}
	state.blkIndent = oldIndent;
	return true;
}
function hr(state, startLine, endLine, silent) {
	const max = state.eMarks[startLine];
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	const marker = state.src.charCodeAt(pos++);
	if (marker !== 42 && marker !== 45 && marker !== 95) return false;
	let cnt = 1;
	while (pos < max) {
		const ch = state.src.charCodeAt(pos++);
		if (ch !== marker && !isSpace(ch)) return false;
		if (ch === marker) cnt++;
	}
	if (cnt < 3) return false;
	if (silent) return true;
	state.line = startLine + 1;
	const token = state.push("hr", "hr", 0);
	token.map = [startLine, state.line];
	token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
	return true;
}
function skipBulletListMarker(state, startLine) {
	const max = state.eMarks[startLine];
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	const marker = state.src.charCodeAt(pos++);
	if (marker !== 42 && marker !== 45 && marker !== 43) return -1;
	if (pos < max) {
		if (!isSpace(state.src.charCodeAt(pos))) return -1;
	}
	return pos;
}
function skipOrderedListMarker(state, startLine) {
	const start = state.bMarks[startLine] + state.tShift[startLine];
	const max = state.eMarks[startLine];
	let pos = start;
	if (pos + 1 >= max) return -1;
	let ch = state.src.charCodeAt(pos++);
	if (ch < 48 || ch > 57) return -1;
	for (;;) {
		if (pos >= max) return -1;
		ch = state.src.charCodeAt(pos++);
		if (ch >= 48 && ch <= 57) {
			if (pos - start >= 10) return -1;
			continue;
		}
		if (ch === 41 || ch === 46) break;
		return -1;
	}
	if (pos < max) {
		ch = state.src.charCodeAt(pos);
		if (!isSpace(ch)) return -1;
	}
	return pos;
}
function markTightParagraphs(state, idx) {
	const level = state.level + 2;
	for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
		state.tokens[i + 2].hidden = true;
		state.tokens[i].hidden = true;
		i += 2;
	}
}
function list(state, startLine, endLine, silent) {
	let max, pos, start, token;
	let nextLine = startLine;
	let tight = true;
	if (state.sCount[nextLine] - state.blkIndent >= 4) return false;
	if (state.listIndent >= 0 && state.sCount[nextLine] - state.listIndent >= 4 && state.sCount[nextLine] < state.blkIndent) return false;
	let isTerminatingParagraph = false;
	if (silent && state.parentType === "paragraph") {
		if (state.sCount[nextLine] >= state.blkIndent) isTerminatingParagraph = true;
	}
	let isOrdered;
	let markerValue;
	let posAfterMarker;
	if ((posAfterMarker = skipOrderedListMarker(state, nextLine)) >= 0) {
		isOrdered = true;
		start = state.bMarks[nextLine] + state.tShift[nextLine];
		markerValue = Number(state.src.slice(start, posAfterMarker - 1));
		if (isTerminatingParagraph && markerValue !== 1) return false;
	} else if ((posAfterMarker = skipBulletListMarker(state, nextLine)) >= 0) isOrdered = false;
	else return false;
	if (isTerminatingParagraph) {
		if (state.skipSpaces(posAfterMarker) >= state.eMarks[nextLine]) return false;
	}
	if (silent) return true;
	const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
	const listTokIdx = state.tokens.length;
	if (isOrdered) {
		token = state.push("ordered_list_open", "ol", 1);
		if (markerValue !== 1) token.attrs = [["start", markerValue]];
	} else token = state.push("bullet_list_open", "ul", 1);
	const listLines = [nextLine, 0];
	token.map = listLines;
	token.markup = String.fromCharCode(markerCharCode);
	let prevEmptyEnd = false;
	const terminatorRules = state.md.block.ruler.getRules("list");
	const oldParentType = state.parentType;
	state.parentType = "list";
	while (nextLine < endLine) {
		pos = posAfterMarker;
		max = state.eMarks[nextLine];
		const initial = state.sCount[nextLine] + posAfterMarker - (state.bMarks[nextLine] + state.tShift[nextLine]);
		let offset = initial;
		while (pos < max) {
			const ch = state.src.charCodeAt(pos);
			if (ch === 9) offset += 4 - (offset + state.bsCount[nextLine]) % 4;
			else if (ch === 32) offset++;
			else break;
			pos++;
		}
		const contentStart = pos;
		let indentAfterMarker;
		if (contentStart >= max) indentAfterMarker = 1;
		else indentAfterMarker = offset - initial;
		if (indentAfterMarker > 4) indentAfterMarker = 1;
		const indent = initial + indentAfterMarker;
		token = state.push("list_item_open", "li", 1);
		token.markup = String.fromCharCode(markerCharCode);
		const itemLines = [nextLine, 0];
		token.map = itemLines;
		if (isOrdered) token.info = state.src.slice(start, posAfterMarker - 1);
		const oldTight = state.tight;
		const oldTShift = state.tShift[nextLine];
		const oldSCount = state.sCount[nextLine];
		const oldListIndent = state.listIndent;
		state.listIndent = state.blkIndent;
		state.blkIndent = indent;
		state.tight = true;
		state.tShift[nextLine] = contentStart - state.bMarks[nextLine];
		state.sCount[nextLine] = offset;
		if (contentStart >= max && state.isEmpty(nextLine + 1)) state.line = Math.min(state.line + 2, endLine);
		else state.md.block.tokenize(state, nextLine, endLine);
		if (!state.tight || prevEmptyEnd) tight = false;
		prevEmptyEnd = state.line - nextLine > 1 && state.isEmpty(state.line - 1);
		state.blkIndent = state.listIndent;
		state.listIndent = oldListIndent;
		state.tShift[nextLine] = oldTShift;
		state.sCount[nextLine] = oldSCount;
		state.tight = oldTight;
		token = state.push("list_item_close", "li", -1);
		token.markup = String.fromCharCode(markerCharCode);
		nextLine = state.line;
		itemLines[1] = nextLine;
		if (nextLine >= endLine) break;
		if (state.sCount[nextLine] < state.blkIndent) break;
		if (state.sCount[nextLine] - state.blkIndent >= 4) break;
		let terminate = false;
		for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
			terminate = true;
			break;
		}
		if (terminate) break;
		if (isOrdered) {
			posAfterMarker = skipOrderedListMarker(state, nextLine);
			if (posAfterMarker < 0) break;
			start = state.bMarks[nextLine] + state.tShift[nextLine];
		} else {
			posAfterMarker = skipBulletListMarker(state, nextLine);
			if (posAfterMarker < 0) break;
		}
		if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) break;
	}
	if (isOrdered) token = state.push("ordered_list_close", "ol", -1);
	else token = state.push("bullet_list_close", "ul", -1);
	token.markup = String.fromCharCode(markerCharCode);
	listLines[1] = nextLine;
	state.line = nextLine;
	state.parentType = oldParentType;
	if (tight) markTightParagraphs(state, listTokIdx);
	return true;
}
var MAX_LABEL_LENGTH = 999;
function countCodePoints(str) {
	let length = str.length;
	for (let i = 0; i < str.length - 1; i++) {
		const high = str.charCodeAt(i);
		if (high < 55296 || high > 56319) continue;
		const low = str.charCodeAt(i + 1);
		if (low >= 56320 && low <= 57343) {
			length--;
			i++;
		}
	}
	return length;
}
function lineEnd(state, line) {
	return Math.min(state.eMarks[line] + 1, state.src.length);
}
function getNextLinePos(state, nextLine) {
	const endLine = state.lineMax;
	if (nextLine >= endLine || state.isEmpty(nextLine)) return -1;
	let isContinuation = false;
	if (state.sCount[nextLine] - state.blkIndent > 3) isContinuation = true;
	if (state.sCount[nextLine] < 0) isContinuation = true;
	if (!isContinuation) {
		const terminatorRules = state.md.block.ruler.getRules("reference");
		const oldParentType = state.parentType;
		state.parentType = "reference";
		let terminate = false;
		for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
			terminate = true;
			break;
		}
		state.parentType = oldParentType;
		if (terminate) return -1;
	}
	return state.bMarks[nextLine] + state.tShift[nextLine];
}
function reference(state, startLine, _endLine, silent) {
	const src = state.src;
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	let nextLine = startLine + 1;
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	if (src.charCodeAt(pos) !== 91) return false;
	let max = lineEnd(state, startLine);
	let rawLabel = "";
	let labelEnd = -1;
	let segmentStart = ++pos;
	while (pos < max) {
		if (rawLabel.length + pos - segmentStart > MAX_LABEL_LENGTH * 2) return false;
		let ch = src.charCodeAt(pos);
		if (ch === 91) return false;
		if (ch === 93) {
			labelEnd = pos;
			break;
		}
		if (ch === 92) ch = src.charCodeAt(++pos);
		if (ch === 10 && pos < max) {
			const nextPos = getNextLinePos(state, nextLine);
			if (nextPos < 0) return false;
			rawLabel += src.slice(segmentStart, max);
			pos = segmentStart = nextPos;
			max = lineEnd(state, nextLine++);
			continue;
		}
		pos++;
	}
	if (labelEnd < 0 || src.charCodeAt(labelEnd + 1) !== 58) return false;
	rawLabel += src.slice(segmentStart, labelEnd);
	if (rawLabel.length > MAX_LABEL_LENGTH && countCodePoints(rawLabel) > MAX_LABEL_LENGTH) return false;
	pos = labelEnd + 2;
	while (pos < max) {
		const ch = src.charCodeAt(pos);
		if (ch === 10) {
			const nextPos = getNextLinePos(state, nextLine);
			if (nextPos < 0) break;
			pos = nextPos;
			max = lineEnd(state, nextLine++);
		} else if (isSpace(ch)) pos++;
		else break;
	}
	const destRes = state.md.helpers.parseLinkDestination(src, pos, max);
	if (!destRes.ok) return false;
	const href = state.md.normalizeLink(destRes.str);
	if (!state.md.validateLink(href)) return false;
	pos = destRes.pos;
	const destEndPos = pos;
	const destEndMax = max;
	const destEndLineNo = nextLine;
	while (pos < max) {
		const ch = src.charCodeAt(pos);
		if (ch === 10) {
			const nextPos = getNextLinePos(state, nextLine);
			if (nextPos < 0) break;
			pos = nextPos;
			max = lineEnd(state, nextLine++);
		} else if (isSpace(ch)) pos++;
		else break;
	}
	const titleStart = pos;
	let titleRes = state.md.helpers.parseLinkTitle(src, pos, max);
	while (titleRes.can_continue) {
		const nextPos = getNextLinePos(state, nextLine);
		if (nextPos < 0) break;
		pos = nextPos;
		max = lineEnd(state, nextLine++);
		titleRes = state.md.helpers.parseLinkTitle(src, pos, max, titleRes);
	}
	let title;
	if (titleStart !== destEndPos && titleRes.ok) {
		title = titleRes.str;
		pos = titleRes.pos;
	} else {
		title = "";
		pos = destEndPos;
		max = destEndMax;
		nextLine = destEndLineNo;
	}
	while (pos < max) {
		if (!isSpace(src.charCodeAt(pos))) break;
		pos++;
	}
	if (pos < max && src.charCodeAt(pos) !== 10) {
		if (title) {
			title = "";
			pos = destEndPos;
			max = destEndMax;
			nextLine = destEndLineNo;
			while (pos < max) {
				if (!isSpace(src.charCodeAt(pos))) break;
				pos++;
			}
		}
	}
	if (pos < max && src.charCodeAt(pos) !== 10) return false;
	const label = normalizeReference(rawLabel);
	if (!label) return false;
	/* istanbul ignore if */
	if (silent) return true;
	if (typeof state.env.references === "undefined") state.env.references = {};
	if (typeof state.env.references[label] === "undefined") state.env.references[label] = {
		title,
		href
	};
	const token = state.push("reference_definition", "", 0);
	token.map = [startLine, nextLine];
	token.hidden = true;
	const meta = Object.create(null);
	meta.label = label;
	token.meta = meta;
	state.line = nextLine;
	return true;
}
var html_blocks_default = [
	"address",
	"article",
	"aside",
	"base",
	"basefont",
	"blockquote",
	"body",
	"caption",
	"center",
	"col",
	"colgroup",
	"dd",
	"details",
	"dialog",
	"dir",
	"div",
	"dl",
	"dt",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"frame",
	"frameset",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"head",
	"header",
	"hr",
	"html",
	"iframe",
	"legend",
	"li",
	"link",
	"main",
	"menu",
	"menuitem",
	"nav",
	"noframes",
	"ol",
	"optgroup",
	"option",
	"p",
	"param",
	"search",
	"section",
	"summary",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"title",
	"tr",
	"track",
	"ul"
];
var open_tag = `<[A-Za-z][A-Za-z0-9\\-]*(?:\\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\\s*=\\s*(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*"))?)*\\s*\\/?>`;
var close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
new RegExp(`^(?:${open_tag}|${close_tag}|<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->|<[?][\\s\\S]*?[?]>|<![A-Za-z][^>]*>|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)`);
var HTML_OPEN_CLOSE_TAG_RE = new RegExp(`^(?:${open_tag}|${close_tag})`);
var HTML_SEQUENCES = [
	[
		/^<(script|pre|style|textarea)(?=(\s|>|$))/i,
		/<\/(script|pre|style|textarea)>/i,
		true
	],
	[
		/^<!--/,
		/-->/,
		true
	],
	[
		/^<\?/,
		/\?>/,
		true
	],
	[
		/^<![A-Za-z]/,
		/>/,
		true
	],
	[
		/^<!\[CDATA\[/,
		/\]\]>/,
		true
	],
	[
		new RegExp(`^</?(${html_blocks_default.join("|")})(?=(\\s|/?>|$))`, "i"),
		/^$/,
		true
	],
	[
		new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`),
		/^$/,
		false
	]
];
function html_block(state, startLine, endLine, silent) {
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	let max = state.eMarks[startLine];
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	if (!state.md.options.html) return false;
	if (state.src.charCodeAt(pos) !== 60) return false;
	let lineText = state.src.slice(pos, max);
	let i = 0;
	for (; i < HTML_SEQUENCES.length; i++) if (HTML_SEQUENCES[i][0].test(lineText)) break;
	if (i === HTML_SEQUENCES.length) return false;
	if (silent) return HTML_SEQUENCES[i][2];
	let nextLine = startLine + 1;
	const endsOnBlankLine = HTML_SEQUENCES[i][1].test("");
	if (!HTML_SEQUENCES[i][1].test(lineText)) for (; nextLine < endLine; nextLine++) {
		if (state.sCount[nextLine] < state.blkIndent) {
			if (endsOnBlankLine || !state.isEmpty(nextLine)) break;
		}
		pos = state.bMarks[nextLine] + state.tShift[nextLine];
		max = state.eMarks[nextLine];
		lineText = state.src.slice(pos, max);
		if (HTML_SEQUENCES[i][1].test(lineText)) {
			if (lineText.length !== 0) nextLine++;
			break;
		}
	}
	state.line = nextLine;
	const token = state.push("html_block", "", 0);
	token.map = [startLine, nextLine];
	token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
	return true;
}
function heading(state, startLine, endLine, silent) {
	let pos = state.bMarks[startLine] + state.tShift[startLine];
	let max = state.eMarks[startLine];
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	let ch = state.src.charCodeAt(pos);
	if (ch !== 35 || pos >= max) return false;
	let level = 1;
	ch = state.src.charCodeAt(++pos);
	while (ch === 35 && pos < max && level <= 6) {
		level++;
		ch = state.src.charCodeAt(++pos);
	}
	if (level > 6 || pos < max && !isSpace(ch)) return false;
	if (silent) return true;
	max = state.skipSpacesBack(max, pos);
	const tmp = state.skipCharsBack(max, 35, pos);
	if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) max = tmp;
	state.line = startLine + 1;
	const token_o = state.push("heading_open", `h${level}`, 1);
	token_o.markup = "########".slice(0, level);
	token_o.map = [startLine, state.line];
	const token_i = state.push("inline", "", 0);
	token_i.content = asciiTrim(state.src.slice(pos, max));
	token_i.map = [startLine, state.line];
	token_i.children = [];
	const token_c = state.push("heading_close", `h${level}`, -1);
	token_c.markup = "########".slice(0, level);
	return true;
}
function lheading(state, startLine, endLine) {
	const terminatorRules = state.md.block.ruler.getRules("paragraph");
	if (state.sCount[startLine] - state.blkIndent >= 4) return false;
	const oldParentType = state.parentType;
	state.parentType = "paragraph";
	let level = 0;
	let marker;
	let nextLine = startLine + 1;
	for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
		if (state.sCount[nextLine] - state.blkIndent > 3) continue;
		if (state.sCount[nextLine] >= state.blkIndent) {
			let pos = state.bMarks[nextLine] + state.tShift[nextLine];
			const max = state.eMarks[nextLine];
			if (pos < max) {
				marker = state.src.charCodeAt(pos);
				if (marker === 45 || marker === 61) {
					pos = state.skipChars(pos, marker);
					pos = state.skipSpaces(pos);
					if (pos >= max) {
						level = marker === 61 ? 1 : 2;
						break;
					}
				}
			}
		}
		if (state.sCount[nextLine] < 0) continue;
		let terminate = false;
		for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
			terminate = true;
			break;
		}
		if (terminate) break;
	}
	if (!level) {
		state.parentType = oldParentType;
		return false;
	}
	const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
	state.line = nextLine + 1;
	const token_o = state.push("heading_open", `h${level}`, 1);
	token_o.markup = String.fromCharCode(marker);
	token_o.map = [startLine, state.line];
	const token_i = state.push("inline", "", 0);
	token_i.content = content;
	token_i.map = [startLine, state.line - 1];
	token_i.children = [];
	const token_c = state.push("heading_close", `h${level}`, -1);
	token_c.markup = String.fromCharCode(marker);
	state.parentType = oldParentType;
	return true;
}
function paragraph(state, startLine, endLine) {
	const terminatorRules = state.md.block.ruler.getRules("paragraph");
	const oldParentType = state.parentType;
	let nextLine = startLine + 1;
	state.parentType = "paragraph";
	for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
		if (state.sCount[nextLine] - state.blkIndent > 3) continue;
		if (state.sCount[nextLine] < 0) continue;
		let terminate = false;
		for (let i = 0, l = terminatorRules.length; i < l; i++) if (terminatorRules[i](state, nextLine, endLine, true)) {
			terminate = true;
			break;
		}
		if (terminate) break;
	}
	const content = asciiTrim(state.getLines(startLine, nextLine, state.blkIndent, false));
	state.line = nextLine;
	const token_o = state.push("paragraph_open", "p", 1);
	token_o.map = [startLine, state.line];
	const token_i = state.push("inline", "", 0);
	token_i.content = content;
	token_i.map = [startLine, state.line];
	token_i.children = [];
	state.push("paragraph_close", "p", -1);
	state.parentType = oldParentType;
	return true;
}
var _rules$1 = [
	[
		"table",
		table,
		["paragraph", "reference"]
	],
	["code", code],
	[
		"fence",
		fence,
		[
			"paragraph",
			"reference",
			"blockquote",
			"list"
		]
	],
	[
		"blockquote",
		blockquote,
		[
			"paragraph",
			"reference",
			"blockquote",
			"list"
		]
	],
	[
		"hr",
		hr,
		[
			"paragraph",
			"reference",
			"blockquote",
			"list"
		]
	],
	[
		"list",
		list,
		[
			"paragraph",
			"reference",
			"blockquote"
		]
	],
	["reference", reference],
	[
		"html_block",
		html_block,
		[
			"paragraph",
			"reference",
			"blockquote"
		]
	],
	[
		"heading",
		heading,
		[
			"paragraph",
			"reference",
			"blockquote"
		]
	],
	["lheading", lheading],
	["paragraph", paragraph]
];
/**
* Block-level tokenizer.
*/
var ParserBlock = class {
	constructor() {
		_defineProperty(
			this,
			/**
			* {@link Ruler} instance. Keep configuration of block rules.
			*/
			"ruler",
			new Ruler()
		);
		_defineProperty(this, "State", StateBlock);
		for (let i = 0; i < _rules$1.length; i++) this.ruler.push(_rules$1[i][0], _rules$1[i][1], { alt: (_rules$1[i][2] || []).slice() });
	}
	tokenize(state, startLine, endLine) {
		const rules = this.ruler.getRules("");
		const len = rules.length;
		const maxNesting = state.md.options.maxNesting;
		let line = startLine;
		let hasEmptyLines = false;
		while (line < endLine) {
			state.line = line = state.skipEmptyLines(line);
			if (line >= endLine) break;
			if (state.sCount[line] < state.blkIndent) break;
			if (state.level >= maxNesting) {
				state.line = endLine;
				break;
			}
			const prevLine = state.line;
			let ok = false;
			for (let i = 0; i < len; i++) {
				ok = rules[i](state, line, endLine, false);
				if (ok) {
					if (prevLine >= state.line) throw new Error("block rule didn't increment state.line");
					break;
				}
			}
			if (!ok) throw new Error("none of the block rules matched");
			state.tight = !hasEmptyLines;
			if (state.isEmpty(state.line - 1)) hasEmptyLines = true;
			line = state.line;
			if (line < endLine && state.isEmpty(line)) {
				hasEmptyLines = true;
				line++;
				state.line = line;
			}
		}
	}
	/**
	* Process input string and push block tokens into `outTokens`
	*/
	parse(src, md, env, outTokens) {
		if (!src) return;
		const state = new this.State(src, md, env, outTokens);
		this.tokenize(state, state.line, state.lineMax);
	}
};
/** Mutable state passed to inline rules while tokenizing inline content. */
var StateInline = class {
	constructor(src, md, env, outTokens) {
		_defineProperty(this, "pos", 0);
		_defineProperty(this, "level", 0);
		_defineProperty(this, "pending", "");
		_defineProperty(this, "pendingLevel", 0);
		_defineProperty(this, "cache", {});
		_defineProperty(this, "backticks", {});
		_defineProperty(this, "backticksScanned", false);
		_defineProperty(this, "skipHtmlSpecial", false);
		_defineProperty(this, "linkLevel", 0);
		_defineProperty(this, "delimiters", []);
		_defineProperty(this, "_prev_delimiters", []);
		_defineProperty(this, "Token", Token);
		this.src = src;
		this.env = env;
		this.md = md;
		this.tokens = outTokens;
		this.tokens_meta = Array(outTokens.length);
		this.posMax = this.src.length;
	}
	pushPending() {
		const token = new Token("text", "", 0);
		token.content = this.pending;
		token.level = this.pendingLevel;
		this.tokens.push(token);
		this.pending = "";
		return token;
	}
	push(type, tag, nesting) {
		if (this.pending) this.pushPending();
		const token = new Token(type, tag, nesting);
		let token_meta = void 0;
		if (nesting < 0) {
			this.level--;
			this.delimiters = this._prev_delimiters.pop();
		}
		token.level = this.level;
		if (nesting > 0) {
			this.level++;
			this._prev_delimiters.push(this.delimiters);
			this.delimiters = [];
			token_meta = { delimiters: this.delimiters };
		}
		this.pendingLevel = this.level;
		this.tokens.push(token);
		this.tokens_meta.push(token_meta);
		return token;
	}
	scanDelims(start, canSplitWord) {
		const max = this.posMax;
		const marker = this.src.charCodeAt(start);
		let lastChar;
		if (start === 0) lastChar = 32;
		else if (start === 1) {
			lastChar = this.src.charCodeAt(0);
			if ((lastChar & 63488) === 55296) lastChar = 65533;
		} else {
			lastChar = this.src.charCodeAt(start - 1);
			if ((lastChar & 64512) === 56320) {
				const highSurr = this.src.charCodeAt(start - 2);
				lastChar = (highSurr & 64512) === 55296 ? 65536 + (highSurr - 55296 << 10) + (lastChar - 56320) : 65533;
			} else if ((lastChar & 64512) === 55296) lastChar = 65533;
		}
		let pos = start;
		while (pos < max && this.src.charCodeAt(pos) === marker) pos++;
		const count = pos - start;
		let nextChar = pos < max ? this.src.charCodeAt(pos) : 32;
		if ((nextChar & 64512) === 55296) {
			const lowSurr = this.src.charCodeAt(pos + 1);
			nextChar = (lowSurr & 64512) === 56320 ? 65536 + (nextChar - 55296 << 10) + (lowSurr - 56320) : 65533;
		} else if ((nextChar & 64512) === 56320) nextChar = 65533;
		const isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctCharCode(lastChar);
		const isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctCharCode(nextChar);
		const isLastWhiteSpace = isWhiteSpace(lastChar);
		const isNextWhiteSpace = isWhiteSpace(nextChar);
		const left_flanking = !isNextWhiteSpace && (!isNextPunctChar || isLastWhiteSpace || isLastPunctChar);
		const right_flanking = !isLastWhiteSpace && (!isLastPunctChar || isNextWhiteSpace || isNextPunctChar);
		return {
			can_open: left_flanking && (canSplitWord || !right_flanking || isLastPunctChar),
			can_close: right_flanking && (canSplitWord || !left_flanking || isNextPunctChar),
			length: count
		};
	}
};
function isTerminatorChar(ch) {
	switch (ch) {
		case 10:
		case 33:
		case 35:
		case 36:
		case 37:
		case 38:
		case 42:
		case 43:
		case 45:
		case 58:
		case 60:
		case 61:
		case 62:
		case 64:
		case 91:
		case 92:
		case 93:
		case 94:
		case 95:
		case 96:
		case 123:
		case 125:
		case 126: return true;
		default: return false;
	}
}
function text(state, silent) {
	let pos = state.pos;
	while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) pos++;
	if (pos === state.pos) return false;
	if (!silent) state.pending += state.src.slice(state.pos, pos);
	state.pos = pos;
	return true;
}
function isAsciiAlpha(code) {
	return code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
function isSchemeChar(code) {
	return code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 45 || code === 46;
}
function linkify(state, silent) {
	if (!state.md.options.linkify) return false;
	if (state.linkLevel > 0) return false;
	const pos = state.pos;
	const max = state.posMax;
	if (pos + 3 > max) return false;
	if (state.src.charCodeAt(pos) !== 58) return false;
	if (state.src.charCodeAt(pos + 1) !== 47) return false;
	if (state.src.charCodeAt(pos + 2) !== 47) return false;
	const protoMin = pos - Math.min(10, state.pending.length, pos);
	let protoStart = pos;
	while (protoStart > protoMin && isSchemeChar(state.src.charCodeAt(protoStart - 1))) protoStart--;
	if (protoStart === pos || !isAsciiAlpha(state.src.charCodeAt(protoStart))) return false;
	const protoLength = pos - protoStart;
	const link = state.md.linkify.matchAtStart(state.src.slice(protoStart));
	if (!link) return false;
	let url = link.url;
	if (url.length <= protoLength) return false;
	let urlEnd = url.length;
	while (urlEnd > 0 && url.charCodeAt(urlEnd - 1) === 42) urlEnd--;
	if (urlEnd !== url.length) url = url.slice(0, urlEnd);
	const fullUrl = state.md.normalizeLink(url);
	if (!state.md.validateLink(fullUrl)) return false;
	if (!silent) {
		state.pending = state.pending.slice(0, -protoLength);
		const token_o = state.push("link_open", "a", 1);
		token_o.attrs = [["href", fullUrl]];
		token_o.markup = "linkify";
		token_o.info = "auto";
		const token_t = state.push("text", "", 0);
		token_t.content = state.md.normalizeLinkText(url);
		const token_c = state.push("link_close", "a", -1);
		token_c.markup = "linkify";
		token_c.info = "auto";
	}
	state.pos += url.length - protoLength;
	return true;
}
function newline(state, silent) {
	let pos = state.pos;
	if (state.src.charCodeAt(pos) !== 10) return false;
	const pmax = state.pending.length - 1;
	const max = state.posMax;
	if (!silent) if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
		let ws = pmax - 1;
		while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32) ws--;
		state.pending = state.pending.slice(0, ws);
		state.push("hardbreak", "br", 0);
	} else {
		state.pending = state.pending.slice(0, -1);
		state.push("softbreak", "br", 0);
	}
	else state.push("softbreak", "br", 0);
	pos++;
	while (pos < max && isSpace(state.src.charCodeAt(pos))) pos++;
	state.pos = pos;
	return true;
}
var ESCAPED = [];
for (let i = 0; i < 256; i++) ESCAPED.push(0);
"\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
	ESCAPED[ch.charCodeAt(0)] = 1;
});
function escape(state, silent) {
	let pos = state.pos;
	const max = state.posMax;
	if (state.src.charCodeAt(pos) !== 92) return false;
	pos++;
	if (pos >= max) return false;
	let ch1 = state.src.charCodeAt(pos);
	if (ch1 === 10) {
		if (!silent) state.push("hardbreak", "br", 0);
		pos++;
		while (pos < max) {
			ch1 = state.src.charCodeAt(pos);
			if (!isSpace(ch1)) break;
			pos++;
		}
		state.pos = pos;
		return true;
	}
	if (ch1 === 32) {
		if (!silent) {
			const token = state.push("text_special", "", 0);
			token.content = "\\";
			token.markup = "\\";
			token.info = "escape";
		}
		state.pos = pos;
		return true;
	}
	let escapedStr = state.src[pos];
	if (ch1 >= 55296 && ch1 <= 56319 && pos + 1 < max) {
		const ch2 = state.src.charCodeAt(pos + 1);
		if (ch2 >= 56320 && ch2 <= 57343) {
			escapedStr += state.src[pos + 1];
			pos++;
		}
	}
	const origStr = "\\" + escapedStr;
	if (!silent) {
		const token = state.push("text_special", "", 0);
		if (ch1 < 256 && ESCAPED[ch1] !== 0) token.content = escapedStr;
		else token.content = origStr;
		token.markup = origStr;
		token.info = "escape";
	}
	state.pos = pos + 1;
	return true;
}
function buildLastRuns(src) {
	const lastRuns = {};
	let pos = 0;
	while ((pos = src.indexOf("`", pos)) !== -1) {
		const start = pos;
		while (src.charCodeAt(++pos) === 96);
		lastRuns[pos - start] = start;
	}
	return lastRuns;
}
function backtick(state, silent) {
	var _state$backticks$open;
	const start = state.pos;
	if (state.src.charCodeAt(start) !== 96) return false;
	const max = state.posMax;
	let pos = start + 1;
	while (pos < max && state.src.charCodeAt(pos) === 96) pos++;
	const marker = state.src.slice(start, pos);
	const openerLength = marker.length;
	if (!state.backticksScanned) {
		state.backticks = buildLastRuns(state.src);
		state.backticksScanned = true;
	}
	if (((_state$backticks$open = state.backticks[openerLength]) !== null && _state$backticks$open !== void 0 ? _state$backticks$open : -1) >= pos) {
		let matchEnd = pos;
		let matchStart;
		while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1 && matchStart < max) {
			matchEnd = matchStart + 1;
			while (state.src.charCodeAt(matchEnd) === 96) matchEnd++;
			if (matchEnd > max) break;
			if (matchEnd - matchStart === openerLength) {
				if (!silent) {
					const token = state.push("code_inline", "code", 0);
					token.markup = marker;
					let content = state.src.slice(pos, matchStart).replace(/\n/g, " ");
					if (content.startsWith(" ") && content.endsWith(" ") && /[^ ]/.test(content)) content = content.slice(1, -1);
					token.content = content;
				}
				state.pos = matchEnd;
				return true;
			}
		}
	}
	if (!silent) state.pending += marker;
	state.pos = pos;
	return true;
}
function strikethrough_tokenize(state, silent) {
	const start = state.pos;
	const marker = state.src.charCodeAt(start);
	if (silent) return false;
	if (marker !== 126) return false;
	const scanned = state.scanDelims(state.pos, true);
	let len = scanned.length;
	const ch = String.fromCharCode(marker);
	if (len < 2) return false;
	let token;
	if (len % 2) {
		token = state.push("text", "", 0);
		token.content = ch;
		len--;
	}
	for (let i = 0; i < len; i += 2) {
		token = state.push("text", "", 0);
		token.content = ch + ch;
		state.delimiters.push({
			marker,
			length: 0,
			token: state.tokens.length - 1,
			end: -1,
			open: scanned.can_open,
			close: scanned.can_close
		});
	}
	state.pos += scanned.length;
	return true;
}
function postProcess$1(state, delimiters) {
	let token;
	const loneMarkers = [];
	const max = delimiters.length;
	for (let i = 0; i < max; i++) {
		const startDelim = delimiters[i];
		if (startDelim.marker !== 126) continue;
		if (startDelim.end === -1) continue;
		const endDelim = delimiters[startDelim.end];
		token = state.tokens[startDelim.token];
		token.type = "s_open";
		token.tag = "s";
		token.nesting = 1;
		token.markup = "~~";
		token.content = "";
		token = state.tokens[endDelim.token];
		token.type = "s_close";
		token.tag = "s";
		token.nesting = -1;
		token.markup = "~~";
		token.content = "";
		if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") loneMarkers.push(endDelim.token - 1);
	}
	while (loneMarkers.length) {
		const i = loneMarkers.pop();
		let j = i + 1;
		while (j < state.tokens.length && state.tokens[j].type === "s_close") j++;
		j--;
		if (i !== j) {
			token = state.tokens[j];
			state.tokens[j] = state.tokens[i];
			state.tokens[i] = token;
		}
	}
}
function strikethrough_postProcess(state) {
	const tokens_meta = state.tokens_meta;
	const max = state.tokens_meta.length;
	postProcess$1(state, state.delimiters);
	for (let curr = 0; curr < max; curr++) {
		var _tokens_meta$curr;
		const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
		if (delimiters) postProcess$1(state, delimiters);
	}
}
var strikethrough_default = {
	tokenize: strikethrough_tokenize,
	postProcess: strikethrough_postProcess
};
function emphasis_tokenize(state, silent) {
	const start = state.pos;
	const marker = state.src.charCodeAt(start);
	if (silent) return false;
	if (marker !== 95 && marker !== 42) return false;
	const scanned = state.scanDelims(state.pos, marker === 42);
	for (let i = 0; i < scanned.length; i++) {
		const token = state.push("text", "", 0);
		token.content = String.fromCharCode(marker);
		state.delimiters.push({
			marker,
			length: scanned.length,
			token: state.tokens.length - 1,
			end: -1,
			open: scanned.can_open,
			close: scanned.can_close
		});
	}
	state.pos += scanned.length;
	return true;
}
function postProcess(state, delimiters) {
	const max = delimiters.length;
	for (let i = max - 1; i >= 0; i--) {
		const startDelim = delimiters[i];
		if (startDelim.marker !== 95 && startDelim.marker !== 42) continue;
		if (startDelim.end === -1) continue;
		const endDelim = delimiters[startDelim.end];
		const isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
		const ch = String.fromCharCode(startDelim.marker);
		const token_o = state.tokens[startDelim.token];
		token_o.type = isStrong ? "strong_open" : "em_open";
		token_o.tag = isStrong ? "strong" : "em";
		token_o.nesting = 1;
		token_o.markup = isStrong ? ch + ch : ch;
		token_o.content = "";
		const token_c = state.tokens[endDelim.token];
		token_c.type = isStrong ? "strong_close" : "em_close";
		token_c.tag = isStrong ? "strong" : "em";
		token_c.nesting = -1;
		token_c.markup = isStrong ? ch + ch : ch;
		token_c.content = "";
		if (isStrong) {
			state.tokens[delimiters[i - 1].token].content = "";
			state.tokens[delimiters[startDelim.end + 1].token].content = "";
			i--;
		}
	}
}
function emphasis_post_process(state) {
	const tokens_meta = state.tokens_meta;
	const max = state.tokens_meta.length;
	postProcess(state, state.delimiters);
	for (let curr = 0; curr < max; curr++) {
		var _tokens_meta$curr;
		const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
		if (delimiters) postProcess(state, delimiters);
	}
}
var emphasis_default = {
	tokenize: emphasis_tokenize,
	postProcess: emphasis_post_process
};
function link(state, silent) {
	let code, label, res, ref;
	let href = "";
	let title = "";
	let start = state.pos;
	let parseReference = true;
	if (state.src.charCodeAt(state.pos) !== 91) return false;
	const oldPos = state.pos;
	const max = state.posMax;
	const labelStart = state.pos + 1;
	const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
	if (labelEnd < 0) return false;
	let pos = labelEnd + 1;
	if (pos < max && state.src.charCodeAt(pos) === 40) {
		parseReference = false;
		pos++;
		for (; pos < max; pos++) {
			code = state.src.charCodeAt(pos);
			if (!isSpace(code) && code !== 10) break;
		}
		if (pos >= max) return false;
		start = pos;
		res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
		if (res.ok) {
			href = state.md.normalizeLink(res.str);
			if (state.md.validateLink(href)) pos = res.pos;
			else href = "";
			start = pos;
			for (; pos < max; pos++) {
				code = state.src.charCodeAt(pos);
				if (!isSpace(code) && code !== 10) break;
			}
			res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
			if (pos < max && start !== pos && res.ok) {
				title = res.str;
				pos = res.pos;
				for (; pos < max; pos++) {
					code = state.src.charCodeAt(pos);
					if (!isSpace(code) && code !== 10) break;
				}
			}
		}
		if (pos >= max || state.src.charCodeAt(pos) !== 41) parseReference = true;
		pos++;
	}
	if (parseReference) {
		if (typeof state.env.references === "undefined") return false;
		if (pos < max && state.src.charCodeAt(pos) === 91) {
			start = pos + 1;
			pos = state.md.helpers.parseLinkLabel(state, pos);
			if (pos >= 0) label = state.src.slice(start, pos++);
			else pos = labelEnd + 1;
		} else pos = labelEnd + 1;
		if (!label) label = state.src.slice(labelStart, labelEnd);
		label = normalizeReference(label);
		ref = state.env.references[label];
		if (!ref) {
			state.pos = oldPos;
			return false;
		}
		href = ref.href;
		title = ref.title;
	}
	if (!silent) {
		state.pos = labelStart;
		state.posMax = labelEnd;
		const token_o = state.push("link_open", "a", 1);
		const attrs = [["href", href]];
		token_o.attrs = attrs;
		if (title) attrs.push(["title", title]);
		if (label) {
			const meta = Object.create(null);
			meta.label = label;
			token_o.meta = meta;
		}
		state.linkLevel++;
		state.md.inline.tokenize(state);
		state.linkLevel--;
		state.push("link_close", "a", -1);
	}
	state.pos = pos;
	state.posMax = max;
	return true;
}
function image(state, silent) {
	let code, content, label, pos, ref, res, title, start;
	let href = "";
	const oldPos = state.pos;
	const max = state.posMax;
	if (state.src.charCodeAt(state.pos) !== 33) return false;
	if (state.src.charCodeAt(state.pos + 1) !== 91) return false;
	const labelStart = state.pos + 2;
	const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
	if (labelEnd < 0) return false;
	pos = labelEnd + 1;
	if (pos < max && state.src.charCodeAt(pos) === 40) {
		pos++;
		for (; pos < max; pos++) {
			code = state.src.charCodeAt(pos);
			if (!isSpace(code) && code !== 10) break;
		}
		if (pos >= max) return false;
		start = pos;
		res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
		if (res.ok) {
			href = state.md.normalizeLink(res.str);
			if (state.md.validateLink(href)) pos = res.pos;
			else href = "";
		}
		start = pos;
		for (; pos < max; pos++) {
			code = state.src.charCodeAt(pos);
			if (!isSpace(code) && code !== 10) break;
		}
		res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
		if (pos < max && start !== pos && res.ok) {
			title = res.str;
			pos = res.pos;
			for (; pos < max; pos++) {
				code = state.src.charCodeAt(pos);
				if (!isSpace(code) && code !== 10) break;
			}
		} else title = "";
		if (pos >= max || state.src.charCodeAt(pos) !== 41) {
			state.pos = oldPos;
			return false;
		}
		pos++;
	} else {
		if (typeof state.env.references === "undefined") return false;
		if (pos < max && state.src.charCodeAt(pos) === 91) {
			start = pos + 1;
			pos = state.md.helpers.parseLinkLabel(state, pos);
			if (pos >= 0) label = state.src.slice(start, pos++);
			else pos = labelEnd + 1;
		} else pos = labelEnd + 1;
		if (!label) label = state.src.slice(labelStart, labelEnd);
		label = normalizeReference(label);
		ref = state.env.references[label];
		if (!ref) {
			state.pos = oldPos;
			return false;
		}
		href = ref.href;
		title = ref.title;
	}
	if (!silent) {
		content = state.src.slice(labelStart, labelEnd);
		const tokens = [];
		state.md.inline.parse(content, state.md, state.env, tokens);
		const token = state.push("image", "img", 0);
		const attrs = [["src", href], ["alt", ""]];
		token.attrs = attrs;
		token.children = tokens;
		token.content = content;
		if (title) attrs.push(["title", title]);
		if (label) {
			const meta = Object.create(null);
			meta.label = label;
			token.meta = meta;
		}
	}
	state.pos = pos;
	state.posMax = max;
	return true;
}
var EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
var AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
function autolink(state, silent) {
	let pos = state.pos;
	if (state.src.charCodeAt(pos) !== 60) return false;
	const start = state.pos;
	const max = state.posMax;
	for (;;) {
		if (++pos >= max) return false;
		const ch = state.src.charCodeAt(pos);
		if (ch === 60) return false;
		if (ch === 62) break;
	}
	const url = state.src.slice(start + 1, pos);
	if (AUTOLINK_RE.test(url)) {
		const fullUrl = state.md.normalizeLink(url);
		if (!state.md.validateLink(fullUrl)) return false;
		if (!silent) {
			const token_o = state.push("link_open", "a", 1);
			token_o.attrs = [["href", fullUrl]];
			token_o.markup = "autolink";
			token_o.info = "auto";
			const token_t = state.push("text", "", 0);
			token_t.content = state.md.normalizeLinkText(url);
			const token_c = state.push("link_close", "a", -1);
			token_c.markup = "autolink";
			token_c.info = "auto";
		}
		state.pos += url.length + 2;
		return true;
	}
	if (EMAIL_RE.test(url)) {
		const fullUrl = state.md.normalizeLink(`mailto:${url}`);
		if (!state.md.validateLink(fullUrl)) return false;
		if (!silent) {
			const token_o = state.push("link_open", "a", 1);
			token_o.attrs = [["href", fullUrl]];
			token_o.markup = "autolink";
			token_o.info = "auto";
			const token_t = state.push("text", "", 0);
			token_t.content = state.md.normalizeLinkText(url);
			const token_c = state.push("link_close", "a", -1);
			token_c.markup = "autolink";
			token_c.info = "auto";
		}
		state.pos += url.length + 2;
		return true;
	}
	return false;
}
function isLinkOpen(str) {
	return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
	return /^<\/a\s*>/i.test(str);
}
function isLetter(ch) {
	const lc = ch | 32;
	return lc >= 97 && lc <= 122;
}
function scanSpecial(state, pos) {
	const src = state.src;
	let start;
	let terminator;
	if (src.startsWith("<!--", pos)) {
		if (src.startsWith(">", pos + 4)) return pos + 5;
		if (src.startsWith("->", pos + 4)) return pos + 6;
		start = pos + 4;
		terminator = "-->";
	} else if (src.startsWith("<![CDATA[", pos)) {
		start = pos + 9;
		terminator = "]]>";
	} else if (src.charCodeAt(pos + 1) === 63) {
		start = pos + 2;
		terminator = "?>";
	} else if (isLetter(src.charCodeAt(pos + 2))) {
		start = pos + 3;
		terminator = ">";
	} else return -1;
	if (state.skipHtmlSpecial) return -1;
	const end = src.indexOf(terminator, start);
	if (end < 0) {
		state.skipHtmlSpecial = true;
		return -1;
	}
	return end + terminator.length;
}
function html_inline(state, silent) {
	if (!state.md.options.html) return false;
	const max = state.posMax;
	const pos = state.pos;
	if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max) return false;
	let end;
	const ch = state.src.charCodeAt(pos + 1);
	if (ch === 33 || ch === 63) end = scanSpecial(state, pos);
	else if (ch === 47 || isLetter(ch)) {
		const match = state.src.slice(pos).match(HTML_OPEN_CLOSE_TAG_RE);
		end = match ? pos + match[0].length : -1;
	} else return false;
	if (end < 0) return false;
	if (!silent) {
		const token = state.push("html_inline", "", 0);
		token.content = state.src.slice(pos, end);
		if (isLinkOpen(token.content)) state.linkLevel++;
		if (isLinkClose(token.content)) state.linkLevel--;
	}
	state.pos = end;
	return true;
}
var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
function entity(state, silent) {
	const pos = state.pos;
	const max = state.posMax;
	if (state.src.charCodeAt(pos) !== 38) return false;
	if (pos + 1 >= max) return false;
	if (state.src.charCodeAt(pos + 1) === 35) {
		const match = state.src.slice(pos).match(DIGITAL_RE);
		if (match) {
			if (!silent) {
				const code = match[1][0].toLowerCase() === "x" ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
				const token = state.push("text_special", "", 0);
				token.content = isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(65533);
				token.markup = match[0];
				token.info = "entity";
			}
			state.pos += match[0].length;
			return true;
		}
	} else {
		const match = state.src.slice(pos).match(NAMED_RE);
		if (match) {
			const decoded = decodeHTMLStrict(match[0]);
			if (decoded !== match[0]) {
				if (!silent) {
					const token = state.push("text_special", "", 0);
					token.content = decoded;
					token.markup = match[0];
					token.info = "entity";
				}
				state.pos += match[0].length;
				return true;
			}
		}
	}
	return false;
}
function processDelimiters(delimiters) {
	const openersBottom = {};
	const max = delimiters.length;
	if (!max) return;
	let headerIdx = 0;
	let lastTokenIdx = -2;
	const jumps = [];
	for (let closerIdx = 0; closerIdx < max; closerIdx++) {
		const closer = delimiters[closerIdx];
		jumps.push(0);
		if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) headerIdx = closerIdx;
		lastTokenIdx = closer.token;
		closer.length = closer.length || 0;
		if (!closer.close) continue;
		if (!openersBottom.hasOwnProperty(closer.marker)) openersBottom[closer.marker] = [
			-1,
			-1,
			-1,
			-1,
			-1,
			-1
		];
		const minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
		let openerIdx = headerIdx - jumps[headerIdx] - 1;
		let newMinOpenerIdx = openerIdx;
		for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
			const opener = delimiters[openerIdx];
			if (opener.marker !== closer.marker) continue;
			if (opener.open && opener.end < 0) {
				let isOddMatch = false;
				if (opener.close || closer.open) {
					if ((opener.length + closer.length) % 3 === 0) {
						if (opener.length % 3 !== 0 || closer.length % 3 !== 0) isOddMatch = true;
					}
				}
				if (!isOddMatch) {
					const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
					jumps[closerIdx] = closerIdx - openerIdx + lastJump;
					jumps[openerIdx] = lastJump;
					closer.open = false;
					opener.end = closerIdx;
					opener.close = false;
					newMinOpenerIdx = -1;
					lastTokenIdx = -2;
					break;
				}
			}
		}
		if (newMinOpenerIdx !== -1) openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
	}
}
function link_pairs(state) {
	const tokens_meta = state.tokens_meta;
	const max = state.tokens_meta.length;
	processDelimiters(state.delimiters);
	for (let curr = 0; curr < max; curr++) {
		var _tokens_meta$curr;
		const delimiters = (_tokens_meta$curr = tokens_meta[curr]) === null || _tokens_meta$curr === void 0 ? void 0 : _tokens_meta$curr.delimiters;
		if (delimiters) processDelimiters(delimiters);
	}
}
function fragments_join(state) {
	let curr, last;
	let level = 0;
	const tokens = state.tokens;
	const max = state.tokens.length;
	for (curr = last = 0; curr < max; curr++) {
		if (tokens[curr].nesting < 0) level--;
		tokens[curr].level = level;
		if (tokens[curr].nesting > 0) level++;
		if (tokens[curr].type === "text" && curr + 1 < max && tokens[curr + 1].type === "text") tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
		else {
			if (curr !== last) tokens[last] = tokens[curr];
			last++;
		}
	}
	if (curr !== last) tokens.length = last;
}
var _rules = [
	["text", text],
	["linkify", linkify],
	["newline", newline],
	["escape", escape],
	["backticks", backtick],
	["strikethrough", strikethrough_default.tokenize],
	["emphasis", emphasis_default.tokenize],
	["link", link],
	["image", image],
	["autolink", autolink],
	["html_inline", html_inline],
	["entity", entity]
];
var _rules2 = [
	["balance_pairs", link_pairs],
	["strikethrough", strikethrough_default.postProcess],
	["emphasis", emphasis_default.postProcess],
	["fragments_join", fragments_join]
];
/**
* Tokenizes paragraph content.
*/
var ParserInline = class {
	constructor() {
		_defineProperty(
			this,
			/**
			* {@link Ruler} instance. Keep configuration of inline rules.
			*/
			"ruler",
			new Ruler()
		);
		_defineProperty(
			this,
			/**
			* {@link Ruler} instance. Second ruler used for post-processing
			* (e.g. in emphasis-like rules).
			*/
			"ruler2",
			new Ruler()
		);
		_defineProperty(this, "State", StateInline);
		for (let i = 0; i < _rules.length; i++) this.ruler.push(_rules[i][0], _rules[i][1]);
		for (let i = 0; i < _rules2.length; i++) this.ruler2.push(_rules2[i][0], _rules2[i][1]);
	}
	skipToken(state) {
		const pos = state.pos;
		const rules = this.ruler.getRules("");
		const len = rules.length;
		const maxNesting = state.md.options.maxNesting;
		const cache = state.cache;
		if (typeof cache[pos] !== "undefined") {
			state.pos = cache[pos];
			return;
		}
		let ok = false;
		if (state.level < maxNesting) for (let i = 0; i < len; i++) {
			state.level++;
			ok = rules[i](state, true);
			state.level--;
			if (ok) {
				if (pos >= state.pos) throw new Error("inline rule didn't increment state.pos");
				break;
			}
		}
		else state.pos = state.posMax;
		if (!ok) state.pos++;
		cache[pos] = state.pos;
	}
	tokenize(state) {
		const rules = this.ruler.getRules("");
		const len = rules.length;
		const end = state.posMax;
		const maxNesting = state.md.options.maxNesting;
		while (state.pos < end) {
			const prevPos = state.pos;
			let ok = false;
			if (state.level < maxNesting) for (let i = 0; i < len; i++) {
				ok = rules[i](state, false);
				if (ok) {
					if (prevPos >= state.pos) throw new Error("inline rule didn't increment state.pos");
					break;
				}
			}
			if (ok) {
				if (state.pos >= end) break;
				continue;
			}
			state.pending += state.src[state.pos++];
		}
		if (state.pending) state.pushPending();
	}
	/**
	* Process input string and push inline tokens into `outTokens`
	*/
	parse(str, md, env, outTokens) {
		const state = new this.State(str, md, env, outTokens);
		this.tokenize(state);
		const rules = this.ruler2.getRules("");
		const len = rules.length;
		for (let i = 0; i < len; i++) rules[i](state);
	}
};
var config = {
	default: {
		options: {
			html: false,
			xhtmlOut: false,
			breaks: false,
			langPrefix: "language-",
			linkify: false,
			typographer: false,
			quotes: "“”‘’",
			highlight: null,
			maxNesting: 100
		},
		components: {
			core: {},
			block: {},
			inline: {}
		}
	},
	zero: {
		options: {
			html: false,
			xhtmlOut: false,
			breaks: false,
			langPrefix: "language-",
			linkify: false,
			typographer: false,
			quotes: "“”‘’",
			highlight: null,
			maxNesting: 20
		},
		components: {
			core: { rules: [
				"normalize",
				"block",
				"strip_references",
				"inline",
				"text_join"
			] },
			block: { rules: ["paragraph"] },
			inline: {
				rules: ["text"],
				rules2: ["balance_pairs", "fragments_join"]
			}
		}
	},
	commonmark: {
		options: {
			html: true,
			xhtmlOut: true,
			breaks: false,
			langPrefix: "language-",
			linkify: false,
			typographer: false,
			quotes: "“”‘’",
			highlight: null,
			maxNesting: 20
		},
		components: {
			core: { rules: [
				"normalize",
				"block",
				"strip_references",
				"inline",
				"text_join"
			] },
			block: { rules: [
				"blockquote",
				"code",
				"fence",
				"heading",
				"hr",
				"html_block",
				"lheading",
				"list",
				"reference",
				"paragraph"
			] },
			inline: {
				rules: [
					"autolink",
					"backticks",
					"emphasis",
					"entity",
					"escape",
					"html_inline",
					"image",
					"link",
					"newline",
					"text"
				],
				rules2: [
					"balance_pairs",
					"emphasis",
					"fragments_join"
				]
			}
		}
	}
};
var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
var RECODE_HOSTNAME_FOR = [
	"http:",
	"https:",
	"mailto:"
];
/**
* Parses Markdown into tokens and renders them to HTML.
*
* @category Main
*/
var MarkdownIt = class {
	/**
	* Link validation function. CommonMark allows too much in links. By default
	* we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
	* except some embedded image types.
	*
	* You can change this behaviour:
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	* const md = new MarkdownIt()
	*
	* // enable everything
	* md.validateLink = function () { return true; }
	* ```
	*/
	validateLink(url) {
		const str = url.trim().toLowerCase();
		return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
	}
	/**
	* Function used to encode link url to a machine-readable format,
	* which includes url-encoding, punycode, etc.
	*/
	normalizeLink(url) {
		const parsed = urlParse(url, true);
		if (parsed.hostname) {
			if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
				parsed.hostname = import_punycode.default.toASCII(parsed.hostname);
			} catch (er) {}
		}
		if (parsed.auth) parsed.auth = encode(parsed.auth);
		if (parsed.hostname) parsed.hostname = encode(parsed.hostname);
		if (parsed.pathname) parsed.pathname = encode(parsed.pathname);
		if (parsed.search) parsed.search = encode(parsed.search);
		if (parsed.hash) parsed.hash = encode(parsed.hash);
		return format(parsed);
	}
	/**
	* Function used to decode link url to a human-readable format`
	*/
	normalizeLinkText(url) {
		const parsed = urlParse(url, true);
		if (parsed.hostname) {
			if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) try {
				parsed.hostname = import_punycode.default.toUnicode(parsed.hostname);
			} catch (er) {}
		}
		return decode(format(parsed), decode.defaultChars + "%");
	}
	constructor(...args) {
		_defineProperty(
			this,
			/**
			* Instance of {@link ParserInline}. You may need it to add new rules when
			* writing plugins. For simple rules control use {@link MarkdownIt.disable}
			* and {@link MarkdownIt.enable}.
			*/
			"inline",
			new ParserInline()
		);
		_defineProperty(
			this,
			/**
			* Instance of {@link ParserBlock}. You may need it to add new rules when
			* writing plugins. For simple rules control use {@link MarkdownIt.disable}
			* and {@link MarkdownIt.enable}.
			*/
			"block",
			new ParserBlock()
		);
		_defineProperty(
			this,
			/**
			* Instance of {@link ParserCore} chain executor. You may need it to add new
			* rules when writing plugins. For simple rules control use
			* {@link MarkdownIt.disable} and {@link MarkdownIt.enable}.
			*/
			"core",
			new ParserCore()
		);
		_defineProperty(
			this,
			/**
			* Instance of {@link Renderer}. Use it to modify output look. Or to add rendering
			* rules for new token types, generated by plugins.
			*
			* See {@link Renderer} docs and
			* [source code](https://github.com/markdown-it/markdown-it/blob/master/src/renderer.ts).
			*
			* @example
			* ```javascript
			* import MarkdownIt from 'markdown-it'
			* const md = new MarkdownIt()
			*
			* function myToken(tokens, idx, options, env, self) {
			*   //...
			*   return result;
			* };
			*
			* md.renderer.rules['my_token'] = myToken
			* ```
			*/
			"renderer",
			new Renderer()
		);
		_defineProperty(
			this,
			/**
			* [linkify-it](https://github.com/markdown-it/linkify-it) instance.
			* Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/src/rules_core/linkify.ts)
			* rule.
			*/
			"linkify",
			new LinkifyIt()
		);
		_defineProperty(
			this,
			/**
			* Assorted utility functions, useful to write plugins. See details
			* [here](https://github.com/markdown-it/markdown-it/blob/master/src/common/utils.ts).
			*/
			"utils",
			utils_exports
		);
		_defineProperty(
			this,
			/**
			* Link components parser functions, useful to write plugins. See details
			* [here](https://github.com/markdown-it/markdown-it/blob/master/src/helpers).
			*/
			"helpers",
			Object.assign({}, helpers_exports)
		);
		const [presetNameOrOptions, options] = args;
		if (typeof presetNameOrOptions === "string") {
			this.configure(presetNameOrOptions);
			if (options) this.set(options);
		} else {
			this.configure("default");
			this.set(presetNameOrOptions || {});
		}
	}
	/**
	* Set parser options (in the same format as in constructor). Probably, you
	* will never need it, but you can change options after constructor call.
	*
	* __Note:__ To achieve the best possible performance, don't modify a
	* `markdown-it` instance options on the fly. If you need multiple configurations
	* it's best to create multiple instances and initialize each with separate
	* config.
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	*
	* const md = new MarkdownIt()
	*   .set({ html: true, breaks: true })
	*   .set({ typographer: true })
	* ```
	*/
	set(options) {
		Object.assign(this.options, options);
		return this;
	}
	/**
	* Batch load of all options and compenent settings. This is internal method,
	* and you probably will not need it. But if you will - see available presets
	* and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/src/presets)
	*
	* We strongly recommend to use presets instead of direct config loads. That
	* will give better compatibility with next versions.
	*/
	configure(presets) {
		let p;
		if (typeof presets === "string") {
			const presetName = presets;
			p = config[presetName];
			if (!p) throw new Error(`Wrong 'markdown-it' preset "${presetName}", check name`);
		} else p = presets;
		if (!p) throw new Error("Wrong `markdown-it` preset, can't be empty");
		if (p.options) this.options = { ...p.options };
		const components = p.components;
		if (components) {
			var _components$inline;
			[
				"core",
				"block",
				"inline"
			].forEach((name) => {
				var _components$name;
				const rules = (_components$name = components[name]) === null || _components$name === void 0 ? void 0 : _components$name.rules;
				if (rules) this[name].ruler.enableOnly(rules);
			});
			const rules2 = (_components$inline = components.inline) === null || _components$inline === void 0 ? void 0 : _components$inline.rules2;
			if (rules2) this.inline.ruler2.enableOnly(rules2);
		}
		return this;
	}
	/**
	* Enable list or rules. It will automatically find appropriate components,
	* containing rules with given names. If rule not found, and `ignoreInvalid`
	* not set - throws exception.
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	*
	* const md = new MarkdownIt()
	*   .enable(['sub', 'sup'])
	*   .disable('smartquotes')
	* ```
	*/
	enable(list, ignoreInvalid = false) {
		let result = [];
		if (!Array.isArray(list)) list = [list];
		[
			"core",
			"block",
			"inline"
		].forEach((chain) => {
			result = result.concat(this[chain].ruler.enable(list, true));
		});
		result = result.concat(this.inline.ruler2.enable(list, true));
		const missed = list.filter((name) => result.indexOf(name) < 0);
		if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to enable unknown rule(s): ${missed}`);
		return this;
	}
	/**
	* The same as {@link MarkdownIt.enable}, but turn specified rules off.
	*/
	disable(list, ignoreInvalid = false) {
		let result = [];
		if (!Array.isArray(list)) list = [list];
		[
			"core",
			"block",
			"inline"
		].forEach((chain) => {
			result = result.concat(this[chain].ruler.disable(list, true));
		});
		result = result.concat(this.inline.ruler2.disable(list, true));
		const missed = list.filter((name) => result.indexOf(name) < 0);
		if (missed.length && !ignoreInvalid) throw new Error(`MarkdownIt. Failed to disable unknown rule(s): ${missed}`);
		return this;
	}
	/**
	* Load specified plugin with given params into current parser instance.
	* It's just a sugar to call `plugin(md, params)` with curring.
	*
	* @example
	* ```javascript
	* import MarkdownIt from 'markdown-it'
	* import iterator from 'markdown-it-for-inline'
	*
	* const md = new MarkdownIt()
	*   .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
	*     tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar')
	*   })
	* ```
	*/
	use(plugin, ...params) {
		plugin.apply(plugin, [this, ...params]);
		return this;
	}
	/**
	* Parse input string and return list of block tokens (special token type
	* "inline" will contain list of inline tokens). You should not call this
	* method directly, until you write custom renderer (for example, to produce
	* AST).
	*
	* `env` is used to pass data between "distributed" rules and return additional
	* metadata like reference info, needed for the renderer. It also can be used to
	* inject data in specific cases. Usually, you will be ok to pass `{}`,
	* and then pass updated object to renderer.
	*/
	parse(src, env) {
		if (typeof src !== "string") throw new Error("Input data should be a String");
		const state = new this.core.State(src, this, env);
		this.core.process(state);
		return state.tokens;
	}
	/**
	* Render markdown string into html. It does all magic for you :).
	*
	* `env` can be used to inject additional metadata (`{}` by default).
	* But you will not need it with high probability. See also comment
	* in {@link MarkdownIt.parse}.
	*/
	render(src, env = {}) {
		return this.renderer.render(this.parse(src, env), this.options, env);
	}
	/**
	* The same as {@link MarkdownIt.parse} but skip all block rules. It returns
	* the block tokens list with the single `inline` element, containing parsed
	* inline tokens in `children` property. Also updates `env` object.
	*/
	parseInline(src, env) {
		const state = new this.core.State(src, this, env);
		state.inlineMode = true;
		this.core.process(state);
		return state.tokens;
	}
	/**
	* Similar to {@link MarkdownIt.render} but for single paragraph content.
	* Result will NOT be wrapped into `<p>` tags.
	*/
	renderInline(src, env = {}) {
		return this.renderer.render(this.parseInline(src, env), this.options, env);
	}
};
_defineProperty(MarkdownIt, "Token", Token);
_defineProperty(MarkdownIt, "Ruler", Ruler);
_defineProperty(MarkdownIt, "Renderer", Renderer);
_defineProperty(MarkdownIt, "ParserCore", ParserCore);
_defineProperty(MarkdownIt, "StateCore", StateCore);
_defineProperty(MarkdownIt, "ParserBlock", ParserBlock);
_defineProperty(MarkdownIt, "StateBlock", StateBlock);
_defineProperty(MarkdownIt, "ParserInline", ParserInline);
_defineProperty(MarkdownIt, "StateInline", StateInline);
//#endregion
//#region src/session-page.mjs
/**
* 会话快照 → 自包含只读 HTML。
*
* 设计约束：产物是**纯静态**（无脚本、无外链），所以它既能进隧道，也能直接
* 发给别人离线打开；同时把「JS 能不能执行」这一整类风险从分享面里去掉。
*
* @module dsh-share-link/session-page
*/
/**
* `.md` 分享专用的渲染器。
*
* 与 `renderBody`（会话正文）刻意分开：助手输出不该被当成 HTML 解释——那会把
* 「模型随手写了个 `<div>`」变成页面结构。而 README 这类产物是用户自己写的
* 文件，`<h1 align="center">`、徽章、`<details>` 必须照原样呈现，否则整块会变成
* 一行转义文本（实测就是这么坏的）。
*
* 渲染结果仍然过 `sanitizeHtml`：允许排版标签，不允许脚本、样式与表单。
*/
const DOC_MD = new (callable(MarkdownIt))({
	html: true,
	linkify: true,
	breaks: false
});
DOC_MD.renderer.rules.fence = (tokens, index) => {
	const token = tokens[index];
	const lang = token.info.trim().split(/\s+/)[0] ?? "";
	const code = escapeHtml(token.content.replace(/\n$/, ""));
	return `<div class="code"><div class="code-bar"><span>${escapeHtml(lang === "" ? "code" : lang)}</span><button type="button" data-copy="code">复制</button></div><pre><code data-lang="${escapeHtml(lang)}">${code}</code></pre></div>`;
};
/**
* 允许出现在分享页里的标签：GitHub README 的常见排版集合。
*
* 显式不含 `script` / `style` / `iframe` / `object` / `embed` / `form` / `input`：
* 分享页是别人打开的只读页面，唯一允许执行的脚本是插件自己的复制按钮。
*/
const ALLOWED_TAGS = /* @__PURE__ */ new Set([
	"a",
	"abbr",
	"b",
	"big",
	"blockquote",
	"br",
	"button",
	"caption",
	"center",
	"code",
	"dd",
	"del",
	"details",
	"div",
	"dl",
	"dt",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"ins",
	"kbd",
	"li",
	"mark",
	"ol",
	"p",
	"picture",
	"pre",
	"s",
	"small",
	"source",
	"span",
	"strong",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
	"video",
	"audio"
]);
/** 自闭合标签：`<br>` 这类不需要（也不允许）配对。 */
const VOID_TAGS = /* @__PURE__ */ new Set([
	"br",
	"hr",
	"img",
	"source",
	"wbr"
]);
/** 允许保留的属性；`on*` 一律不在名单里，所以事件处理器会被丢掉。 */
const ALLOWED_ATTRS = /* @__PURE__ */ new Set([
	"align",
	"alt",
	"class",
	"colspan",
	"controls",
	"data-copy",
	"data-lang",
	"height",
	"href",
	"loading",
	"poster",
	"rowspan",
	"src",
	"start",
	"title",
	"type",
	"valign",
	"width"
]);
/** 需要校验协议的属性（`javascript:` 之类必须挡掉）。 */
const URL_ATTRS = /* @__PURE__ */ new Set([
	"href",
	"src",
	"poster"
]);
/**
* 过滤一段 HTML：只留白名单标签与属性。
*
* 这是**字符串级**过滤，不是 HTML 解析器——够用是因为输入只来自 markdown-it 的
* 输出（结构已知、文本已转义），而它要挡的东西很具体：脚本、内联事件、
* `javascript:` 协议、以及 `<style>` 这类能整页变形的块。
*
* @param {string} html
* @returns {string}
*/
function sanitizeHtml(html) {
	return String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|iframe|object|embed|form|textarea|template)\b[\s\S]*?<\/\1\s*>/gi, "").replace(/<\/?[a-zA-Z][^>]*>/g, (tag) => filterTag(tag));
}
/** @param {string} tag @returns {string} */
function filterTag(tag) {
	const inner = tag.replace(/>$/, "").replace(/^</, "");
	const body = inner.endsWith("/") ? inner.slice(0, -1) : inner;
	const nameMatch = /^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(body);
	if (nameMatch === null) return "";
	const name = nameMatch[1].toLowerCase();
	if (!ALLOWED_TAGS.has(name)) return "";
	if (body.startsWith("/")) return VOID_TAGS.has(name) ? "" : `</${name}>`;
	const attributes = [];
	for (const match of body.slice(nameMatch[0].length).matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
		const key = match[1].toLowerCase();
		const value = match[2] ?? match[3] ?? match[4];
		if (!ALLOWED_ATTRS.has(key)) continue;
		if (value === void 0) {
			attributes.push(key);
			continue;
		}
		if (URL_ATTRS.has(key) && !isSafeUrl(value)) continue;
		attributes.push(`${key}="${value}"`);
	}
	return `<${name}${attributes.length === 0 ? "" : ` ${attributes.join(" ")}`}>`;
}
/**
* 只放行 http(s) / mailto / 站内相对路径 / `data:image/*`。
* @param {string} value
* @returns {boolean}
*/
function isSafeUrl(value) {
	const url = value.trim().toLowerCase();
	if (url === "") return false;
	const scheme = /^([a-z][a-z0-9+.-]*):/.exec(url);
	if (scheme === null) return true;
	if (scheme[1] === "http" || scheme[1] === "https" || scheme[1] === "mailto") return true;
	return scheme[1] === "data" && url.startsWith("data:image/");
}
/**
* 把发布时抓下来的公网图片（`{url: dataUri}`）替换进 `<img src>`。
*
* 放在 sanitize 之后做：data URI 是我们自己构造的、字节是校验过的图片内容，
* 不需要再过一遍白名单；而不替换就等于页面要去外网加载图片，破坏「离线可读」。
*
* @param {string} html
* @param {Map<string, string>} [images]
* @returns {string}
*/
function substituteImages(html, images) {
	if (!(images instanceof Map) || images.size === 0) return html;
	let output = html;
	for (const [url, dataUri] of images) {
		output = output.split(`src="${url}"`).join(`src="${dataUri}"`);
		output = output.split(`src="${escapeHtml(url)}"`).join(`src="${dataUri}"`);
	}
	return output;
}
/** 正文里会被脱敏的凭据形态。顺序有意义：先长 token，再泛化键值对。 */
const SECRET_RULES = [
	[/\b(sk|rk)-[A-Za-z0-9_-]{16,}\b/g, "$1-***"],
	[/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "gh*_***"],
	[/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "github_pat_***"],
	[/\bAKIA[0-9A-Z]{16}\b/g, "AKIA***"],
	[/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{12,}=*/g, "$1 ***"],
	[/((?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[:=]\s*)["']?[^\s"'`,;]{8,}/gi, "$1***"]
];
/** 把绝对家目录压成 `~`：分享页里出现 `/Users/xxx` 等于泄露用户名。 */
function scrubHomePaths(text) {
	return text.replace(/(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)(?=[/\\\s"'`]|$)/g, "~").replace(/[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/g, "~");
}
/** 复制按钮的最小内联脚本：只做剪贴板，不发任何外部请求。 */
const STAR_URL = "https://github.com/vlln/dsh-share-link";
const COPY_SCRIPT = `<script>
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');
  if (button === null) return;
  const kind = button.dataset.copy;
  const payload = kind === 'link'
    ? location.href
    : kind === 'content'
      ? (document.querySelector('[data-copy-source]')?.innerText ?? '').trim()
      : (button.closest('.code')?.querySelector('pre')?.innerText ?? '');
  try {
    await navigator.clipboard.writeText(payload);
    button.dataset.done = '1';
    setTimeout(() => { delete button.dataset.done; }, 1400);
  } catch {}
});
<\/script>`;
const PAGE_CSS = `  :root {
    color-scheme: light dark;
    --bg: #f6f5f2; --paper: #fffefc; --fg: #1b1b1f; --muted: #6e6e78;
    --line: #e7e4dd; --code-bg: #f4f2ee; --accent: #3f5bd9; --star: #8a6d1f;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #121215; --paper: #17171b; --fg: #eaeaef; --muted: #9a9aa5;
      --line: #29292f; --code-bg: #1e1e24; --accent: #94a3f5; --star: #d8b45a;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--fg); }
  body {
    font: 15.5px/1.8 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .bar {
    position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px;
    height: 46px; padding: 0 20px;
    background: color-mix(in srgb, var(--bg) 86%, transparent);
    backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .bar .brand { font-size: 12.5px; font-weight: 600; letter-spacing: .01em; }
  .bar .tag {
    font-size: 11px; color: var(--muted); padding: 2px 7px; border-radius: 999px;
    border: 1px solid var(--line); background: var(--paper);
  }
  .bar .spacer { flex: 1; }
  .bar [data-copy] { font-size: 12px; }

  button[data-copy] {
    font: inherit; font-size: 12px; height: 24px; padding: 0 4px; cursor: pointer;
    border: 0; background: transparent; color: var(--muted);
    transition: color .15s;
  }
  button[data-copy]:hover { color: var(--fg); }
  button[data-copy][data-done] { color: #1f9d63; }
  button[data-copy][data-done]::after { content: ' ✓'; }

  main { max-width: 720px; margin: 0 auto; padding: 44px 22px 40px; }

  h1 {
    font-size: 25px; line-height: 1.35; font-weight: 650; letter-spacing: -0.015em;
    margin: 0 0 10px;
  }
  .subline { display: flex; align-items: center; gap: 12px; margin: 0 0 4px; }
  .subline .grow { flex: 1; }
  .meta { margin: 0; font-size: 12.5px; line-height: 1.7; color: var(--muted); }
  .meta code { font: 11.5px/1.5 ui-monospace, Menlo, monospace; color: var(--muted); }
  .rule { height: 1px; background: var(--line); margin: 26px 0 30px; border: 0; }

  .msg { margin: 0 0 26px; }
  .msg.user { display: flex; justify-content: flex-end; }
  .msg.user .bubble {
    max-width: 78%; padding: 10px 15px; border-radius: 16px 16px 5px 16px;
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    color: var(--fg); overflow-wrap: anywhere;
  }
  .msg.assistant .text { overflow-wrap: anywhere; }
  .msg .text > :first-child, .msg .bubble > :first-child { margin-top: 0; }
  .msg .text > :last-child, .msg .bubble > :last-child { margin-bottom: 0; }
  .msg.assistant .foot {
    display: flex; align-items: center; gap: 10px; margin-top: 10px;
    font-size: 11.5px; color: var(--muted);
  }
  .msg.assistant .foot button {
    border: 0; background: transparent; padding: 0; cursor: pointer;
    font: inherit; font-size: 11.5px; color: var(--muted);
    opacity: .55; transition: opacity .15s ease;
  }
  .msg.assistant:hover .foot button, .msg.assistant .foot button:focus-visible { opacity: 1; }
  .msg.assistant .foot button:hover { color: var(--fg); text-decoration: underline; }
  .msg.assistant .foot button[data-done] { color: #1f9d63; opacity: 1; }

  .body p { margin: 0 0 12px; }
  .body h1, .body h2, .body h3, .body h4, .body h5, .body h6 { margin: 22px 0 10px; line-height: 1.4; letter-spacing: -0.01em; }
  .body h1 { font-size: 20px; } .body h2 { font-size: 18px; } .body h3 { font-size: 16px; }
  .body h4, .body h5, .body h6 { font-size: 15px; }
  .body ul, .body ol { margin: 8px 0 14px; padding-left: 22px; }
  .body li { margin: 4px 0; }
  .body blockquote { margin: 12px 0; padding: 2px 0 2px 14px; border-left: 2px solid var(--line); color: var(--muted); }
  .body hr { border: 0; border-top: 1px solid var(--line); margin: 20px 0; }
  .body a { color: var(--accent); }

  .code { margin: 14px 0; border-radius: 10px; overflow: hidden; background: var(--code-bg); }
  .code-bar {
    display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 12px;
    font: 11px/1.8 ui-monospace, Menlo, monospace; color: var(--muted);
  }
  .code-bar span { flex: 1; }
  .code-bar button[data-copy] { font-family: inherit; }
  .code pre { margin: 0; padding: 2px 14px 14px; overflow-x: auto; }
  pre code { font: 13px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace; }
  :not(pre) > code {
    font: 13px/1.5 ui-monospace, Menlo, monospace; background: var(--code-bg);
    padding: 1.5px 5px; border-radius: 5px;
  }

  .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tool {
    font: 11px/1 ui-monospace, Menlo, monospace; color: var(--muted);
    border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px;
  }

  footer {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    margin-top: 34px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--muted);
  }
  footer .grow { flex: 1; }
  footer a { color: var(--muted); text-underline-offset: 2px; }
  footer a:hover { color: var(--fg); }
  footer .star { color: var(--star); text-decoration: none; font-weight: 600; }
  footer .star:hover { text-decoration: underline; }

  @media print {
    .bar { display: none; }
    main { max-width: none; padding: 0; }
    .turn { break-inside: avoid; }
    body { background: #fff; }
  }`;
/**
* 对一段正文做尽力脱敏。**不是保证**：只挡常见凭据形态与家目录，
* 挡不住业务机密、客户名、内网 IP。
* @param {string} text - 原始文本。
* @returns {string} 脱敏后的文本。
*/
function redact(text) {
	let out = scrubHomePaths(String(text ?? ""));
	for (const [pattern, replacement] of SECRET_RULES) out = out.replace(pattern, replacement);
	return out;
}
const THEME_CSS = {
	paper: `:root {
    --bg: #f6f5f2; --paper: #fffefc; --fg: #1b1b1f; --muted: #6e6e78;
    --line: #e7e4dd; --code-bg: #f4f2ee; --accent: #3f5bd9; --star: #8a6d1f;
  }`,
	github: `:root {
    --bg: #ffffff; --paper: #ffffff; --fg: #1f2328; --muted: #59636e;
    --line: #d1d9e0; --code-bg: #f6f8fa; --accent: #0969da; --star: #9a6700;
  }
  body { font-size: 15px; line-height: 1.7; }
  h1 { font-size: 24px; font-weight: 600; letter-spacing: 0; }
  .bar { background: #ffffff; border-bottom-color: #d1d9e0; }
  .tag { border-color: #d1d9e0; background: #ffffff; }
  .turn.user .body { border-left-width: 4px; }`,
	notion: `:root {
    --bg: #ffffff; --paper: #ffffff; --fg: #37352f; --muted: #787774;
    --line: #e9e9e7; --code-bg: #f7f6f3; --accent: #2383e2; --star: #b07d00;
  }
  body { font-size: 16px; line-height: 1.75; }
  h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  .bar { border-bottom: 0; background: #ffffff; }
  .tag { border: 0; background: #f1f0ee; }
  footer { border-top: 0; }`,
	sepia: `:root {
    --bg: #f4ecd8; --paper: #f7f0df; --fg: #3b2f22; --muted: #7a6a55;
    --line: #ded1b6; --code-bg: #efe6d0; --accent: #8a5a2b; --star: #8a5a2b;
  }
  body {
    font-family: Georgia, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif;
    font-size: 17px; line-height: 1.95;
  }
  h1 { font-size: 28px; font-weight: 600; letter-spacing: 0; }
  .bar { background: #f7f0df; border-bottom-color: #ded1b6; }
  .tag { background: #f7f0df; border-color: #ded1b6; }`,
	terminal: `:root {
    --bg: #0d1117; --paper: #0d1117; --fg: #c9d1d9; --muted: #8b949e;
    --line: #21262d; --code-bg: #161b22; --accent: #3fb950; --star: #d29922;
    color-scheme: dark;
  }
  body {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 14px; line-height: 1.8;
  }
  h1 { font-size: 22px; font-weight: 600; letter-spacing: 0; }
  .bar { background: #0d1117; border-bottom-color: #21262d; }
  .tag { background: #161b22; border-color: #21262d; }`
};
/**
* 生成某个风格的 CSS：预设变量 + 用户自定义覆盖（自定义永远最后生效）。
* @param {string} [name]
* @param {string} [custom]
* @returns {string}
*/
function themeCss(name, custom = "") {
	const base = THEME_CSS[name] ?? THEME_CSS.paper;
	const safe = String(custom ?? "").replace(/<\/style/gi, "<\\/style");
	return safe.trim() === "" ? base : `${base}\n/* 自定义 */\n${safe}`;
}
/** @param {string} value */
function escapeHtml(value) {
	return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
/** 行内格式：行内代码、粗体、斜体。先转义再套标签。 */
function inline(text) {
	return escapeHtml(text).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}
/**
* 极简 Markdown 渲染：标题、无序/有序列表、引用、分隔线、代码围栏、
* 行内代码/粗体/斜体、段落。不引第三方库——分享页要能离线打开。
* @param {string} text - 已脱敏的正文。
* @returns {string} HTML 片段。
*/
function renderBody(text) {
	const chunks = String(text).split(/```/);
	const out = [];
	for (let i = 0; i < chunks.length; i += 1) {
		if (i % 2 === 1) {
			const chunk = chunks[i];
			const newline = chunk.indexOf("\n");
			const lang = newline === -1 ? "" : chunk.slice(0, newline).trim();
			const code = newline === -1 ? chunk : chunk.slice(newline + 1);
			out.push(`<div class="code"><div class="code-bar"><span>${escapeHtml(lang === "" ? "code" : lang)}</span><button type="button" data-copy="code">复制</button></div><pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.replace(/\n$/, ""))}</code></pre></div>`);
			continue;
		}
		out.push(renderBlocks(chunks[i]));
	}
	return out.join("\n");
}
/** @param {string} chunk */
function renderBlocks(chunk) {
	const lines = chunk.split("\n");
	const out = [];
	let index = 0;
	const isBlank = (line) => line.trim() === "";
	while (index < lines.length) {
		const line = lines[index];
		if (isBlank(line)) {
			index += 1;
			continue;
		}
		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading !== null) {
			const level = heading[1].length;
			out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
			index += 1;
			continue;
		}
		if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
			out.push("<hr>");
			index += 1;
			continue;
		}
		if (/^\s*[-*+]\s+/.test(line)) {
			const items = [];
			while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
				items.push(`<li>${inline(lines[index].replace(/^\s*[-*+]\s+/, ""))}</li>`);
				index += 1;
			}
			out.push(`<ul>${items.join("")}</ul>`);
			continue;
		}
		if (/^\s*\d+[.)]\s+/.test(line)) {
			const items = [];
			while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
				items.push(`<li>${inline(lines[index].replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
				index += 1;
			}
			out.push(`<ol>${items.join("")}</ol>`);
			continue;
		}
		if (/^\s*>\s?/.test(line)) {
			const quoted = [];
			while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
				quoted.push(lines[index].replace(/^\s*>\s?/, ""));
				index += 1;
			}
			out.push(`<blockquote>${renderBlocks(quoted.join("\n"))}</blockquote>`);
			continue;
		}
		const paragraph = [];
		while (index < lines.length && !isBlank(lines[index]) && !/^(#{1,6})\s+/.test(lines[index])) {
			paragraph.push(lines[index]);
			index += 1;
		}
		out.push(`<p>${inline(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`);
	}
	return out.join("\n");
}
function renderMessage(message) {
	const role = message.role === "user" ? "user" : "assistant";
	const time = typeof message.time === "number" ? `<time>${escapeHtml(new Date(message.time).toISOString().slice(11, 16))}</time>` : "";
	const tools = role === "assistant" && Array.isArray(message.tools) && message.tools.length > 0 ? `<div class="tools">${message.tools.map((tool) => `<span class="tool">${escapeHtml(tool)}</span>`).join("")}</div>` : "";
	if (role === "user") return `<div class="msg user"><div class="bubble">${renderBody(message.text)}</div></div>`;
	return `<div class="msg assistant">
  <div class="text">${renderBody(message.text)}</div>
  ${tools}
  <div class="foot"><button type="button" data-copy="message" aria-label="复制这条">复制</button>${time}</div>
</div>`;
}
/**
* 渲染一个完整的只读会话页。
*
* 版式原则（踩过的三条）：标题只出现一次；助手正文是**文档流**而不是卡片；用户消息用
* 左侧色条引文块区分。卡片叠卡片、以及 780px 行长是上一版"看起来平"的主因。
*
* @param {object} input
* @param {string} input.title - 页面标题（会话标题或用户指定）。
* @param {string} input.sessionId - 会话 id（展示与溯源）。
* @param {number} input.createdAt - 快照生成时间（epoch ms）。
* @param {Array<object>} input.messages - 已投影的消息列表。
* @returns {string} 完整 HTML 文档。
*/
function renderSessionPage(input) {
	const { title, sessionId, createdAt, messages, theme, customCss } = input;
	const stamp = new Date(createdAt).toISOString().replace("T", " ").slice(0, 16);
	const body = messages.map(renderMessage).join("\n");
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
${themeCss(theme, customCss)}
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
</header>
<main>
  <article data-copy-source>
    <h1>${escapeHtml(title)}</h1>
    <div class="subline">
      <p class="meta">${escapeHtml(stamp)} UTC · ${messages.length} 条消息</p>
      <span class="grow"></span>
      <button type="button" data-copy="content">复制全文</button>
    </div>
    <hr class="rule">
    <div class="thread">
${body}
    </div>
  </article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成 · 撤销后立即失效</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>
</main>
${COPY_SCRIPT}
</body>
</html>`;
}
/**
* 渲染一个 `.md` 产物。
*
* 走 markdown-it（服务端渲染，页面本身仍然零脚本、零外链依赖）而不是极简
* 手写渲染器：README 里的表格、图片、链接、嵌套列表都是标准 GFM，手写版
* 只覆盖了标题/列表/代码块，实际用起来整段会掉成纯文本。
*
* @param {{title: string, markdown: string, theme?: string, customCss?: string,
*   images?: Map<string, string>}} input
*   `images` 是「公网图片地址 → data: URI」：发布时抓下来的图在这里替换，
*   这样页面依然是离线可打开的。
* @returns {string} 完整 HTML。
*/
function renderMarkdownDocument(input) {
	const { title, markdown, theme, customCss, images } = input;
	const body = substituteImages(sanitizeHtml(DOC_MD.render(markdown)), images);
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
${themeCss(theme, customCss)}
  .doc h1:first-child, .doc > :first-child { margin-top: 0; }
  .doc img { max-width: 100%; height: auto; }
  .doc table { display: block; width: max-content; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
  .doc th, .doc td { border: 1px solid var(--line); padding: 7px 11px; text-align: left; vertical-align: top; }
  .doc th { background: var(--code-bg); font-weight: 600; white-space: nowrap; }
  .doc details { margin: 14px 0; padding: 8px 13px; border: 1px solid var(--line); border-radius: 9px; }
  .doc summary { cursor: pointer; color: var(--muted); }
  .doc kbd { font: 12px/1.4 ui-monospace, Menlo, monospace; padding: 1px 5px; border: 1px solid var(--line); border-radius: 4px; background: var(--code-bg); }
  .doc img + br { line-height: 1; }
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
  <span class="tag">Markdown</span>
  <span class="spacer"></span>
  <button type="button" data-copy="content">复制全文</button>
</header>
<main>
  <article class="doc body" data-copy-source>${body}</article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成的只读快照</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>
</main>
${COPY_SCRIPT}
</body>
</html>`;
}
/**
* 目录没有 `index.html` 时的入口页：列出文件，点开即看。
* @param {{title: string, entries: Array<{name: string, size: number}>}} input
* @returns {string} 完整 HTML。
*/
function renderDirectoryIndex(input) {
	const { title, entries, theme, customCss } = input;
	const rows = entries.map((entry) => `<li><a href="./${entry.name.split("/").map(encodeURIComponent).join("/")}">${escapeHtml(entry.name)}</a><span>${formatSize(entry.size)}</span></li>`).join("\n");
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
${PAGE_CSS}
${themeCss(theme, customCss)}
  .files { list-style: none; margin: 26px 0 0; padding: 0; }
  .files li { display: flex; justify-content: space-between; gap: 16px; padding: 11px 2px; border-bottom: 1px solid var(--line); }
  .files li:first-child { border-top: 1px solid var(--line); }
  .files a { color: var(--accent); text-decoration: none; overflow-wrap: anywhere; }
  .files a:hover { text-decoration: underline; }
  .files span { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
</head>
<body>
<header class="bar">
  <span class="brand">dsh-share-link</span>
  <span class="tag">目录</span>
  <span class="spacer"></span>
  <button type="button" data-copy="content">复制全文</button>
</header>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">${entries.length} 个文件 · 只读目录快照</p>
  <article data-copy-source><ul class="files">
${rows}
  </ul></article>
  <footer>
    <span>由 <a href="${STAR_URL}" target="_blank" rel="noreferrer">dsh-share-link</a> 生成</span>
    <span class="grow"></span>
    <a class="star" href="${STAR_URL}" target="_blank" rel="noreferrer">喜欢这个插件🌟</a>
  </footer>
</main>
${COPY_SCRIPT}
</body>
</html>`;
}
/** @param {number} bytes */
function formatSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
//#endregion
//#region src/share-link.mjs
/**
* 分享管理器：本地只读静态服务 + 分享存储 + 公网隧道。
*
* 三件事刻意分开：
* 1. **只读静态服务**只绑 127.0.0.1，只认 `GET /s/<id>/…`，不碰主 GUI、不碰 3080；
* 2. **分享存储**是 `$DSH_HOME/share-link/` 下的普通目录，删掉即撤销；
* 3. **公网隧道**是 cloudflared 子进程，链接的生命周期 = 进程的存活期。
*
* @module dsh-share-link/share
*/
/** 单文件 / 单目录的体积与数量上限，防止误分享整个 home。 */
const LIMITS = {
	maxBytes: 100 * 1024 * 1024,
	maxFiles: 2e3
};
/**
* 首次分享要下载 cloudflared（约 20 MB）。请求里最多等这么久，超过就交出进度、
* 让用户重试——把「卡住几十秒没有任何反馈」换成「告诉你在下什么、下到哪」。
*/
const WARM_WAIT_MS = 8e3;
/** 下载参数：前 3 秒跑不到 200 KB 就判慢、换下一个源；15 秒没新数据算卡死。 */
const DOWNLOAD = Object.freeze({
	raceMs: 3e3,
	raceBytes: 200 * 1024,
	stallMs: 15e3,
	totalMs: 360 * 1e3
});
/** 分享 `.md` 时对图片的约束：本地相对图片原样附带，公网图片发布时内联。 */
const MARKDOWN_IMAGES = Object.freeze({
	maxCount: 24,
	maxBytesEach: 2 * 1024 * 1024,
	maxBytesTotal: 8 * 1024 * 1024,
	timeoutMs: 6e3,
	concurrency: 6
});
/**
* 分享短码的字符集：小写 base36。
*
* **刻意不用 base62 / base64url**：路径段本身大小写敏感，但聊天软件预览、
* 移动端自动大写、人工转述都把 URL 折成小写是常事——一旦大小写被抹平，
* 两个不同的 key 就会撞到同一个地址（指向别人的分享）。全小写把这一整类
* 失效消掉，代价是每字符 5.17 bit 而不是 6 bit。
*/
const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
/** 短码长度：8 位 ≈ 41.4 bit，10 位 ≈ 51.7 bit，16 位 ≈ 82.7 bit。 */
const CODE_LENGTH = Object.freeze({
	min: 8,
	max: 16,
	default: 8
});
/** @param {unknown} value @returns {number} */
function normalizeCodeLength(value) {
	const number = typeof value === "number" && Number.isInteger(value) ? value : CODE_LENGTH.default;
	return Math.min(CODE_LENGTH.max, Math.max(CODE_LENGTH.min, number));
}
/**
* 生成无偏短码。
*
* 用**拒绝采样**而不是 `randomBytes(n) % 36`：36 不整除 256，直接取模会让
* 前 4 个字符比其余字符多出约 1/7 的概率。252 = 7 × 36，丢掉 >= 252 的
* 字节之后 `byte % 36` 严格均匀。
*
* @param {number} [length]
* @returns {string}
*/
function shortCode(length = CODE_LENGTH.default) {
	const size = normalizeCodeLength(length);
	let code = "";
	while (code.length < size) for (const byte of randomBytes(size * 2)) {
		if (byte >= 252) continue;
		code += CODE_ALPHABET[byte % 36];
		if (code.length === size) break;
	}
	return code;
}
/** Windows 上可执行文件带扩展名、PATH 分隔符也不同。 */
const IS_WINDOWS = process.platform === "win32";
const BINARY_NAME = IS_WINDOWS ? "cloudflared.exe" : "cloudflared";
const MIME = {
	".html": "text/html; charset=utf-8",
	".htm": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".md": "text/markdown; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".pdf": "application/pdf",
	".woff2": "font/woff2",
	".woff": "font/woff"
};
/** @param {string} file */
function mimeOf(file) {
	return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
}
/**
* dsh 自己注入到 user 位置的「上下文噪音」前缀。
*
* 会话 surface 上的 `user/message` 既包含人类直接输入，也包含 harness 注入的
* 运行时上下文、system-reminder、技能清单等。分享页要的是**对话**，所以按
* 已知前缀丢掉后者——这是尽力而为的过滤，不是分类器。
*/
const INJECTED_PREFIXES = [
	"Current runtime context.",
	"<system-reminder>",
	"<available_skills>",
	"<environment",
	"Token budget",
	"Available skills",
	"Time sampled while"
];
/** 出现在注入上下文正文里的特征句（前缀之外的第二道网）。 */
const INJECTED_MARKERS = [
	"Browser time zone for this request",
	"Elapsed since the preceding model-visible message",
	"This snapshot supersedes earlier runtime-context snapshots"
];
/** @param {string} text */
function isInjectedContext(text) {
	const head = text.trimStart();
	if (INJECTED_PREFIXES.some((prefix) => head.startsWith(prefix))) return true;
	return INJECTED_MARKERS.some((marker) => head.includes(marker));
}
/**
* 从 surface 事件里投影出可渲染的消息。
* 只保留 user/assistant 的 **文本**；工具调用默认只留名字，结果正文一律不投影。
* @param {Array<{type: string, data: any, time?: number}>} events
* @param {{includeToolCalls?: boolean}} options
*/
function projectSurface(events, options = {}) {
	const messages = [];
	for (const event of events) {
		const data = event?.data ?? {};
		if (event.type === "user/message") {
			const text = messageText(data.content ?? data);
			if (text.trim() !== "" && !isInjectedContext(text)) messages.push({
				role: "user",
				text
			});
			continue;
		}
		if (event.type === "assistant/message") {
			const message = data.message ?? {};
			const text = messageText(message.content ?? message);
			const tools = options.includeToolCalls === true ? toolNames(message.content) : [];
			if (text.trim() !== "" || tools.length > 0) messages.push({
				role: "assistant",
				text: text.trim() === "" ? "（本步只有工具调用）" : text,
				tools
			});
			continue;
		}
		if (event.type === "tool/result" && options.includeToolCalls === true) {
			const name = data.message?.toolName ?? data.message?.name;
			if (typeof name === "string" && messages.length > 0 && messages.at(-1).role === "assistant") {
				const last = messages.at(-1);
				last.tools = [...last.tools ?? [], name];
			}
		}
	}
	return messages;
}
/** @param {any} content */
function messageText(content) {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) return content.map((part) => {
		if (typeof part === "string") return part;
		if (part?.type === "text" && typeof part.text === "string") return part.text;
		return "";
	}).filter(Boolean).join("\n");
	if (content && typeof content.text === "string") return content.text;
	return "";
}
/** @param {any} content */
function toolNames(content) {
	if (!Array.isArray(content)) return [];
	const names = [];
	for (const part of content) {
		const name = part?.toolName ?? part?.name;
		if ((part?.type === "tool-call" || part?.type === "tool_call") && typeof name === "string") names.push(name);
	}
	return [...new Set(names)];
}
/**
* 递归列出目录下的文件（相对路径），用于没有 `index.html` 的目录入口页。
* @param {string} root
* @param {string} dir
* @param {Array<{name: string, size: number}>} [acc]
* @returns {Array<{name: string, size: number}>}
*/
function walkFiles(root, dir, acc = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walkFiles(root, full, acc);
			continue;
		}
		if (!entry.isFile()) continue;
		acc.push({
			name: relative(root, full).split(sep).join("/"),
			size: statSync(full).size
		});
	}
	return acc;
}
/**
* 从 Markdown 源里挑出图片引用（`![]()` 与 `<img src>`），去重保序。
* 只取字符串、不解析 AST：后续的 exists()/HTTP 校验会把链接、正文里的同形文本过滤掉。
* @param {string} markdown
* @returns {string[]}
*/
function collectImageRefs(markdown) {
	const refs = [];
	const add = (value) => {
		const ref = value.trim();
		if (ref === "" || ref.startsWith("data:") || refs.includes(ref)) return;
		refs.push(ref);
	};
	for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)) add(match[1]);
	for (const match of markdown.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) add(match[1]);
	return refs;
}
/**
* 收集 `.md` 引用的本地图片，按「相对 md 的路径」返回 `{path: Buffer}`。
*
* 分享页在分享根目录，所以保持相对路径不变，`![](docs/a.png)` 就能直接加载，
* 不需要改写正文。越界（`../`）、非文件、超过单次分享上限的一律静默跳过。
*
* @param {string} mdPath
* @param {string} markdown
* @returns {Record<string, Buffer>}
*/
function collectMarkdownAssets(mdPath, markdown) {
	const root = dirname(mdPath);
	const assets = {};
	let bytes = 0;
	for (const ref of collectImageRefs(markdown)) {
		if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) continue;
		let local = ref.split("#")[0].split("?")[0];
		try {
			local = decodeURIComponent(local);
		} catch {}
		const full = resolve(root, local);
		if (!full.startsWith(root + sep)) continue;
		if (!existsSync(full) || !statSync(full).isFile()) continue;
		const size = statSync(full).size;
		if (size > LIMITS.maxBytes || bytes + size > LIMITS.maxBytes) continue;
		bytes += size;
		assets[relative(root, full).split(sep).join("/")] = readFileSync(full);
	}
	return assets;
}
/**
* 抓公网图片并转成 data URI（徽章大多是几百字节的 SVG）。
* 抓不到的留在正文里保持原地址：页面还能显示，只是需要联网——比留个破图强。
* @param {string} markdown
* @returns {Promise<Map<string, string>>}
*/
async function fetchRemoteImages(markdown) {
	const urls = collectImageRefs(markdown).filter((ref) => /^https?:\/\//i.test(ref)).slice(0, MARKDOWN_IMAGES.maxCount);
	const images = /* @__PURE__ */ new Map();
	let total = 0;
	for (let index = 0; index < urls.length; index += MARKDOWN_IMAGES.concurrency) {
		const batch = urls.slice(index, index + MARKDOWN_IMAGES.concurrency);
		const loaded = await Promise.all(batch.map((url) => fetchImage(url).catch(() => void 0)));
		for (const [offset, dataUri] of loaded.entries()) {
			if (dataUri === void 0) continue;
			const size = Math.ceil(dataUri.length * 3 / 4);
			if (total + size > MARKDOWN_IMAGES.maxBytesTotal) continue;
			total += size;
			images.set(batch[offset], dataUri);
		}
	}
	return images;
}
/**
* 取一张公网图片，校验类型与体积后转成 data URI。
* @param {string} url
* @returns {Promise<string|undefined>}
*/
async function fetchImage(url) {
	const response = await fetch(url, {
		redirect: "follow",
		signal: AbortSignal.timeout(MARKDOWN_IMAGES.timeoutMs)
	});
	if (!response.ok) return void 0;
	const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
	if (!type.startsWith("image/")) return void 0;
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.byteLength > MARKDOWN_IMAGES.maxBytesEach) return void 0;
	return `data:${type};base64,${buffer.toString("base64")}`;
}
/**
* 一条分享的对外 URL。Surge 把整个目录部署成域名根；隧道/局域网走 `/s/<id>/`。
* @param {{provider?: string, origin: string, id: string, entry?: string}} entry
* @returns {string}
*/
function urlOf(entry) {
	const suffix = entry.entry === void 0 || entry.entry === "index.html" ? "" : entry.entry;
	return entry.provider === "surge" ? `${entry.origin}/${suffix}` : `${entry.origin}/s/${entry.id}/${suffix}`;
}
/** 递归统计目录体积与文件数。 */
function measure(target, acc = {
	bytes: 0,
	files: 0
}) {
	const info = statSync(target);
	if (info.isDirectory()) {
		for (const entry of readdirSync(target)) measure(join(target, entry), acc);
		return acc;
	}
	acc.bytes += info.size;
	acc.files += 1;
	return acc;
}
/** 取本机局域网地址，作为隧道不可用时的降级出口。 */
function lanAddress(port) {
	for (const entries of Object.values(networkInterfaces())) for (const entry of entries ?? []) if (entry.family === "IPv4" && entry.internal === false) return `http://${entry.address}:${port}`;
	return `http://127.0.0.1:${port}`;
}
/** 带引导信息的分享错误：client 半按 `guide` 渲染"去登录 / 去配置"入口。 */
var ShareError = class extends Error {
	/**
	* @param {string} code
	* @param {string} message
	* @param {object} [guide]
	*/
	constructor(code, message, guide) {
		super(message);
		this.name = "ShareError";
		this.code = code;
		this.guide = guide;
	}
};
/** 各通道缺配置时的引导文案。链接都指向官方入口，命令可直接复制。 */
const GUIDES = {
	surgeLogin: {
		code: "surgeLogin",
		title: "需要先登录 Surge",
		body: "Surge 用邮箱注册（免费），登录一次即可。本插件会复用本机的 Surge 登录状态。",
		href: "https://surge.sh/",
		linkText: "打开 surge.sh 注册 / 登录",
		command: "npm i -g surge && surge login"
	},
	surgeMissing: {
		code: "surgeMissing",
		title: "没有找到 surge 命令",
		body: "本机没有装 Surge CLI。装好并登录后，分享会自动走你的账号。",
		href: "https://surge.sh/",
		linkText: "surge.sh",
		command: "npm i -g surge"
	},
	surgeVerify: {
		code: "surgeVerify",
		title: "需要先验证 Surge 邮箱",
		body: "Surge 给这个账号发了验证邮件。点邮件里的链接，或在终端运行 surge verify 重新发送；验证后同一个域名就能打开。",
		href: "https://surge.sh/",
		linkText: "打开 surge.sh",
		command: "surge verify"
	},
	cfToken: {
		code: "cfToken",
		title: "命名隧道缺少 token",
		body: "命名隧道是你在 Cloudflare 上自建的隧道：需要在 Zero Trust 里创建，把 connector token 填到这里，并把域名路由到本机端口。没有自有域名就没法用，改用 Surge 或快速隧道。",
		href: "https://one.dash.cloudflare.com/",
		linkText: "打开 Cloudflare Zero Trust",
		command: null
	},
	cfHostname: {
		code: "cfHostname",
		title: "命名隧道缺少域名",
		body: "配置了 tunnelToken，但没有可访问的域名。命名隧道要在 Routes 里加一条 Published application（需要托管在 Cloudflare 的自有域名）并指向 localhost:3089；没有域名请改用 Surge 或快速隧道。",
		href: "https://one.dash.cloudflare.com/",
		linkText: "打开 Cloudflare Zero Trust",
		command: null
	},
	warming: {
		code: "tunnel-warming",
		title: "cloudflared 正在下载",
		body: "快速隧道第一次使用要先下载约 20 MB 的 cloudflared；下好之后再用就只需要一两秒。不想等可以改用 Surge（无需下载），或先在本机装好 cloudflared。",
		href: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
		linkText: "下载 cloudflared",
		command: "brew install cloudflared"
	},
	cfDownload: {
		code: "cfDownload",
		title: "cloudflared 不可用",
		body: "公网链接需要一个 cloudflared 可执行文件。可以自动下载，也可以自己装一个然后填 cloudflaredPath。",
		href: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
		linkText: "下载 cloudflared",
		command: "brew install cloudflared"
	}
};
/**
* 本机是否有 Surge 的登录态。Surge 把凭据写在 `~/.netrc` 的 `machine surge.sh` 段。
* @returns {boolean}
*/
function hasSurgeCredentials() {
	try {
		return readFileSync(join(homedir(), ".netrc"), "utf8").includes("surge.sh");
	} catch {
		return false;
	}
}
var ShareManager = class {
	/**
	* @param {object} options
	* @param {any} options.ctx - host 上下文（用于 sessionQuery / sessions）。
	* @param {object} [options.config]
	*/
	constructor({ ctx, config = {} }) {
		this.ctx = ctx;
		this.config = config;
		this.home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
		this.root = join(this.home, "share-link");
		this.sharesDir = join(this.root, "shares");
		this.indexFile = join(this.root, "index.json");
		this.port = 0;
		this.server = null;
		this.tunnel = null;
		this.tunnelOrigin = null;
		this.tunnelStarting = null;
		/** cloudflared 的预热状态：idle | downloading | ready | failed。 */
		this.download = {
			state: "idle",
			received: 0,
			total: 0
		};
		this.downloadTask = null;
	}
	async start() {
		mkdirSync(this.sharesDir, { recursive: true });
		await this.#listen();
		this.sweep();
		this.#dropStaleQuickShares();
	}
	async stop() {
		await this.#closeTunnel();
		await new Promise((done) => {
			if (this.server === null) return done();
			this.server.close(() => done());
			this.server = null;
		});
	}
	#listen() {
		if (this.server !== null) return Promise.resolve();
		const namedCapable = this.config.defaultChannel === "named" || (this.config.tunnelToken ?? "") !== "" && (this.config.tunnelHostname ?? "") !== "";
		const requested = Number.isInteger(this.config.port) && this.config.port > 0 ? this.config.port : namedCapable ? 3089 : 0;
		return new Promise((resolvePromise, reject) => {
			const server = createServer((request, response) => this.#serve(request, response));
			server.on("error", reject);
			server.listen(requested, "127.0.0.1", () => {
				this.server = server;
				this.port = server.address().port;
				resolvePromise();
			});
		});
	}
	get origin() {
		return this.tunnelOrigin ?? lanAddress(this.port);
	}
	#readIndex() {
		try {
			return JSON.parse(readFileSync(this.indexFile, "utf8"));
		} catch {
			return {};
		}
	}
	#writeIndex(index) {
		writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
	}
	/** 清掉过期条目与它们的目录。 */
	sweep() {
		const index = this.#readIndex();
		let dirty = false;
		const now = Date.now();
		for (const [id, entry] of Object.entries(index)) if (typeof entry.expiresAt === "number" && entry.expiresAt <= now) {
			rmSync(join(this.sharesDir, id), {
				recursive: true,
				force: true
			});
			delete index[id];
			dirty = true;
		}
		if (dirty) this.#writeIndex(index);
	}
	/**
	* 清掉上一轮进程留下的「快速隧道」分享（连同快照）。
	*
	* 快速隧道的主机名是 Cloudflare 每次启动随机给的，进程一退就永不回来——
	* 这些条目留在索引里只会是死链，而且占着短码。命名隧道不受影响：域名
	* 固定、端口固定，重启后同一个地址照样有效；Surge 是静态托管，更不受影响。
	*
	* 唯一的例外是「快速隧道不可用、降级成局域网」的条目：只要这次监听的
	* 局域网地址与它记录的 origin 完全一致，它就还有可能活着，留着。
	*
	* @returns {number} 清掉的条数
	*/
	#dropStaleQuickShares() {
		const index = this.#readIndex();
		const currentLan = lanAddress(this.port);
		let dropped = 0;
		for (const [id, entry] of Object.entries(index)) {
			if (entry.channel !== "quick") continue;
			if (entry.provider === "lan" && entry.origin === currentLan) continue;
			rmSync(join(this.sharesDir, id), {
				recursive: true,
				force: true
			});
			delete index[id];
			dropped += 1;
		}
		if (dropped > 0) {
			this.#writeIndex(index);
			this.ctx.logger?.debug?.(`[share-link] 清理了 ${dropped} 条上一轮进程留下的快速隧道分享`);
		}
		return dropped;
	}
	/**
	* 把通道 id 解析成发布时需要的形态。
	* @param {string} [id] quick | surge | named | lan；省略时用默认通道
	*/
	resolveChannel(id) {
		switch (id ?? this.config.defaultChannel ?? "quick") {
			case "surge": return {
				id: "surge",
				provider: "surge"
			};
			case "lan": return {
				id: "lan",
				provider: "lan"
			};
			case "named": return {
				id: "named",
				provider: "tunnel",
				tunnelMode: "named"
			};
			default: return {
				id: "quick",
				provider: "tunnel",
				tunnelMode: "quick"
			};
		}
	}
	/**
	* 设置卡里的样式预览：用同一套渲染器出一页样例（不写盘、不发布）。
	* @param {{theme?: string, customCss?: string}} [options]
	* @returns {string}
	*/
	previewPage(options = {}) {
		return renderSessionPage({
			title: "分享页样式预览",
			sessionId: "session-预览",
			createdAt: Date.now(),
			theme: options.theme ?? this.config.pageTheme,
			customCss: options.customCss ?? this.config.pageThemeCss,
			messages: [{
				role: "user",
				text: "这段对话会被发布成一个只读链接，对方不用装 dsh 也能看。"
			}, {
				role: "assistant",
				text: "好的。\n\n风格可以随时换，正文与代码块都会跟着变：\n\n```js\nconst share = await createSessionShare(id)\n```\n\n- 链接可撤销\n- 快照默认脱敏"
			}]
		});
	}
	/**
	* 通道就绪情况：client 半在打开分享框时就查这个，未就绪直接给引导，而不是等失败。
	* @returns {Promise<{provider: string, ready: boolean, guide?: object, detail: string}>}
	*/
	async status() {
		const channels = {};
		channels.surge = await this.#surgeStatus();
		if (this.download.state === "idle") {
			const cached = this.#cachedCloudflared();
			if (cached !== void 0) this.download = {
				state: "ready",
				received: 1,
				total: 1,
				path: cached
			};
		}
		const download = this.downloadInfo();
		const tunnelReady = this.tunnelOrigin !== null;
		channels.quick = {
			ready: true,
			download,
			tunnel: tunnelReady ? "ready" : this.tunnelStarting === null ? "idle" : "connecting",
			detail: tunnelReady ? "隧道已连上，发布只需一瞬间" : download.state === "downloading" ? `正在下载 cloudflared ${download.percent}%（${formatMb(download.received)} / ${formatMb(download.total)}）` : download.state === "failed" ? `cloudflared 下载失败：${download.error ?? "未知原因"}` : download.state === "ready" ? "cloudflared 已就绪，首次发布约 2–5 秒（正在连隧道）" : `首次分享会自动下载 cloudflared（约 ${formatMb(20 * 1024 * 1024)}）`
		};
		channels.lan = {
			ready: true,
			detail: "仅同一局域网可访问"
		};
		channels.named = (this.config.tunnelToken ?? "") !== "" && (this.config.tunnelHostname ?? "") !== "" ? {
			ready: true,
			detail: `命名隧道 ${this.config.tunnelHostname}`
		} : (this.config.tunnelToken ?? "") === "" ? {
			ready: false,
			guide: GUIDES.cfToken,
			detail: "缺隧道 token"
		} : {
			ready: false,
			guide: GUIDES.cfHostname,
			detail: "缺对外域名"
		};
		const current = this.resolveChannel();
		const active = channels[current.id] ?? {
			ready: false,
			detail: ""
		};
		return {
			default: current.id,
			channels,
			provider: current.provider,
			ready: active.ready,
			via: active.via,
			detail: active.detail,
			guide: active.guide
		};
	}
	/** 当前 cloudflared 预热状态（给设置页与分享弹窗看进度）。 */
	downloadInfo() {
		const { state, received, total, path, error } = this.download;
		return {
			state,
			received,
			total,
			percent: total > 0 ? Math.min(100, Math.round(received / total * 100)) : 0,
			path,
			error
		};
	}
	/**
	* 预热 cloudflared：把「首次分享要等 20 MB」挪出请求路径。
	*
	* 幂等——磁盘缓存、PATH 上的 cloudflared 都算就绪；下载失败后可以再调一次重试。
	*/
	async warm() {
		const cached = this.#cachedCloudflared();
		if (cached !== void 0) {
			this.download = {
				state: "ready",
				received: 1,
				total: 1,
				path: cached
			};
			return this.downloadInfo();
		}
		if (this.downloadTask === null) {
			this.download = {
				state: "downloading",
				received: 0,
				total: 0
			};
			this.downloadTask = downloadCloudflared(join(this.root, "bin"), (progress) => {
				this.download = {
					state: "downloading",
					received: progress.received,
					total: progress.total
				};
			}).then((path) => {
				this.download = {
					state: "ready",
					received: 1,
					total: 1,
					path
				};
				return path;
			}).catch((error) => {
				this.download = {
					state: "failed",
					received: 0,
					total: 0,
					error: String(error?.message ?? error)
				};
				this.ctx.logger?.warn?.(`[share-link] cloudflared 下载失败：${String(error)}`);
			}).finally(() => {
				this.downloadTask = null;
			});
		}
		await this.downloadTask;
		return this.downloadInfo();
	}
	/**
	* 预热快速隧道：先把 cloudflared 准备好，再**把隧道连上**。
	*
	* 冷启动实测约 9 秒（握手 + 分配主机名），而用户打开弹窗到点「生成链接」之间
	* 往往就是这几秒——这段等在这里，不该算在发布上。失败不抛：发布时还会再试。
	* @returns {Promise<void>}
	*/
	async prewarm() {
		if ((await this.warm()).state !== "ready") return;
		await this.#ensureOrigin("quick").catch((error) => {
			this.ctx.logger?.warn?.(`[share-link] 隧道预热失败：${String(error)}`);
		});
	}
	/** 已经可用的 cloudflared：显式配置 > 缓存 > PATH。 */
	#cachedCloudflared() {
		const explicit = this.config.cloudflaredPath;
		if (typeof explicit === "string" && explicit !== "") return explicit;
		const cached = join(this.root, "bin", BINARY_NAME);
		if (existsSync(cached)) return cached;
		return findOnPath("cloudflared");
	}
	/**
	* 取一个能用的 cloudflared 可执行文件：缺了就**开始下载并最多等 WARM_WAIT_MS**，
	* 还没好就抛带进度的引导（`tunnel-warming`），不再让请求无声挂住。
	* @returns {Promise<string>}
	*/
	async #cloudflaredBinary() {
		const cached = this.#cachedCloudflared();
		if (cached !== void 0) return cached;
		await Promise.race([this.warm(), new Promise((done) => setTimeout(done, WARM_WAIT_MS))]);
		const after = this.#cachedCloudflared();
		if (after !== void 0) return after;
		const state = this.downloadInfo();
		if (state.state === "failed") throw new ShareError("cf-download", `cloudflared 下载失败：${state.error ?? "未知原因"}`, GUIDES.cfDownload);
		throw new ShareError("tunnel-warming", `cloudflared 还在下载（${state.percent}%，${formatMb(state.received)} / ${formatMb(state.total)}）`, GUIDES.warming);
	}
	async #surgeStatus() {
		if (findOnPath("surge") === void 0) return {
			ready: false,
			guide: GUIDES.surgeMissing,
			detail: "没有 surge 可执行文件"
		};
		const via = typeof this.config.surgeToken === "string" && this.config.surgeToken !== "" ? "config-token" : (process.env.SURGE_TOKEN ?? "") !== "" ? "env-token" : hasSurgeCredentials() ? "netrc" : void 0;
		return via === void 0 ? {
			ready: false,
			guide: GUIDES.surgeLogin,
			detail: "surge 未登录"
		} : {
			ready: true,
			via,
			detail: via === "netrc" ? "surge 本机已登录" : "surge 已配置 token"
		};
	}
	list() {
		this.sweep();
		return Object.values(this.#readIndex()).map((entry) => ({
			...entry,
			url: urlOf(entry)
		})).sort((a, b) => b.createdAt - a.createdAt);
	}
	async revoke(id) {
		const index = this.#readIndex();
		if (index[id] === void 0) return false;
		const entry = index[id];
		if (entry.provider === "surge" && entry.domain !== void 0) await runTool("surge", ["teardown", entry.domain], this.#toolEnv()).catch(() => {});
		rmSync(join(this.sharesDir, id), {
			recursive: true,
			force: true
		});
		delete index[id];
		this.#writeIndex(index);
		return true;
	}
	/**
	* 分享当前会话的快照。
	* @param {string} sessionId
	* @param {{includeToolCalls?: boolean, ttlHours?: number, title?: string}} [options]
	*/
	async createSessionShare(sessionId, options = {}) {
		if (typeof sessionId !== "string" || sessionId === "") throw new Error("createSessionShare 需要 sessionId");
		const { header, messages } = await this.#readTranscript(sessionId, options);
		const safeMessages = messages.map((message) => ({
			...message,
			text: redact(message.text)
		}));
		let title = options.title;
		if (title === void 0) title = await this.#readTitle(sessionId);
		if (title === void 0 || title === "") title = `会话 ${sessionId.slice(0, 8)}`;
		const html = renderSessionPage({
			title,
			sessionId,
			createdAt: Date.now(),
			messages: safeMessages,
			theme: this.config.pageTheme,
			customCss: this.config.pageThemeCss
		});
		return this.#publish({
			kind: "session",
			title,
			body: { "index.html": html },
			channel: options.channel,
			ttlHours: options.ttlHours,
			files: messages.length
		});
	}
	/**
	* 分享一个本地文件或目录（产物：HTML / Markdown / PPT / 截图…）。
	* @param {string} path - 绝对路径或相对 cwd 的路径。
	* @param {{title?: string, ttlHours?: number, cwd?: string}} [options]
	*/
	async createPathShare(path, options = {}) {
		const target = resolve(options.cwd ?? process.cwd(), path);
		if (!existsSync(target)) throw new Error(`路径不存在：${target}`);
		const info = statSync(target);
		const size = measure(target);
		if (size.bytes > LIMITS.maxBytes) throw new Error(`超过 ${LIMITS.maxBytes} 字节上限：${size.bytes}`);
		if (size.files > LIMITS.maxFiles) throw new Error(`超过 ${LIMITS.maxFiles} 个文件上限：${size.files}`);
		const body = {};
		let entry = "index.html";
		if (info.isDirectory()) {
			body[""] = target;
			if (!existsSync(join(target, "index.html"))) {
				const entries = walkFiles(target, target).sort((a, b) => a.name.localeCompare(b.name, "zh"));
				body["index.html"] = renderDirectoryIndex({
					title: target.split(sep).at(-1) ?? "files",
					entries,
					theme: this.config.pageTheme,
					customCss: this.config.pageThemeCss
				});
			}
		} else if (/\.html?$/i.test(target)) body["index.html"] = readFileSync(target, "utf8");
		else if (/\.md$/i.test(target)) {
			const name = target.split(sep).at(-1) ?? "document";
			const markdown = readFileSync(target, "utf8");
			Object.assign(body, collectMarkdownAssets(target, markdown));
			body["index.html"] = renderMarkdownDocument({
				title: name.replace(/\.md$/i, ""),
				markdown,
				theme: this.config.pageTheme,
				customCss: this.config.pageThemeCss,
				images: await fetchRemoteImages(markdown)
			});
		} else {
			const name = target.split(sep).at(-1) ?? "file";
			body[name] = readFileSync(target);
			entry = name;
		}
		const title = options.title ?? (info.isDirectory() ? target.split(sep).at(-1) : target.split(sep).at(-1));
		return this.#publish({
			kind: "path",
			title,
			body,
			channel: options.channel,
			ttlHours: options.ttlHours,
			entry,
			source: target,
			files: size.files
		});
	}
	/**
	* 读取一个会话的完整消息序列。
	*
	* 走持久化读句柄而不是 sessionQuery：后者的可见性按 workspace 收窄，
	* 而分享是「按 id 取这一份日志」，不该被索引状态挡住。surface 折叠交给
	* 官方 `foldSurface`，压过缩（replacement）等语义与 GUI 保持一致。
	*/
	async #readTranscript(sessionId, options = {}) {
		const sessions = this.ctx.get("sessions");
		const live = sessions?.get?.(sessionId);
		if (live !== void 0) await sessions.flush(live);
		try {
			const surface = await this.ctx.sessionQuery.readSurface(sessionId);
			const projected = projectSurface(surface.events ?? [], options);
			if (projected.length > 0) return {
				header: surface.session,
				messages: projected
			};
		} catch {}
		const persistence = this.ctx.get("sessionPersistence");
		if (persistence === void 0) throw new Error("宿主未挂载 sessionPersistence，无法读取会话");
		const handle = await persistence.open(sessionId, "read");
		try {
			const { events } = await handle.read(0, void 0);
			const folded = foldSurface(events);
			const messages = [];
			for (const seq of folded.nodes) {
				const message = folded.projectedMessages.get(seq);
				if (message === void 0) continue;
				const role = message.role;
				if (role !== "user" && role !== "assistant") continue;
				const text = messageText(message.content);
				const tools = role === "assistant" && options.includeToolCalls === true ? toolNames(message.content) : [];
				if (text.trim() === "" && tools.length === 0) continue;
				messages.push({
					role,
					text: text.trim() === "" ? "（本步只有工具调用）" : text,
					tools
				});
			}
			return {
				header: handle.header,
				messages
			};
		} finally {
			await handle.close();
		}
	}
	async #readTitle(sessionId) {
		try {
			const snapshot = await this.ctx.sessionQuery?.readTitle?.(sessionId);
			const title = snapshot?.title ?? snapshot?.value;
			return typeof title === "string" && title !== "" ? title : void 0;
		} catch {
			return;
		}
	}
	/**
	* @param {{kind: string, title: string, body: Record<string, string|Buffer>, ttlHours?: number, entry?: string, source?: string, files?: number}} input
	*/
	async #publish(input) {
		const { id, dir } = this.#allocateShareDir();
		let committed = false;
		try {
			for (const [name, content] of Object.entries(input.body)) {
				if (name === "") {
					cpSync(content, dir, { recursive: true });
					continue;
				}
				const file = join(dir, name);
				mkdirSync(dirname(file), { recursive: true });
				writeFileSync(file, content);
			}
			const ttlHours = Number.isFinite(input.ttlHours) && input.ttlHours > 0 ? input.ttlHours : this.config.ttlHours ?? 168;
			const channel = this.resolveChannel(input.channel);
			let origin;
			let provider;
			let domain;
			let degraded = false;
			let degradedReason;
			if (channel.provider === "surge") {
				const deployed = await this.#deploySurge(dir, `${this.config.surgePrefix ?? "dsh-share"}-${id}`);
				origin = deployed.url;
				domain = deployed.domain;
				provider = "surge";
			} else if (channel.provider === "lan") {
				await this.#listen();
				origin = lanAddress(this.port);
				provider = "lan";
			} else {
				await this.#ensureOrigin(channel.tunnelMode);
				origin = this.origin;
				provider = this.tunnelOrigin === null ? "lan" : "tunnel";
				if (provider === "lan" && this.degradedReason !== void 0) {
					degraded = true;
					degradedReason = this.degradedReason;
				}
			}
			const createdAt = Date.now();
			const entry = {
				id,
				kind: input.kind,
				title: input.title,
				createdAt,
				expiresAt: createdAt + ttlHours * 3600 * 1e3,
				provider,
				channel: channel.id,
				domain,
				origin,
				degraded: degraded || void 0,
				degradedReason,
				entry: input.entry ?? "index.html",
				source: input.source,
				files: input.files ?? 1
			};
			const index = this.#readIndex();
			index[id] = entry;
			this.#writeIndex(index);
			committed = true;
			return {
				...entry,
				url: urlOf(entry)
			};
		} finally {
			if (!committed) rmSync(dir, {
				recursive: true,
				force: true
			});
		}
	}
	/**
	* 分配一条分享的短码与目录。
	*
	* **目录创建成功 = 拿到这个 id**：非递归 `mkdir` 的 `EEXIST` 是文件系统给出的
	* 原子判定，比「先查 index 再创建」可靠——索引与磁盘本来就可能不一致
	* （`sweep` / `revoke` 各删一边），而并发发布也不会撞。撞了就重摇。
	*
	* @returns {{id: string, dir: string}}
	*/
	#allocateShareDir() {
		const length = normalizeCodeLength(this.config.idLength);
		for (let attempt = 0; attempt < 8; attempt += 1) {
			const id = shortCode(length);
			const dir = join(this.sharesDir, id);
			try {
				mkdirSync(dir);
				return {
					id,
					dir
				};
			} catch (error) {
				if (error?.code !== "EEXIST") throw error;
				this.ctx.logger?.warn?.(`[share-link] 短码 ${id} 已被占用，重摇`);
			}
		}
		throw new Error("无法分配分享短码：连续 8 次与已有目录冲突");
	}
	/** 外部发布工具的进程环境（Surge token 从配置注入，不落盘）。 */
	#toolEnv() {
		const env = { ...process.env };
		if (typeof this.config.surgeLogin === "string" && this.config.surgeLogin !== "") env.SURGE_LOGIN = this.config.surgeLogin;
		if (typeof this.config.surgeToken === "string" && this.config.surgeToken !== "") env.SURGE_TOKEN = this.config.surgeToken;
		return env;
	}
	/**
	* 把已落盘的分享目录发到 Surge（持久链接，`surge teardown <domain>` 可撤销）。
	* @param {string} dir
	* @param {string} slug
	*/
	async #deploySurge(dir, slug) {
		const domain = typeof this.config.surgeDomain === "string" && this.config.surgeDomain !== "" ? `${slug}.${this.config.surgeDomain}` : `${slug}.surge.sh`;
		let output = "";
		try {
			output = await runTool("surge", [dir, domain], this.#toolEnv());
			if (/email verification|surge verify/i.test(output)) throw new ShareError("surge-verify", "Surge 要求先验证邮箱，链接现在打不开（403）", GUIDES.surgeVerify);
		} catch (error) {
			if (error instanceof ShareError) throw error;
			const text = String(error?.message ?? error);
			if (/not logged in|login required|unauthor|forbidden|401|403/i.test(text)) throw new ShareError("surge-login", `Surge 没有登录：${text}`, GUIDES.surgeLogin);
			if (/ENOENT|not found/i.test(text)) throw new ShareError("surge-missing", `找不到 surge 命令：${text}`, GUIDES.surgeMissing);
			throw new ShareError("surge-failed", text, GUIDES.surgeLogin);
		}
		return {
			domain,
			url: `https://${domain}`
		};
	}
	async #ensureOrigin(mode = "quick") {
		if (this.tunnelOrigin !== null && this.tunnelMode === mode) return this.tunnelOrigin;
		if (this.tunnelOrigin !== null && this.tunnelMode !== mode) await this.#closeTunnel();
		if (this.tunnelStarting !== null) return await this.tunnelStarting;
		this.tunnelStarting = this.#startTunnel(mode).finally(() => {
			this.tunnelStarting = null;
		});
		await this.tunnelStarting;
		return this.tunnelOrigin;
	}
	async #startTunnel(mode = "quick") {
		if (mode === "named") {
			const token = this.config.tunnelToken;
			if (typeof token !== "string" || token === "") throw new Error("命名隧道缺少 token");
			return await this.#startNamedTunnel(token);
		}
		let binary;
		try {
			binary = await this.#cloudflaredBinary();
		} catch (error) {
			if (error instanceof ShareError) throw error;
			this.ctx.logger?.warn?.(`[share-link] cloudflared 不可用，降级为局域网链接：${String(error)}`);
			return;
		}
		const child = spawn(binary, [
			"tunnel",
			"--url",
			`http://127.0.0.1:${this.port}`,
			"--no-autoupdate"
		], { stdio: [
			"ignore",
			"pipe",
			"pipe"
		] });
		this.tunnel = child;
		const origin = await new Promise((resolvePromise, reject) => {
			const timer = setTimeout(() => reject(/* @__PURE__ */ new Error("cloudflared 30s 内没有给出公网地址")), 3e4);
			const onData = (chunk) => {
				const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
				if (match === null) return;
				clearTimeout(timer);
				resolvePromise(match[0]);
			};
			child.stdout.on("data", onData);
			child.stderr.on("data", onData);
			child.on("exit", (code) => {
				clearTimeout(timer);
				reject(/* @__PURE__ */ new Error(`cloudflared 退出（code ${code}）`));
			});
		}).catch((error) => {
			child.kill("SIGTERM");
			this.tunnel = null;
			this.degradedReason = String(error?.message ?? error);
			this.ctx.logger?.warn?.(`[share-link] 隧道启动失败，降级为局域网链接：${String(error)}`);
			return null;
		});
		this.tunnelOrigin = origin;
		this.tunnelMode = mode;
		child.on("exit", () => {
			if (this.tunnel !== child) return;
			this.tunnel = null;
			this.tunnelOrigin = null;
			this.tunnelMode = null;
		});
		return origin;
	}
	/**
	* 命名隧道：地址固定（`https://<tunnelHostname>`），因此分享服务端口也必须固定。
	* @param {string} token
	*/
	async #startNamedTunnel(token) {
		const hostname = this.config.tunnelHostname;
		if (typeof hostname !== "string" || hostname === "") throw new Error("配置了 tunnelToken 但缺少 tunnelHostname：请填写你在 Cloudflare 上绑定的域名");
		const child = spawn(await this.#cloudflaredBinary(), [
			"tunnel",
			"--no-autoupdate",
			"run",
			"--token",
			token
		], { stdio: [
			"ignore",
			"pipe",
			"pipe"
		] });
		this.tunnel = child;
		await new Promise((done) => setTimeout(done, 2500));
		if (child.exitCode !== null) {
			this.tunnel = null;
			throw new Error("cloudflared 命名隧道启动失败：token 无效，或该隧道没有指向本机端口");
		}
		this.tunnelOrigin = `https://${hostname}`;
		this.tunnelMode = "named";
		return this.tunnelOrigin;
	}
	async #closeTunnel() {
		const child = this.tunnel;
		this.tunnel = null;
		this.tunnelOrigin = null;
		if (child === null) return;
		child.kill("SIGTERM");
	}
	#serve(request, response) {
		const url = new URL(request.url ?? "/", `http://127.0.0.1:${this.port}`);
		const send = (status, body, headers = {}) => {
			response.writeHead(status, {
				"cache-control": "no-store",
				"x-content-type-options": "nosniff",
				"x-robots-tag": "noindex, nofollow",
				"referrer-policy": "no-referrer",
				...headers
			});
			response.end(body);
		};
		if (request.method !== "GET" && request.method !== "HEAD") return send(405, "method not allowed");
		if (url.pathname === "/healthz") return send(200, "ok");
		const match = url.pathname.match(/^\/s\/([0-9a-z]{8,32})(\/.*)?$/);
		if (match === null) return send(404, "not found");
		const [, id, rest = "/"] = match;
		const entry = this.#readIndex()[id];
		if (entry === void 0) return send(404, "not found");
		if (typeof entry.expiresAt === "number" && entry.expiresAt <= Date.now()) return send(404, "not found");
		const base = join(this.sharesDir, id);
		const file = resolve(base, `.${rest === "/" ? "/index.html" : rest}`);
		if (!file.startsWith(base + sep)) return send(403, "forbidden");
		if (!existsSync(file) || statSync(file).isDirectory()) return send(404, "not found");
		return send(200, readFileSync(file), { "content-type": mimeOf(file) });
	}
};
/**
* 下载 cloudflared 并解压到 `binDir`，返回可执行文件路径。
*
* 两个源**按顺序试**，但第一个源带「慢速探测」：3 秒内拿不到 200 KB 就换下一个。
* 实测同一个网络上 GitHub 直连只有 18 KB/s（20 MB ≈ 18 分钟），ghproxy 有 180 KB/s，
* 只换顺序不做探测的话，一部分用户会白等十几分钟。
*
* @param {string} binDir
* @param {(progress: {received: number, total: number}) => void} onProgress
* @returns {Promise<string>}
*/
async function downloadCloudflared(binDir, onProgress = () => {}) {
	mkdirSync(binDir, { recursive: true });
	const asset = cloudflaredAsset();
	const archive = join(binDir, `${asset}.tmp`);
	const sources = [`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`, `https://ghproxy.net/https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`];
	const errors = [];
	for (const [index, url] of sources.entries()) try {
		await downloadTo(url, archive, onProgress, { probe: index === 0 });
		break;
	} catch (error) {
		errors.push(`${url}: ${String(error?.message ?? error)}`);
		if (index === sources.length - 1) throw new Error(`下载 cloudflared 失败\n${errors.join("\n")}`);
	}
	if (IS_WINDOWS) {
		const binary = join(binDir, BINARY_NAME);
		writeFileSync(binary, readFileSync(archive));
		rmSync(archive, { force: true });
		return binary;
	}
	await new Promise((done, fail) => {
		const tar = spawn("tar", [
			"-xzf",
			archive,
			"-C",
			binDir
		], { stdio: "inherit" });
		tar.on("exit", (code) => code === 0 ? done() : fail(/* @__PURE__ */ new Error(`tar 退出 ${code}`)));
		tar.on("error", fail);
	});
	rmSync(archive, { force: true });
	const binary = join(binDir, "cloudflared");
	if (!existsSync(binary)) throw new Error("解压后没有 cloudflared");
	return binary;
}
/** @returns {string} 当前平台对应的 release 资产名。 */
function cloudflaredAsset() {
	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	if (IS_WINDOWS) return `cloudflared-windows-${arch}.exe`;
	return `cloudflared-${process.platform === "darwin" ? "darwin" : "linux"}-${arch}.tgz`;
}
/**
* 把一个 URL 下载到文件，带进度回调、卡死探测与总超时。
* @param {string} url
* @param {string} file
* @param {(progress: {received: number, total: number}) => void} onProgress
* @param {{probe?: boolean}} [options] - `probe`：前 raceMs 内不到 raceBytes 就主动放弃
* @returns {Promise<void>}
*/
async function downloadTo(url, file, onProgress, options = {}) {
	const controller = new AbortController();
	let received = 0;
	let stall;
	const arm = () => {
		clearTimeout(stall);
		stall = setTimeout(() => controller.abort(/* @__PURE__ */ new Error(`${DOWNLOAD.stallMs / 1e3}s 没有新数据`)), DOWNLOAD.stallMs);
	};
	const hardStop = setTimeout(() => controller.abort(/* @__PURE__ */ new Error("下载超时")), DOWNLOAD.totalMs);
	const probe = options.probe === true ? setTimeout(() => {
		if (received < DOWNLOAD.raceBytes) controller.abort(/* @__PURE__ */ new Error(`太慢（${received} B / ${DOWNLOAD.raceMs / 1e3}s）`));
	}, DOWNLOAD.raceMs) : void 0;
	try {
		arm();
		const response = await fetch(url, {
			redirect: "follow",
			signal: controller.signal
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const total = Number(response.headers.get("content-length") ?? 0);
		const chunks = [];
		for await (const chunk of response.body) {
			received += chunk.length;
			chunks.push(chunk);
			arm();
			onProgress({
				received,
				total
			});
		}
		writeFileSync(file, Buffer.concat(chunks));
	} finally {
		clearTimeout(stall);
		clearTimeout(hardStop);
		clearTimeout(probe);
	}
}
/** @param {number} bytes @returns {string} */
function formatMb(bytes) {
	if (!(bytes > 0)) return "0 MB";
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
/**
* 运行一个外部发布工具：优先用 PATH 上的同名可执行文件，否则退回 `npx --yes <name>`。
* @param {string} name
* @param {string[]} args
* @param {NodeJS.ProcessEnv} env
* @returns {Promise<string>} 合并后的 stdout + stderr。
*/
function runTool(name, args, env) {
	const binary = findOnPath(name);
	return new Promise((resolvePromise, reject) => {
		const argv = binary === void 0 ? [
			"--yes",
			name,
			...args
		] : args;
		const child = spawn(binary ?? "npx", argv, {
			env,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			],
			shell: binary === void 0 && IS_WINDOWS
		});
		let output = "";
		child.stdout.on("data", (chunk) => {
			output += String(chunk);
		});
		child.stderr.on("data", (chunk) => {
			output += String(chunk);
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolvePromise(output);
			else reject(/* @__PURE__ */ new Error(`${name} 退出 ${code}：${output.slice(-400)}`));
		});
	});
}
/**
* 在 PATH 上找可执行文件（同步：预热与发布路径都要立刻判断）。
* @param {string} name
* @returns {string|undefined}
*/
function findOnPath(name) {
	const candidates = IS_WINDOWS ? [
		`${name}.exe`,
		`${name}.cmd`,
		`${name}.bat`,
		name
	] : [name];
	for (const dir of (process.env.PATH ?? "").split(delimiter)) {
		if (dir === "") continue;
		for (const candidate of candidates) {
			const full = join(dir, candidate);
			try {
				if (statSync(full).isFile()) return full;
			} catch {}
		}
	}
}
//#endregion
//#region src/index.mjs
/**
* dsh-share-link · Host half
*
* 把「一个产物」发布成只读公网链接：会话快照或本地文件/目录 → 静态目录 +
* cloudflared 隧道 → `https://xxx.trycloudflare.com/s/<token>/`。
*
* 刻意不做的事：不透传主 GUI（3080）、不代理工具调用、不提供写接口。分享面
* 只有「静态文件 + 一个只读 GET 路由」。
*
* @module @vlln/dsh-share-link
*/
const name = "dsh-share-link";
/** 分享服务依赖的宿主能力：工具注册、会话读取、同源 HTTP 路由。 */
const inject = [
	"tools",
	"sessionQuery",
	"connection"
];
/** 配置项。`port` 传 0 表示随机端口（推荐，避免与宿主端口冲突）。 */
/** 配置默认值（设置卡与运行时共用同一份，避免两处漂移）。 */
const DEFAULTS = Object.freeze({
	defaultChannel: "quick",
	provider: "tunnel",
	tunnelMode: "quick",
	port: 0,
	ttlHours: 168,
	cloudflaredPath: "",
	tunnelToken: "",
	tunnelHostname: "",
	surgeLogin: "",
	surgeToken: "",
	surgeDomain: "",
	surgePrefix: "dsh-share",
	pageTheme: "paper",
	pageThemeCss: "",
	idLength: CODE_LENGTH.default,
	toolShareSession: false,
	toolShareArtifact: false,
	toolShareList: false,
	toolShareRevoke: false
});
const Config = Schema.object({
	defaultChannel: Schema.union([
		"quick",
		"surge",
		"named",
		"lan"
	]).default(DEFAULTS.defaultChannel).volatile().description("分享弹窗里默认选中的通道"),
	provider: Schema.union([
		"tunnel",
		"lan",
		"surge"
	]).default(DEFAULTS.provider).volatile().description("tunnel = 公网 cloudflared（可撤销）；lan = 仅同局域网；surge = Surge 持久域名（可 teardown）"),
	tunnelMode: Schema.union(["quick", "named"]).default(DEFAULTS.tunnelMode).volatile().description("quick = cloudflared 临时域名；named = 你在 Cloudflare 自建的固定域名隧道（需要自有域名）"),
	port: Schema.natural().default(DEFAULTS.port).volatile().description("只读分享服务端口，0 = 随机（命名隧道模式下自动用 3089）"),
	idLength: Schema.natural().min(CODE_LENGTH.min).max(CODE_LENGTH.max).default(DEFAULTS.idLength).volatile().description("分享链接里的短码长度：8 位 ≈ 41 bit 熵（默认，够发也够难猜），10 位 ≈ 52 bit，16 位 ≈ 83 bit"),
	ttlHours: Schema.natural().min(1).max(720).default(DEFAULTS.ttlHours).volatile().description("分享链接默认有效期（小时）"),
	cloudflaredPath: Schema.string().default(DEFAULTS.cloudflaredPath).volatile().description("已有 cloudflared 可执行文件路径；留空则自动查找/下载"),
	tunnelToken: Schema.string().default(DEFAULTS.tunnelToken).volatile().description("Cloudflare 命名隧道的 token；填了就产出固定域名链接"),
	tunnelHostname: Schema.string().default(DEFAULTS.tunnelHostname).volatile().description("命名隧道绑定的域名，例如 share.example.com"),
	surgeLogin: Schema.string().default(DEFAULTS.surgeLogin).volatile().description("Surge 账号邮箱；配合 surgeToken 免交互登录"),
	surgeToken: Schema.string().default(DEFAULTS.surgeToken).volatile().description("Surge token（`surge tokens add`）；只注入给子进程，不落盘"),
	surgeDomain: Schema.string().default(DEFAULTS.surgeDomain).volatile().description("Surge 域名后缀，例如 example.com；留空用 slug.surge.sh"),
	surgePrefix: Schema.string().default(DEFAULTS.surgePrefix).volatile().description("Surge 子域前缀，最终域名是 <prefix>-<id>.surge.sh"),
	pageTheme: Schema.union([
		"paper",
		"github",
		"notion",
		"sepia",
		"terminal",
		"custom"
	]).default("paper").volatile().description("分享页预设风格；custom = 只用 pageThemeCss"),
	pageThemeCss: Schema.string().default("").volatile().description("自定义 CSS，追加在预设之后（可只写变量覆盖）"),
	toolShareSession: Schema.boolean().default(false).volatile().description("允许 agent 调用 share_session（默认关闭）"),
	toolShareArtifact: Schema.boolean().default(false).volatile().description("允许 agent 调用 share_artifact（默认关闭）"),
	toolShareList: Schema.boolean().default(false).volatile().description("允许 agent 调用 share_list（默认关闭）"),
	toolShareRevoke: Schema.boolean().default(false).volatile().description("允许 agent 调用 share_revoke（默认关闭）")
});
/**
* 解引用 volatile 叶并补默认值。volatile 叶在运行时是 `{ get() }` 包装，
* 每次要用就重读——别缓存引用本身。
* @param {any} raw
*/
function readConfig(raw) {
	const unwrap = (value) => {
		if (value !== null && typeof value === "object" && typeof value.get === "function" && Object.keys(value).length === 1) return unwrap(value.get());
		if (Array.isArray(value)) return value.map(unwrap);
		if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, unwrap(item)]));
		return value;
	};
	return {
		...DEFAULTS,
		...unwrap(raw ?? {})
	};
}
/** 通道的中文说法，用于工具回复。 */
const CHANNEL_LABEL = {
	tunnel: "公网隧道",
	lan: "局域网",
	surge: "Surge 持久域名"
};
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
/**
* 注册分享服务、工具与同源路由。
* @param {any} ctx - host 上下文。
* @param {any} [config]
*/
function apply(ctx, config = {}) {
	let liveConfig = readConfig(config);
	const manager = new ShareManager({
		ctx,
		config: liveConfig
	});
	ctx.effect(() => ctx.on("loader/volatile-update", () => {
		liveConfig = readConfig(config);
		manager.config = liveConfig;
		syncTools();
	}), "share-link: live config");
	ctx.effect(() => {
		manager.start().catch((error) => {
			ctx.logger?.warn?.(`[share-link] 分享服务未启动：${String(error)}`);
		});
		return () => {
			manager.stop();
		};
	}, "share-link: readonly server");
	const TOOL_DEFS = {
		toolShareSession: defineTool({
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
				return describeShare(await manager.createSessionShare(sessionId, {
					includeToolCalls: args.include_tool_calls === true,
					channel: args.channel,
					title: args.title,
					ttlHours: args.ttl_hours
				}).catch((error) => {
					throw new Error(describeError(error));
				}));
			}
		}),
		toolShareArtifact: defineTool({
			name: "share_artifact",
			description: "Publish a local file or directory (HTML page, Markdown, slides, build output) as a read-only public link. Directories must contain index.html; a single .html file is served at the link root.",
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
				return describeShare(await manager.createPathShare(args.path, {
					cwd,
					title: args.title,
					ttlHours: args.ttl_hours
				}).catch((error) => {
					throw new Error(describeError(error));
				}));
			}
		}),
		toolShareList: defineTool({
			name: "share_list",
			description: "List the currently active share links with their ids, kinds, and expiry.",
			parameters: {},
			output: TEXT_OUTPUT,
			execute: async () => {
				const entries = manager.list();
				if (entries.length === 0) return "当前没有活跃的分享链接。";
				return entries.map((entry) => `${entry.id}  ${entry.kind === "session" ? "会话" : "文件"}  ${new Date(entry.createdAt).toISOString().slice(0, 16)} UTC  ${entry.url}`).join("\n");
			}
		}),
		toolShareRevoke: defineTool({
			name: "share_revoke",
			description: "Revoke one share link by id. The link stops working immediately and its snapshot is deleted from disk.",
			parameters: { id: {
				type: "string",
				required: true,
				description: "share_session / share_artifact 返回的 id"
			} },
			output: TEXT_OUTPUT,
			execute: async (args) => await manager.revoke(args.id) ? `已撤销 ${args.id}，链接立即失效。` : `没有找到 ${args.id}`
		})
	};
	const toolDisposers = /* @__PURE__ */ new Set();
	function syncTools() {
		for (const dispose of toolDisposers) dispose();
		toolDisposers.clear();
		for (const [flag, definition] of Object.entries(TOOL_DEFS)) {
			if (liveConfig[flag] !== true) continue;
			toolDisposers.add(ctx.tools.register(definition));
		}
	}
	ctx.effect(() => {
		syncTools();
		return () => {
			for (const dispose of toolDisposers) dispose();
			toolDisposers.clear();
		};
	}, "share-link: tools");
	const route = (path, methods, handler) => ctx.connection.fetch.register({
		path,
		methods,
		requestBody: "buffered",
		fetch: async (request) => {
			const origin = request.headers.get("origin");
			const host = request.headers.get("host");
			if (origin !== null && host !== null && new URL(origin).host !== host) return json({ error: "cross-origin request rejected" }, 403);
			try {
				return await handler(request);
			} catch (error) {
				return json({
					error: String(error?.message ?? error),
					code: error?.code,
					guide: error?.guide
				}, 400);
			}
		}
	});
	route("/api/share-link/session", ["POST"], async (request) => {
		const body = await readJson(request);
		return json(await manager.createSessionShare(body.sessionId, {
			includeToolCalls: body.includeToolCalls === true,
			channel: body.channel,
			title: body.title,
			ttlHours: body.ttlHours
		}));
	});
	route("/api/share-link/path", ["POST"], async (request) => {
		const body = await readJson(request);
		return json(await manager.createPathShare(body.path, {
			channel: body.channel,
			title: body.title,
			ttlHours: body.ttlHours,
			cwd: body.cwd
		}));
	});
	route("/api/share-link/status", ["GET"], async () => json(await manager.status()));
	route("/api/share-link/warm", ["POST"], async () => {
		manager.prewarm();
		return json(manager.downloadInfo());
	});
	route("/api/share-link/preview", ["POST"], async (request) => {
		const body = await readJson(request);
		const html = manager.previewPage({
			theme: body.theme,
			customCss: body.customCss
		});
		return new Response(html, {
			status: 200,
			headers: { "content-type": "text/html; charset=utf-8" }
		});
	});
	route("/api/share-link/list", ["GET"], async () => json({ items: manager.list() }));
	route("/api/share-link/revoke", ["POST"], async (request) => {
		const body = await readJson(request);
		return json({ revoked: await manager.revoke(body.id) });
	});
}
/** @param {any} request */
async function readJson(request) {
	const text = await request.text();
	if (text.trim() === "") return {};
	return JSON.parse(text);
}
/** @param {unknown} payload @param {number} [status] */
function json(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}
//#endregion
export { Config, DEFAULTS, apply, inject, name, readConfig };
