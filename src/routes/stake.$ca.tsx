import { createFileRoute, notFound } from "@tanstack/react-router";
import { TokenExperience } from "../components/token-experience";
import { getTokenByAddress, getRequestOrigin } from "../lib/token.functions";
import { isSolanaAddress } from "../lib/token-types";

export const Route = createFileRoute("/stake/$ca")({
  validateSearch: (search: Record<string, unknown>) => ({
    v: Object.prototype.hasOwnProperty.call(search, "v3") || search["v"] === "3" ? "3" as const : Object.prototype.hasOwnProperty.call(search, "v2") || search["v"] === "2" ? "2" as const : undefined,
  }),
  loader: async ({ params }) => {
    if (!isSolanaAddress(params.ca)) throw notFound();
    const [token, origin] = await Promise.all([
      getTokenByAddress({ data: { ca: params.ca } }),
      typeof window === "undefined" ? getRequestOrigin().catch(() => "") : Promise.resolve(window.location.origin),
    ]);
    return { ...token, origin };
  },
  head: ({ loaderData, params, match }) => {
    const ticker = loaderData?.ticker ?? "$TOKEN";
    const name = loaderData?.name ?? "Solana token";
    const description = `Stake ${ticker} from 30 minutes. Liquidity-pool yield is shared with ${name} stakers in SOL.`;
    const search = match.search as { v?: "2" | "3" };
    const version = search.v;
    const origin = loaderData?.origin || (typeof window !== "undefined" ? window.location.origin : "");
    const image = origin
      ? `${origin}/api/public/og/${encodeURIComponent(params.ca)}${version ? `?v=${version}` : ""}`
      : `/api/public/og/${encodeURIComponent(params.ca)}${version ? `?v=${version}` : ""}`;
    return { meta: [
      { title: `${ticker} Hourly Staking — Earn SOL | Bagwork` },
      { name: "description", content: description },
      { property: "og:title", content: `${ticker} — Stake from 30 Minutes. Earn SOL.` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: `${ticker} — Stake from 30 Minutes. Earn SOL.` },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ] };
  },
  pendingComponent: () => <div className="route-state"><span className="route-spinner" /><strong>Initializing DEX feed · syncing staking pool data…</strong></div>,
  errorComponent: ({ error }) => <div className="route-state"><strong>We could not load this token yet.</strong><p>{error.message}</p><a href="/">Search another contract</a></div>,
  notFoundComponent: () => <div className="route-state"><strong>That contract address is not valid.</strong><p>Paste a Solana token address containing 32–44 base58 characters.</p><a href="/">Back to search</a></div>,
  component: StakeTokenPage,
});

function StakeTokenPage() { return <TokenExperience token={Route.useLoaderData()} />; }
