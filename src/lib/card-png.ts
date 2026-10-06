/**
 * Host-agnostic preview-card renderer.
 *
 * Cards are SVG (text outlined with opentype.js) composited with resvg-wasm so
 * Netlify, Vercel Node, and Cloudflare Pages never pull JSX card renderers.
 */
import { initWasm, Resvg } from "./vendor/resvg-wasm/index.mjs";
import { resolveToken } from "./token-resolver";
import { isSolanaAddress } from "./token-types";
import type { TokenVisual } from "./token-types";
import {
  contractFromRequest,
  escapeXml,
  hasExplicitVersion,
  requestedVersion,
} from "./card-shared";
import { loadArtworkDataUri } from "./card-artwork";
import { readHostFile, toArrayBuffer } from "./host-files";
import { makeTextWriter, parseCardFonts, type CardFonts, type TextWriter } from "./svg-text";

let wasmReady: Promise<void> | undefined;
let regularFontData: Promise<Uint8Array> | undefined;
let boldFontData: Promise<Uint8Array> | undefined;
let cardFonts: CardFonts | undefined;
const pngCache = new Map<string, { expires: number; body: ArrayBuffer }>();

const REGULAR_FONT = "https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7EPCw.ttf";
const BOLD_FONT = "https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3t-4c4A.ttf";
const EMPTY_PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

function wasmBytesAllowed() {
  return globalThis.navigator?.userAgent !== "Cloudflare-Workers";
}

function wasmSource(value: unknown): BufferSource | WebAssembly.Module {
  if (value && typeof value === "object" && "default" in value) {
    return wasmSource((value as { default: unknown }).default);
  }
  return value as BufferSource | WebAssembly.Module;
}

