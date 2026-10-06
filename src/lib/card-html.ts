import { resolveToken } from "./token-resolver";
import { isSolanaAddress } from "./token-types";
import {
  contractFromRequest,
  escapeHtml,
  hasExplicitVersion,
  isCrawler,
  requestedVersion,
} from "./card-shared";
import { readHostText } from "./host-files";
import { publicOrigin } from "./node-handler";

let shellCache: string | undefined;

function crawlerDocument(opts: {
  title: string;
  social: string;
  description: string;
  image: string;
  pageUrl: string;
  origin: string;
}) {
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

async function loadShell(request: Request): Promise<string | undefined> {
  if (shellCache) return shellCache;
  const fromDisk = await readHostText([
    "index.html",
    "dist-static/index.html",
    "static/index.html",
  ]);
  if (fromDisk?.includes("<div id=\"root\"")) {
    shellCache = fromDisk;
    return fromDisk;
  }
  try {
    const response = await fetch(new URL("/index.html", request.url), {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return undefined;
    const html = await response.text();
    if (html.includes("<div id=\"root\"")) {
      shellCache = html;
      return html;
    }
  } catch {
    /* crawlers must not wait on a hanging self-fetch */
  }
  return undefined;
}

function injectTags(html: string, head: string) {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "");
  return stripped.replace(/<\/head>/i, `    ${head}\n  </head>`);
}

/**
 * Serves the static shell with per-token social tags so crawlers (which never
 * run JavaScript) see the right title, description and rotating card.
 */
export async function renderStakeHtmlResponse(request: Request, ca: string): Promise<Response> {
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
      /* keep the generic copy */
    }
  }

  const explicit = hasExplicitVersion(url);
  const version = requestedVersion(url);
  const title = `${ticker} Hourly Staking — Earn SOL | Bagwork`;
  const social = `${ticker} — Stake from 30 Minutes. Earn SOL.`;
  const description = `Stake ${ticker} from 30 minutes. Liquidity-pool yield is shared with ${name} stakers in SOL.`;
  const image = isSolanaAddress(ca)
    ? `${origin}/api/public/og/${encodeURIComponent(ca)}?v=${version}`
    : `${origin}/share-card.png`;
  const pageUrl = `${origin}/stake/${encodeURIComponent(ca)}${explicit ? `?v=${version}` : ""}`;
  const document = {
    title,
    social,
    description,
    image,
    pageUrl,
    origin,
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
    `<meta name="twitter:image:src" content="${escapeHtml(image)}" />`,
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
