const env = ((typeof import.meta !== "undefined" && import.meta.env) || {}) as Record<string, string | undefined>;

/**
 * The card + artwork endpoints ship with every target: the Cloudflare/Nitro
 * server build serves them itself, and the static build carries Netlify /
 * Vercel / Pages functions that serve the same paths. VITE_CARD_ORIGIN points
 * a function-less host (plain cPanel) at a deployed origin instead.
 */
export const CARD_ORIGIN = (env["VITE_CARD_ORIGIN"] ?? "").replace(/\/+$/, "");
export const IS_STATIC_BUILD = env["VITE_STATIC_BUILD"] === "true";
export const HAS_IMAGE_SERVICE = true;

export function cardUrl(ca: string, version: number | string) {
  if (!HAS_IMAGE_SERVICE) return "";
  return `${CARD_ORIGIN}/api/public/og/${encodeURIComponent(ca)}?v=${version}`;
}

export function artUrl(ca: string) {
  if (!HAS_IMAGE_SERVICE) return "";
  return `${CARD_ORIGIN}/api/public/art/${encodeURIComponent(ca)}`;
}
