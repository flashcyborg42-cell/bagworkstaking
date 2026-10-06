"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/vercel/stake.ts
var stake_exports = {};
__export(stake_exports, {
  default: () => stake_default
});
module.exports = __toCommonJS(stake_exports);

// src/lib/node-handler.ts
function copyHeaders(raw, headers) {
  if (!raw) return;
  if (typeof raw.forEach === "function") {
    raw.forEach((value, key) => headers.set(key, value));
    return;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (value == null || key === "get" || key === "forEach") continue;
    headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
}
function headerValue(headers, name) {
  return (headers.get(name) ?? "").split(",")[0]?.trim() ?? "";
}
function publicOrigin(request) {
  const url = new URL(request.url);
  const host = headerValue(request.headers, "x-forwarded-host") || headerValue(request.headers, "host") || url.host;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  const proto = local ? headerValue(request.headers, "x-forwarded-proto") || url.protocol.replace(":", "") || "http" : "https";
  return `${proto}://${host}`;
}
function nodeToRequest(req) {
  const headers = new Headers();
  copyHeaders(req.headers, headers);
  const host = headerValue(headers, "x-forwarded-host") || headerValue(headers, "host") || "localhost";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/i.test(host);
  const proto = local ? headerValue(headers, "x-forwarded-proto") || "https" : "https";
  const path = req.url ?? "/";
  const url = path.startsWith("http") ? path : `${proto}://${host}${path}`;
  return new Request(url, { method: req.method ?? "GET", headers });
}
async function sendNodeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}
function isNodeResponse(res) {
  return Boolean(res && typeof res === "object" && "setHeader" in res && "end" in res);
}
function asRequest(req) {
  try {
    if (typeof Request !== "undefined" && req instanceof Request) return req;
  } catch {
  }
  return nodeToRequest(req);
}
function pathContract(request) {
  const url = new URL(request.url);
  const hinted = url.searchParams.get("ca") ?? "";
  if (hinted) return decodeURIComponent(hinted);
  return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
}
function fallbackShareHtml(request) {
  const origin = request ? publicOrigin(request) : "";
  const image = origin ? `${origin}/share-card.png` : "/share-card.png";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="twitter:card" content="summary_large_image"/><meta property="og:image" content="${image}"/><meta property="og:image:secure_url" content="${image}"/></head><body>Bagwork</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
function nodeApiHandler(render, fallback) {
  return async function handler(req, res) {
    let request;
    try {
      request = asRequest(req);
      const response = await render(request);
      if (isNodeResponse(res)) {
        await sendNodeResponse(res, response);
        return;
      }
      return response;
    } catch {
      const response = fallback(request);
      if (isNodeResponse(res)) {
        try {
          await sendNodeResponse(res, response);
        } catch {
          res.statusCode = 500;
          res.end("Bagwork");
        }
        return;
      }
      return response;
    }
  };
}

// src/lib/token-types.ts
function shortContract(contract) {
  return `${contract.slice(0, 6)}\u2026${contract.slice(-6)}`;
}
function contractHue(contract) {
  let hash = 0;
  for (const char of contract) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
function isSolanaAddress(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

// src/lib/token-resolver.ts
var cache = /* @__PURE__ */ new Map();
var FALLBACK_IMAGE = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#11131b"/><circle cx="400" cy="400" r="300" fill="#19e88d"/><path d="M285 535V265h132c78 0 128 38 128 101 0 38-20 67-54 83l77 86H452l-56-69h-12v69H285zm99-151h28c27 0 42-12 42-33 0-20-15-31-42-31h-28v64z" fill="#090a0f"/></svg>`);
function cleanUrl(value) {
  if (typeof value !== "string" || !value.trim()) return void 0;
  let url = value.trim().replace(/^Https:/, "https:").replace(/^Http:/, "http:");
  if (url.startsWith("ipfs://")) url = `https://ipfs.io/ipfs/${url.slice(7)}`;
  if (url.startsWith("ar://")) url = `https://arweave.net/${url.slice(5)}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : void 0;
  } catch {
    return void 0;
  }
}
var IPFS_GATEWAYS = [
  "https://pump.mypinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/"
];
function expandGateways(url) {
  const match = /\/ipfs\/([^?#]+)/.exec(url);
  if (!match?.[1]) return [url];
  const path = match[1];
  return [...IPFS_GATEWAYS.map((gateway) => `${gateway}${path}`), url];
}
function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function compact(value, currency = true) {
  if (value === void 0) return "\u2014";
  return `${currency ? "$" : ""}${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
}
function price(value) {
  if (value === void 0) return "\u2014";
  if (value < 1e-4) return `$${value.toExponential(2)}`;
  return `$${value.toLocaleString("en", { maximumFractionDigits: value < 1 ? 6 : 2 })}`;
}
function safeText(value, fallback, max = 60) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
async function jsonFetch(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.json();
}
async function resolveToken(rawAddress) {
  const address = rawAddress.trim();
  if (!isSolanaAddress(address)) throw new Error("Invalid contract address");
  const cached = cache.get(address);
  if (cached && cached.expires > Date.now()) return cached.value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  const [dexResult, jupiterResult] = await Promise.allSettled([
    jsonFetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`, controller.signal),
    jsonFetch(`https://lite-api.jup.ag/tokens/v2/search?query=${address}`, controller.signal)
  ]);
  clearTimeout(timeout);
  const dexList = dexResult.status === "fulfilled" && Array.isArray(dexResult.value) ? dexResult.value : [];
  const dex = dexList.filter((item) => Boolean(item && typeof item === "object")).sort((a, b) => Number(b["liquidity"]?.["usd"] ?? 0) - Number(a["liquidity"]?.["usd"] ?? 0))[0];
  const jupiterList = jupiterResult.status === "fulfilled" && Array.isArray(jupiterResult.value) ? jupiterResult.value : [];
  const jupiter = jupiterList.find((item) => Boolean(item && typeof item === "object" && item["id"] === address));
  if (!dex && !jupiter) throw new Error("Token metadata was not found yet. Try again after the token is indexed.");
  const dexBase = dex?.["baseToken"];
  const dexInfo = dex?.["info"];
  const dexLiquidity = dex?.["liquidity"];
  const dexVolume = dex?.["volume"];
  const dexChange = dex?.["priceChange"];
  const jStats = jupiter?.["stats24h"];
  const candidates = [dexInfo?.["imageUrl"], jupiter?.["icon"], dexInfo?.["openGraph"]].map(cleanUrl).filter((item) => Boolean(item)).flatMap(expandGateways);
  candidates.push(`https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png`);
  const uniqueCandidates = [...new Set(candidates)];
  const symbol = safeText(dexBase?.["symbol"] ?? jupiter?.["symbol"], "TOKEN", 14).toUpperCase();
  const name = safeText(dexBase?.["name"] ?? jupiter?.["name"], "Solana Token", 42);
  const marketCap = number(dex?.["marketCap"]) ?? number(jupiter?.["mcap"]);
  const liquidity = number(dexLiquidity?.["usd"]) ?? number(jupiter?.["liquidity"]);
  const volume24h = number(dexVolume?.["h24"]) ?? ((number(jStats?.["buyVolume"]) ?? 0) + (number(jStats?.["sellVolume"]) ?? 0) || void 0);
  const change24h = number(dexChange?.["h24"]) ?? number(jStats?.["priceChange"]);
  const holderCount = number(jupiter?.["holderCount"]);
  const visual = {
    contractFull: address,
    contract: shortContract(address),
    name,
    ticker: `$${symbol}`,
    symbol,
    image: uniqueCandidates[0] ?? FALLBACK_IMAGE,
    imageCandidates: [...uniqueCandidates, FALLBACK_IMAGE],
    imageAlt: `${name} token artwork`,
    price: price(Number(dex?.["priceUsd"] ?? jupiter?.["usdPrice"]) || void 0),
    liquidity: compact(liquidity),
    marketCap: compact(marketCap),
    volume24h: compact(volume24h),
    change24h: change24h === void 0 ? "\u2014" : `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`,
    ...holderCount !== void 0 ? { holders: compact(holderCount, false) } : {},
    source: dex ? "DexScreener" : "Jupiter",
    apy: "48.6%*",
    tvl: compact(liquidity),
    paid: "12,840*",
    walletBalance: "4.20M*",
    pending: "8.24*",
    tier: "Diamond Hands*",
    hue: contractHue(address)
  };
  cache.set(address, { expires: Date.now() + 6e4, value: visual });
  return visual;
}

// src/lib/card-shared.ts
function versionFromToken(token) {
  if (!token) return void 0;
  const value = token.trim().toLowerCase();
  if (value === "3" || value.startsWith("3") || value === "v3" || value.startsWith("v3")) return 3;
  if (value === "2" || value.startsWith("2") || value === "v2" || value.startsWith("v2")) return 2;
  return void 0;
}
function requestedVersion(url) {
  const fromV = versionFromToken(url.searchParams.get("v"));
  if (fromV) return fromV;
  for (const key of url.searchParams.keys()) {
    const pinned = versionFromToken(key);
    if (pinned) return pinned;
  }
  return Math.random() < 0.5 ? 2 : 3;
}
function hasExplicitVersion(url) {
  if (versionFromToken(url.searchParams.get("v"))) return true;
  for (const key of url.searchParams.keys()) {
    if (versionFromToken(key)) return true;
  }
  return false;
}
function isCrawler(request) {
  return /Twitterbot|Discordbot|Slackbot|facebookexternalhit|Facebot|LinkedInBot|TelegramBot|WhatsApp|SkypeUriPreview|redditbot|Applebot|Googlebot|Iframely|Embedly|OpenGraph|vkShare|Pinterest|W3C_Validator|preview/i.test(
    request.headers.get("user-agent") ?? ""
  );
}
function contractFromRequest(request, hinted = "") {
  const candidates = [hinted];
  try {
    const url = new URL(request.url);
    candidates.push(url.searchParams.get("ca") ?? "");
    for (const part of url.pathname.split("/")) candidates.push(part);
  } catch {
  }
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const value = decodeURIComponent(raw);
      if (isSolanaAddress(value)) return value;
    } catch {
    }
  }
  return hinted;
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// src/lib/host-files.ts
var import_meta = {};
async function readHostFile(relativePaths) {
  try {
    const { readFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const roots = [];
    const cwd = process.cwd();
    roots.push(cwd);
    const lambdaRoot = process.env["LAMBDA_TASK_ROOT"] ?? process.env["VERCEL_DIR"] ?? "";
    if (lambdaRoot) roots.push(lambdaRoot);
    try {
      roots.push(dirname(fileURLToPath(import_meta.url)));
    } catch {
    }
    try {
      roots.push(fileURLToPath(new URL(".", import_meta.url)));
      roots.push(fileURLToPath(new URL("../..", import_meta.url)));
      roots.push(fileURLToPath(new URL("../../..", import_meta.url)));
    } catch {
    }
    const uniqueRoots = [...new Set(roots.filter(Boolean))];
    for (const root of uniqueRoots) {
      for (const relative of relativePaths) {
        const names = [relative, relative.replaceAll("\\", "/")];
        const base = relative.split(/[/\\]/).pop();
        if (base) names.push(base);
        for (const name of names) {
          try {
            return await readFile(join(root, name));
          } catch {
          }
        }
      }
    }
  } catch {
  }
  return void 0;
}
async function readHostText(relativePaths) {
  const bytes = await readHostFile(relativePaths);
  return bytes ? new TextDecoder().decode(bytes) : void 0;
}

// src/lib/card-html.ts
var shellCache;
function crawlerDocument(opts) {
  const { title, social, description, image, pageUrl, origin } = opts;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(social)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(social)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(social)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <meta name="twitter:image:src" content="${escapeHtml(image)}" />
    <link rel="canonical" href="${escapeHtml(pageUrl)}" />
    <link rel="icon" href="${escapeHtml(origin)}/favicon.ico" />
  </head>
  <body>
    <p>${escapeHtml(social)}</p>
    <p><a href="${escapeHtml(pageUrl)}">Open staking</a></p>
  </body>
</html>`;
}
async function loadShell(request) {
  if (shellCache) return shellCache;
  const fromDisk = await readHostText([
    "index.html",
    "dist-static/index.html",
    "static/index.html"
  ]);
  if (fromDisk?.includes('<div id="root"')) {
    shellCache = fromDisk;
    return fromDisk;
  }
  try {
    const response = await fetch(new URL("/index.html", request.url), {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(2e3)
    });
    if (!response.ok) return void 0;
    const html = await response.text();
    if (html.includes('<div id="root"')) {
      shellCache = html;
      return html;
    }
  } catch {
  }
  return void 0;
}
function injectTags(html, head) {
  const stripped = html.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta\s+name="description"[^>]*>/gi, "").replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "").replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "");
  return stripped.replace(/<\/head>/i, `    ${head}
  </head>`);
}
async function renderStakeHtmlResponse(request, ca) {
  const url = new URL(request.url);
  ca = contractFromRequest(request, ca);
  const origin = publicOrigin(request);
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  let ticker = "$TOKEN";
  let name = "Solana token";
  if (isSolanaAddress(ca)) {
    try {
      const token = await resolveToken(ca);
      ticker = token.ticker;
      name = token.name;
    } catch {
    }
  }
  const explicit = hasExplicitVersion(url);
  const version = requestedVersion(url);
  const title = `${ticker} Hourly Staking \u2014 Earn SOL | Bagwork`;
  const social = `${ticker} \u2014 Stake from 30 Minutes. Earn SOL.`;
  const description = `Stake ${ticker} from 30 minutes. Liquidity-pool yield is shared with ${name} stakers in SOL.`;
  const image = isSolanaAddress(ca) ? `${origin}/api/public/og/${encodeURIComponent(ca)}?v=${version}` : `${origin}/share-card.png`;
  const pageUrl = `${origin}/stake/${encodeURIComponent(ca)}${explicit ? `?v=${version}` : ""}`;
  const document = {
    title,
    social,
    description,
    image,
    pageUrl,
    origin
  };
  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(social)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(social)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(social)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<meta name="twitter:image:src" content="${escapeHtml(image)}" />`
  ].join("\n    ");
  try {
    if (isCrawler(request) || !isSolanaAddress(ca)) {
      return new Response(crawlerDocument(document), { headers });
    }
    const shell = await loadShell(request);
    if (!shell) return new Response(crawlerDocument(document), { headers });
    return new Response(injectTags(shell, head), { headers });
  } catch {
    return new Response(crawlerDocument({ ...document, image: `${origin}/share-card.png` }), { headers });
  }
}

// server/vercel/stake.ts
var stake_default = nodeApiHandler(
  (request) => renderStakeHtmlResponse(request, pathContract(request)),
  fallbackShareHtml
);

;module.exports = typeof module.exports === "function" ? module.exports : module.exports.default;
if (typeof module.exports !== "function") {
  throw new Error("Bagwork Vercel handler is not a function");
}
