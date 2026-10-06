import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import "../styles.css";
import { TokenExperience } from "../components/token-experience";
import { resolveToken } from "../lib/token-resolver";
import { ANSEM_CA, isSolanaAddress, type TokenVisual } from "../lib/token-types";
import { cardUrl } from "../lib/site-config";

/** Static hosts serve one HTML file, so per-token tags are applied after load. */
function useTokenHead(token: TokenVisual) {
  useEffect(() => {
    const description = `Stake ${token.ticker} from 30 minutes. Liquidity-pool yield is shared with ${token.name} stakers in SOL.`;
    document.title = `${token.ticker} Hourly Staking — Earn SOL | Bagwork`;
    const version = new URLSearchParams(window.location.search).has("v3") ? 3 : 2;
    const image = cardUrl(token.contractFull, version);
    const tags: Array<[string, string, string]> = [
      ["name", "description", description],
      ["property", "og:title", `${token.ticker} — Stake from 30 Minutes. Earn SOL.`],
      ["property", "og:description", description],
      ["name", "twitter:title", `${token.ticker} — Stake from 30 Minutes. Earn SOL.`],
      ["name", "twitter:description", description],
      ...(image
        ? ([
            ["property", "og:image", image],
            ["name", "twitter:image", image],
          ] as Array<[string, string, string]>)
        : []),
    ];
    for (const [attribute, key, content] of tags) {
      let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    }
  }, [token]);
}

function TokenPage({ token }: { token: TokenVisual }) {
  useTokenHead(token);
  return <TokenExperience token={token} />;
}

const Pending = () => (
  <div className="route-state">
    <span className="route-spinner" />
    <strong>Initializing DEX feed · syncing staking pool data…</strong>
  </div>
);

const Failed = ({ error }: { error: Error }) => (
  <div className="route-state">
    <strong>We could not load this token yet.</strong>
    <p>{error.message}</p>
    <a href="/">Search another contract</a>
  </div>
);

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="route-state">
      <strong>That page does not exist.</strong>
      <a href="/">Back to search</a>
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: () => resolveToken(ANSEM_CA),
  pendingComponent: Pending,
  errorComponent: Failed,
  component: function Index() {
    return <TokenPage token={indexRoute.useLoaderData()} />;
  },
});

const stakeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stake/$ca",
  validateSearch: (search: Record<string, unknown>) => ({
    v:
      Object.prototype.hasOwnProperty.call(search, "v3") || search["v"] === "3"
        ? ("3" as const)
        : Object.prototype.hasOwnProperty.call(search, "v2") || search["v"] === "2"
          ? ("2" as const)
          : undefined,
  }),
  loader: ({ params }) => {
    if (!isSolanaAddress(params.ca)) throw new Error("Paste a Solana token address containing 32–44 base58 characters.");
    return resolveToken(params.ca);
  },
  pendingComponent: Pending,
  errorComponent: Failed,
  component: function Stake() {
    return <TokenPage token={stakeRoute.useLoaderData()} />;
  },
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, stakeRoute]),
  defaultPreload: "intent",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
