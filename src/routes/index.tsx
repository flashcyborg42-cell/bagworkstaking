import { createFileRoute } from "@tanstack/react-router";
import { TokenExperience } from "../components/token-experience";
import { getTokenByAddress } from "../lib/token.functions";
import { ANSEM_CA } from "../lib/token-types";

export const Route = createFileRoute("/")({
  loader: () => getTokenByAddress({ data: { ca: ANSEM_CA } }),
  head: () => ({ meta: [
    { title: "Bagwork — Hourly Memecoin Staking" },
    { name: "description", content: "Stake memecoins from 30 minutes and share liquidity-pool yield distributed in SOL." },
    { property: "og:title", content: "Bagwork — Stake from 30 Minutes. Earn SOL." },
    { property: "og:description", content: "Put a share of your memecoin bag to work and earn variable liquidity-pool rewards in SOL." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  errorComponent: ({ error }) => <div className="route-state"><strong>Token data is taking longer than expected.</strong><p>{error.message}</p><a href="/">Try again</a></div>,
  component: Home,
});

function Home() { return <TokenExperience token={Route.useLoaderData()} />; }
