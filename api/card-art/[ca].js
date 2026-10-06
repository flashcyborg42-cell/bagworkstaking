"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/vercel/art.ts
var art_exports = {};
__export(art_exports, {
  default: () => art_default
});
module.exports = __toCommonJS(art_exports);

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

// src/lib/host-files.ts
function toArrayBuffer(body) {
  const view = body instanceof Uint8Array ? body : new Uint8Array(body);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return copy;
}

// src/lib/card-artwork.ts
function preferRasterUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return url;
    const host = parsed.hostname;
    if (host.endsWith("dexscreener.com") || parsed.searchParams.get("format") === "auto") {
      parsed.searchParams.set("format", "png");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
function sniffRasterType(bytes, declared = "") {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view[0] === 137 && view[1] === 80 && view[2] === 78 && view[3] === 71) return "image/png";
  if (view[0] === 255 && view[1] === 216 && view[2] === 255) return "image/jpeg";
  if (view[0] === 71 && view[1] === 73 && view[2] === 70) return "image/gif";
  if (view.length >= 12 && view[0] === 82 && view[1] === 73 && view[2] === 70 && view[3] === 70) {
    const tag = String.fromCharCode(view[8], view[9], view[10], view[11]);
    if (tag === "WEBP") return "image/webp";
  }
  const type = declared.split(";")[0]?.trim().toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/gif") return type;
  return void 0;
}
function artworkUrls(candidates) {
  const urls = [];
  for (const candidate of candidates) {
    if (!candidate.startsWith("https://")) continue;
    const raster = preferRasterUrl(candidate);
    if (raster !== candidate) urls.push(raster);
    urls.push(candidate);
  }
  return [...new Set(urls)].slice(0, 8);
}
async function fetchRaster(url) {
  const response = await fetch(url, {
    headers: { Accept: "image/png,image/jpeg,image/gif;q=0.9,image/webp;q=0.4" },
    signal: AbortSignal.timeout(4e3)
  });
  if (!response.ok) throw new Error("Artwork unavailable");
  const bytes = await response.arrayBuffer();
  const declared = response.headers.get("content-type") ?? "";
  const type = sniffRasterType(bytes, declared);
  if (!type || type === "image/webp") throw new Error("Unsupported artwork");
  return { bytes, type };
}
async function loadArtworkFile(candidates) {
  const artwork = await Promise.any(artworkUrls(candidates).map((url) => fetchRaster(url)));
  return { body: toArrayBuffer(artwork.bytes), type: artwork.type };
}

// src/lib/card-art.ts
async function renderArtResponse(ca, request) {
  if (request) ca = contractFromRequest(request, ca);
  if (!isSolanaAddress(ca)) return new Response("Invalid contract address", { status: 400 });
  try {
    const token = await resolveToken(ca);
    const image = await loadArtworkFile(token.imageCandidates);
    return new Response(image.body, {
      headers: {
        "Content-Type": image.type,
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch {
    return new Response("Artwork unavailable", { status: 404 });
  }
}

// server/vercel/art.ts
var art_default = nodeApiHandler(
  (request) => renderArtResponse(pathContract(request), request),
  () => new Response("Artwork unavailable", { status: 404 })
);

;module.exports = typeof module.exports === "function" ? module.exports : module.exports.default;
if (typeof module.exports !== "function") {
  throw new Error("Bagwork Vercel handler is not a function");
}
