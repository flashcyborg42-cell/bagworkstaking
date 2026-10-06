import { toArrayBuffer, toBase64 } from "./host-files";

const artCache = new Map<string, { expires: number; value: string }>();

/** Dexscreener `format=auto` is WebP. Cards can only embed PNG/JPEG/GIF. */
export function preferRasterUrl(url: string) {
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

export function sniffRasterType(bytes: ArrayBuffer | Uint8Array, declared = "") {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) return "image/png";
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46) return "image/gif";
  if (view.length >= 12 && view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
    const tag = String.fromCharCode(view[8], view[9], view[10], view[11]);
    if (tag === "WEBP") return "image/webp";
  }
  const type = declared.split(";")[0]?.trim().toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/gif") return type;
  return undefined;
}

function artworkUrls(candidates: string[]) {
  const urls: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.startsWith("https://")) continue;
    const raster = preferRasterUrl(candidate);
    if (raster !== candidate) urls.push(raster);
    urls.push(candidate);
  }
  return [...new Set(urls)].slice(0, 8);
}

async function fetchRaster(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "image/png,image/jpeg,image/gif;q=0.9,image/webp;q=0.4" },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error("Artwork unavailable");
  const bytes = await response.arrayBuffer();
  const declared = response.headers.get("content-type") ?? "";
  const type = sniffRasterType(bytes, declared);
  if (!type || type === "image/webp") throw new Error("Unsupported artwork");
  return { bytes, type };
}

/** SVG-safe PNG/JPEG/GIF data URI for resvg. Empty string means no embeddable art. */
export async function loadArtworkDataUri(candidates: string[], cacheKey = "") {
  if (cacheKey) {
    const hit = artCache.get(cacheKey);
    if (hit && hit.expires > Date.now() && hit.value) return hit.value;
  }
  try {
    const artwork = await Promise.any(artworkUrls(candidates).map((url) => fetchRaster(url)));
    const dataUri = `data:${artwork.type};base64,${toBase64(artwork.bytes)}`;
    if (cacheKey) artCache.set(cacheKey, { expires: Date.now() + 120_000, value: dataUri });
    return dataUri;
  } catch {
    return "";
  }
}

export async function loadArtworkFile(candidates: string[]) {
  const artwork = await Promise.any(artworkUrls(candidates).map((url) => fetchRaster(url)));
  return { body: toArrayBuffer(artwork.bytes), type: artwork.type };
}
