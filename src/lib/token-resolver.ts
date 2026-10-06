import { contractHue, isSolanaAddress, shortContract, type TokenVisual } from "./token-types";

const cache = new Map<string, { expires: number; value: TokenVisual }>();
const FALLBACK_IMAGE = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#11131b"/><circle cx="400" cy="400" r="300" fill="#19e88d"/><path d="M285 535V265h132c78 0 128 38 128 101 0 38-20 67-54 83l77 86H452l-56-69h-12v69H285zm99-151h28c27 0 42-12 42-33 0-20-15-31-42-31h-28v64z" fill="#090a0f"/></svg>`);

function cleanUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  let url = value.trim().replace(/^Https:/, "https:").replace(/^Http:/, "http:");
  if (url.startsWith("ipfs://")) url = `https://ipfs.io/ipfs/${url.slice(7)}`;
  if (url.startsWith("ar://")) url = `https://arweave.net/${url.slice(5)}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch { return undefined; }
}

const IPFS_GATEWAYS = [
  "https://pump.mypinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

// One CID can be served by many gateways; rate-limited ones must never blank the card.
function expandGateways(url: string) {
  const match = /\/ipfs\/([^?#]+)/.exec(url);
  if (!match?.[1]) return [url];
  const path = match[1];
  return [...IPFS_GATEWAYS.map((gateway) => `${gateway}${path}`), url];
}

function number(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function compact(value?: number, currency = true) {
  if (value === undefined) return "—";
  return `${currency ? "$" : ""}${Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
}
function price(value?: number) {
  if (value === undefined) return "—";
  if (value < 0.0001) return `$${value.toExponential(2)}`;
  return `$${value.toLocaleString("en", { maximumFractionDigits: value < 1 ? 6 : 2 })}`;
}
function safeText(value: unknown, fallback: string, max = 60) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

async function jsonFetch(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function resolveToken(rawAddress: string): Promise<TokenVisual> {
  const address = rawAddress.trim();
  if (!isSolanaAddress(address)) throw new Error("Invalid contract address");
  const cached = cache.get(address);
  if (cached && cached.expires > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  const [dexResult, jupiterResult] = await Promise.allSettled([
    jsonFetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`, controller.signal),
    jsonFetch(`https://lite-api.jup.ag/tokens/v2/search?query=${address}`, controller.signal),
  ]);
  clearTimeout(timeout);

  const dexList = dexResult.status === "fulfilled" && Array.isArray(dexResult.value) ? dexResult.value : [];
  const dex = dexList.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .sort((a, b) => Number((b["liquidity"] as Record<string, unknown> | undefined)?.["usd"] ?? 0) - Number((a["liquidity"] as Record<string, unknown> | undefined)?.["usd"] ?? 0))[0];
  const jupiterList = jupiterResult.status === "fulfilled" && Array.isArray(jupiterResult.value) ? jupiterResult.value : [];
  const jupiter = jupiterList.find((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && (item as Record<string, unknown>)["id"] === address));
  if (!dex && !jupiter) throw new Error("Token metadata was not found yet. Try again after the token is indexed.");

  const dexBase = dex?.["baseToken"] as Record<string, unknown> | undefined;
  const dexInfo = dex?.["info"] as Record<string, unknown> | undefined;
  const dexLiquidity = dex?.["liquidity"] as Record<string, unknown> | undefined;
  const dexVolume = dex?.["volume"] as Record<string, unknown> | undefined;
  const dexChange = dex?.["priceChange"] as Record<string, unknown> | undefined;
  const jStats = jupiter?.["stats24h"] as Record<string, unknown> | undefined;
  const candidates = [dexInfo?.["imageUrl"], jupiter?.["icon"], dexInfo?.["openGraph"]]
    .map(cleanUrl).filter((item): item is string => Boolean(item))
    .flatMap(expandGateways);
  candidates.push(`https://dd.dexscreener.com/ds-data/tokens/solana/${address}.png`);
  const uniqueCandidates = [...new Set(candidates)];
  const symbol = safeText(dexBase?.["symbol"] ?? jupiter?.["symbol"], "TOKEN", 14).toUpperCase();
  const name = safeText(dexBase?.["name"] ?? jupiter?.["name"], "Solana Token", 42);
  const marketCap = number(dex?.["marketCap"]) ?? number(jupiter?.["mcap"]);
  const liquidity = number(dexLiquidity?.["usd"]) ?? number(jupiter?.["liquidity"]);
  const volume24h = number(dexVolume?.["h24"]) ?? ((number(jStats?.["buyVolume"]) ?? 0) + (number(jStats?.["sellVolume"]) ?? 0) || undefined);
  const change24h = number(dexChange?.["h24"]) ?? number(jStats?.["priceChange"]);
  const holderCount = number(jupiter?.["holderCount"]);
  const visual: TokenVisual = {
    contractFull: address,
    contract: shortContract(address),
    name,
    ticker: `$${symbol}`,
    symbol,
    image: uniqueCandidates[0] ?? FALLBACK_IMAGE,
    imageCandidates: [...uniqueCandidates, FALLBACK_IMAGE],
    imageAlt: `${name} token artwork`,
    price: price(Number(dex?.["priceUsd"] ?? jupiter?.["usdPrice"]) || undefined),
    liquidity: compact(liquidity),
    marketCap: compact(marketCap),
    volume24h: compact(volume24h),
    change24h: change24h === undefined ? "—" : `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`,
    ...(holderCount !== undefined ? { holders: compact(holderCount, false) } : {}),
    source: dex ? "DexScreener" : "Jupiter",
    apy: "48.6%*", tvl: compact(liquidity), paid: "12,840*", walletBalance: "4.20M*", pending: "8.24*", tier: "Diamond Hands*",
    hue: contractHue(address),
  };
  cache.set(address, { expires: Date.now() + 60_000, value: visual });
  return visual;
}