async function loadWasm(requestUrl: string) {
  wasmReady ??= (async () => {
    if (!wasmBytesAllowed()) {
      throw new Error("Cloudflare Workers need an imported WebAssembly.Module");
    }
    const fromPkg = await readHostFile([
      "src/lib/vendor/resvg-wasm/index_bg.wasm",
      "vendor/resvg-wasm/index_bg.wasm",
      "index_bg.wasm",
      "node_modules/@resvg/resvg-wasm/index_bg.wasm",
    ]);
    if (fromPkg) {
      await initWasm(fromPkg);
      return;
    }
    try {
      const { createRequire } = await import("node:module");
      const { readFile } = await import("node:fs/promises");
      const wasmPath = createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm");
      await initWasm(await readFile(wasmPath));
      return;
    } catch {
      /* fall through to HTTP */
    }
    const bundled = await readHostFile(["wasm/resvg.wasm", "dist-static/wasm/resvg.wasm", "static-public/wasm/resvg.wasm", "functions/wasm/resvg.wasm"]);
    if (bundled) {
      await initWasm(bundled);
      return;
    }
    const response = await fetch(new URL("/wasm/resvg.wasm", requestUrl), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Preview renderer unavailable");
    await initWasm(await response.arrayBuffer());
  })().catch((error: unknown) => {
    wasmReady = undefined;
    if (error instanceof Error && /already/i.test(error.message)) return;
    throw error;
  });
  return wasmReady;
}

export async function seedWasm(bytes: BufferSource | WebAssembly.Module | { default?: BufferSource | WebAssembly.Module }) {
  wasmReady ??= initWasm(wasmSource(bytes)).catch((error: unknown) => {
    wasmReady = undefined;
    if (error instanceof Error && /already/i.test(error.message)) return;
    throw error;
  });
  return wasmReady;
}

async function fontBytes(kind: "regular" | "bold", requestUrl: string) {
  const file = kind === "regular" ? "barlow-regular.ttf" : "barlow-bold.ttf";
  const remote = kind === "regular" ? REGULAR_FONT : BOLD_FONT;
  const fromDisk = await readHostFile([
    `fonts/${file}`,
    `static-public/fonts/${file}`,
    `dist-static/fonts/${file}`,
  ]);
  if (fromDisk) return fromDisk;
  for (const href of [new URL(`/fonts/${file}`, requestUrl).href, remote]) {
    try {
      const response = await fetch(href, { signal: AbortSignal.timeout(8000) });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
    } catch {
      /* try next source */
    }
  }
  throw new Error("Preview font unavailable");
}

async function firstArtwork(token: TokenVisual) {
  return loadArtworkDataUri(token.imageCandidates, token.contractFull);
}

function tokenArtSvg(cx: number, cy: number, artwork: string, accent: string, t: TextWriter, initial: string) {
  const portrait = artwork
    ? `<image href="${escapeXml(artwork)}" xlink:href="${escapeXml(artwork)}" x="11" y="11" width="328" height="328" clip-path="url(#artClip)" preserveAspectRatio="xMidYMid slice"/>`
    : t(initial, cx, cy + 52, 138, accent, { anchor: "middle" });
  return `<g transform="translate(${cx - 175} ${cy - 175})">
      <circle cx="175" cy="175" r="175" fill="url(#artRing)"/>
      <circle cx="175" cy="175" r="164" fill="#151722"/>
      ${artwork ? portrait : ""}
    </g>
    ${artwork ? "" : portrait}
    <defs>
      <linearGradient id="artRing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#eef0ff"/>
        <stop offset="55%" stop-color="${accent}"/>
        <stop offset="100%" stop-color="#262a38"/>
      </linearGradient>
      <clipPath id="artClip"><circle cx="175" cy="175" r="164"/></clipPath>
    </defs>`;
}

function v2Svg(token: TokenVisual, artwork: string, t: TextWriter) {
  const accent = `hsl(${token.hue}, 86%, 62%)`;
  const ticker = token.ticker;
  const name = token.name.toUpperCase();
  const headlineSize = token.symbol.length > 9 ? 48 : 60;
  const ink = "#eef0ff";
  const muted = "#969aad";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630">
    <defs>
      <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
        <path d="M52 0H0V52" fill="none" stroke="#fff" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="#090a0f"/>
    <rect width="1200" height="630" fill="url(#grid)" opacity="0.07"/>
    ${tokenArtSvg(932, 294, artwork, accent, t, token.symbol.slice(0, 1) || "B")}
    <circle cx="932" cy="294" r="240" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="2" stroke-dasharray="10 8"/>
    <rect x="64" y="70" width="34" height="34" fill="${accent}"/>
    ${t("B", 81, 95, 22, "#090a0f", { anchor: "middle" })}
    ${t("BAGWORK", 112, 95, 25, ink)}
    ${t("ON SOLANA", 268, 93, 12, muted, { weight: 400 })}
    ${t(`${ticker} · 30 MINIMUM · HOURLY REWARD CLOCK`, 64, 210, 14, accent)}
    ${t(`STAKE ${ticker}.`, 64, 278, headlineSize, ink)}
    ${t("EARN SOL BY THE HOUR.", 64, 348, headlineSize, accent)}
    ${t("MINIMUM TIME", 64, 430, 11, muted, { weight: 400 })}
    ${t("30 MIN", 64, 462, 26, ink)}
    ${t("YIELD ENGINE", 250, 430, 11, muted, { weight: 400 })}
    ${t("LP FEES", 250, 462, 26, ink)}
    <rect x="64" y="488" width="320" height="52" fill="${accent}"/>
    ${t(`CLAIM ${ticker} REWARDS`, 224, 522, 20, "#090a0f", { anchor: "middle" })}
    <rect x="0" y="578" width="1200" height="52" fill="#eef0ff"/>
    ${t(name, 200, 610, 13, "#090a0f", { anchor: "middle" })}
    ${t("LIQUIDITY EARNS · STAKERS SHARE", 600, 610, 13, "#090a0f", { anchor: "middle" })}
    ${t("REWARDS IN SOL", 1000, 610, 13, "#090a0f", { anchor: "middle" })}
  </svg>`;
}

function v3Svg(token: TokenVisual, artwork: string, t: TextWriter) {
  const accent = `hsl(${token.hue}, 86%, 62%)`;
  const ticker = token.ticker;
  const ink = "#eef0ff";
  const muted = "#969aad";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630">
    <defs>
      <radialGradient id="glow" cx="27%" cy="52%" r="45%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0a0c13"/>
        <stop offset="100%" stop-color="#17141a"/>
      </linearGradient>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="#fff" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <rect width="1200" height="630" fill="url(#grid)" opacity="0.08"/>
    <circle cx="296" cy="302" r="250" fill="none" stroke="${accent}" stroke-width="1"/>
    <circle cx="296" cy="302" r="215" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
    ${tokenArtSvg(296, 286, artwork, accent, t, token.symbol.slice(0, 1) || "B")}
    <rect x="122" y="514" width="360" height="50" fill="${accent}"/>
    <rect x="116" y="508" width="360" height="50" fill="#121620" stroke="rgba(255,255,255,.14)"/>
    ${t("ACTIVE VAULT", 136, 538, 12, accent, { weight: 400 })}
    ${t(ticker, 444, 542, 24, ink, { anchor: "end" })}
    <rect x="615" y="42" width="295" height="36" fill="none" stroke="rgba(255,255,255,.16)"/>
    ${t("WALLET FOUND ON THE LIST", 630, 66, 11, accent, { weight: 400, spacing: 1.6 })}
    ${t("THE BAG", 615, 130, 62, ink)}
    ${t("REMEMBERED.", 615, 192, 62, accent)}
    ${t("Your conviction earned a share of the SOL rewards.", 615, 228, 18, muted, { weight: 400 })}
    <rect x="615" y="250" width="520" height="330" fill="#11151e" stroke="rgba(255,255,255,.18)"/>
    ${t("CLAIMING FOR", 634, 280, 10, muted, { weight: 400, spacing: 1.8 })}
    ${t(ticker, 634, 314, 27, ink)}
    ${t(token.contract, 634, 336, 10, muted, { weight: 400 })}
    <rect x="1048" y="268" width="68" height="34" fill="none" stroke="${accent}"/>
    ${t("SHARE", 1082, 290, 12, accent, { anchor: "middle", weight: 400 })}
    <line x1="634" y1="358" x2="1116" y2="358" stroke="rgba(255,255,255,.14)"/>
    ${t("YOUR SOL ALLOCATION", 634, 384, 10, muted, { weight: 400, spacing: 1.8 })}
    ${t("8.24*", 634, 450, 56, accent)}
    ${t("SOL", 820, 444, 24, ink)}
    <rect x="634" y="478" width="482" height="44" fill="${accent}"/>
    ${t("CLAIM 8.24* SOL", 875, 507, 19, "#090a0f", { anchor: "middle" })}
  </svg>`;
}

function pngResponse(body: ArrayBuffer | Uint8Array, version: string, cache: string, reason = "") {
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": cache,
    "Access-Control-Allow-Origin": "*",
    "X-Card-Variant": version,
  };
  if (reason) headers["X-Card-Error"] = reason.slice(0, 180);
  return new Response(toArrayBuffer(body), { headers });
}

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function fallbackCard(url: URL, version: 2 | 3 = 2, reason = ""): Promise<Response> {
  const fromDisk = await readHostFile([
    `cards/v${version}.png`,
    `static-public/cards/v${version}.png`,
    `dist-static/cards/v${version}.png`,
    "share-card.png",
    "dist-static/share-card.png",
    "static-public/share-card.png",
  ]);
  if (fromDisk) return pngResponse(fromDisk, `fallback-v${version}`, "public, max-age=300", reason);
  try {
    for (const href of [`/cards/v${version}.png`, "/share-card.png"]) {
      const bundled = await fetch(new URL(href, url), { signal: AbortSignal.timeout(8000) });
      if (bundled.ok) return pngResponse(await bundled.arrayBuffer(), `fallback-v${version}`, "public, max-age=300", reason);
    }
  } catch {
    /* last-resort 1×1 so crawlers still see an image */
  }
  return pngResponse(EMPTY_PNG, "fallback", "public, max-age=60", reason);
}

