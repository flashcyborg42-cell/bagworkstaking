import { isSolanaAddress } from "./token-types";

function versionFromToken(token: string | null | undefined): 2 | 3 | undefined {
  if (!token) return undefined;
  const value = token.trim().toLowerCase();
  if (value === "3" || value.startsWith("3") || value === "v3" || value.startsWith("v3")) return 3;
  if (value === "2" || value.startsWith("2") || value === "v2" || value.startsWith("v2")) return 2;
  return undefined;
}

/** Pins v2/v3, including WhatsApp-style flags like ?v23 / ?v34 / ?v=3. */
export function requestedVersion(url: URL): 2 | 3 {
  const fromV = versionFromToken(url.searchParams.get("v"));
  if (fromV) return fromV;
  for (const key of url.searchParams.keys()) {
    const pinned = versionFromToken(key);
    if (pinned) return pinned;
  }
  return Math.random() < 0.5 ? 2 : 3;
}

export function hasExplicitVersion(url: URL) {
  if (versionFromToken(url.searchParams.get("v"))) return true;
  for (const key of url.searchParams.keys()) {
    if (versionFromToken(key)) return true;
  }
  return false;
}

export function isCrawler(request: Request) {
  return /Twitterbot|Discordbot|Slackbot|facebookexternalhit|Facebot|LinkedInBot|TelegramBot|WhatsApp|SkypeUriPreview|redditbot|Applebot|Googlebot|Iframely|Embedly|OpenGraph|vkShare|Pinterest|W3C_Validator|preview/i.test(
    request.headers.get("user-agent") ?? "",
  );
}

/** Pull a Solana address from /stake/<ca>, /api/public/og/<ca>, or a rewritten function path. */
export function contractFromRequest(request: Request, hinted = "") {
  const candidates = [hinted];
  try {
    const url = new URL(request.url);
    candidates.push(url.searchParams.get("ca") ?? "");
    for (const part of url.pathname.split("/")) candidates.push(part);
  } catch {
    /* ignore malformed URLs */
  }
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const value = decodeURIComponent(raw);
      if (isSolanaAddress(value)) return value;
    } catch {
      /* skip */
    }
  }
  return hinted;
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function escapeXml(value: string) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}
