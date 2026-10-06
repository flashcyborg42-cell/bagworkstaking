import { cn } from "../lib/utils";
import type { TokenVisual } from "../lib/token-types";
import { ResilientTokenImage } from "./resilient-token-image";

type TokenMedallionProps = { token: TokenVisual; compact?: boolean; className?: string };

export function TokenMedallion({ token, compact = false, className }: TokenMedallionProps) {
  return (
    <div className={cn("token-scene token-conduit", compact && "token-scene-compact", className)}>
      <div className="conduit-glow" />
      <div className="conduit-outer-ring"><span /><span /></div>
      <div className="conduit-chamber">
        <div className="conduit-grid" />
        <div className="conduit-axis conduit-axis-top" />
        <div className="conduit-axis conduit-axis-bottom" />
        <div className="conduit-coin-shell">
          <div className="token-face">
            <ResilientTokenImage candidates={token.imageCandidates} alt={token.imageAlt} className="token-image" />
            <div className="token-shine" />
            <div className="token-scan" />
          </div>
        </div>
        <span className="conduit-node conduit-node-one" />
        <span className="conduit-node conduit-node-two" />
      </div>
      <div className="conduit-plaque">
        <div><span className="status-dot" /><strong>ACTIVE SYNC</strong></div>
        <span>{token.ticker}</span>
        <small>CA // {token.contract}</small>
      </div>
      <div className="conduit-status"><span>YIELD ROUTE</span><strong>LP FEES → SOL</strong><em>OPTIMIZED</em></div>
    </div>
  );
}