/** Draws the PNG card. Falls back to the bundled share card when anything fails. */
export async function renderCardResponse(request: Request, ca: string): Promise<Response> {
  const url = new URL(request.url);
  ca = contractFromRequest(request, ca);
  if (!isSolanaAddress(ca)) return fallbackCard(url, 2);
  const version = requestedVersion(url);
  const explicit = hasExplicitVersion(url);
  const cacheKey = `${ca}:v${version}`;
  const cached = pngCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return pngResponse(cached.body, `v${version}`, explicit ? "public, max-age=300, s-maxage=3600" : "no-store, max-age=0");
  }

  try {
    const rendered = await Promise.race([
      (async () => {
        regularFontData ??= fontBytes("regular", request.url);
        boldFontData ??= fontBytes("bold", request.url);
        const [token, regular, bold] = await Promise.all([
          resolveToken(ca),
          regularFontData,
          boldFontData,
          loadWasm(request.url),
        ]).then(([a, b, c]) => [a, b, c] as const);
        const artwork = await firstArtwork(token);
        cardFonts ??= parseCardFonts(regular, bold);
        const text = makeTextWriter(cardFonts);
        const svg = version === 3 ? v3Svg(token, artwork, text) : v2Svg(token, artwork, text);
        const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
        for (const href of resvg.imagesToResolve()) {
          if (!href.startsWith("data:")) continue;
          const comma = href.indexOf(",");
          if (comma < 0) continue;
          const payload = href.slice(comma + 1);
          const binary = href.slice(0, comma).includes(";base64") ? atob(payload) : decodeURIComponent(payload);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          resvg.resolveImage(href, bytes);
        }
        const png = resvg.render().asPng();
        return toArrayBuffer(png);
      })(),
      new Promise<ArrayBuffer>((_, reject) => setTimeout(() => reject(new Error("card timeout")), 20000)),
    ]);
    pngCache.set(cacheKey, { expires: Date.now() + 120_000, body: rendered });
    return pngResponse(rendered, `v${version}`, explicit ? "public, max-age=300, s-maxage=3600" : "no-store, max-age=0");
  } catch (error) {
    return fallbackCard(url, version, errorText(error));
  }
}

export { requestedVersion, hasExplicitVersion, contractFromRequest } from "./card-shared";
