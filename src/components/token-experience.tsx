import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { ActionButton } from "../components/ui/action-button";
import { TokenMedallion } from "../components/token-medallion";
import type { TokenVisual } from "../lib/token-types";
import { ANSEM_CA, FONE_CA, isSolanaAddress } from "../lib/token-types";
import { ResilientTokenImage } from "./resilient-token-image";
import { artUrl, cardUrl, HAS_IMAGE_SERVICE } from "../lib/site-config";
import { btnClass } from "../lib/utils";

const payouts = [
  { wallet: "7Vh3...9BqA", tier: "Black Horn", amount: "3.20" },
  { wallet: "0x2C...B9f1", tier: "Screen Time Max", amount: "1.87" },
  { wallet: "9Kd8...2LmZ", tier: "Paper Hands Rehab", amount: "0.63" },
  { wallet: "Bq41...7Tsa", tier: "Black Horn", amount: "5.04" },
  { wallet: "3Mn0...QQ12", tier: "Screen Time Max", amount: "2.41" },
];

const leaderboard = [
  { rank: "01", wallet: "7Vh3...9BqA", staked: "48.2M", earned: "412.9" },
  { rank: "02", wallet: "Bq41...7Tsa", staked: "39.7M", earned: "355.1" },
  { rank: "03", wallet: "0x2C...B9f1", staked: "31.4M", earned: "288.6" },
  { rank: "04", wallet: "3Mn0...QQ12", staked: "22.8M", earned: "201.3" },
  { rank: "05", wallet: "9Kd8...2LmZ", staked: "17.5M", earned: "164.7" },
];

const faqs = [
  {
    q: "Do I have to sell my bag?",
    a: "No. You lock the same tokens you already hold. Exposure stays, the position just starts working.",
  },
  {
    q: "Why SOL and not another farm token?",
    a: "Farm tokens usually become exit liquidity. SOL is the asset you actually wanted to stack.",
  },
  { q: "Where do the SOL rewards come from?", a: "The model deploys pooled capital into disclosed liquidity-pool strategies. Trading fees and liquidity incentives create variable yield, and a share is distributed to stakers in SOL." },
  { q: "When do rewards start?", a: "The minimum staking window is 30 minutes. Earnings accrue by time in the vault, and the active countdown shows the next reward checkpoint." },
  { q: "Are returns guaranteed?", a: "No. Liquidity-pool returns vary with volume, fees, incentives, and market conditions. Every estimate shown here is illustrative, not a promise." },
  { q: "Is there a lock-up?", a: "This concept starts at 30 minutes and supports custom durations. A production vault would disclose its withdrawal and cool-down rules before confirmation." },
  { q: "How is my tier decided?", a: "By size held and time held. Longer conviction moves you up the ladder." },
  { q: "Is this live?", a: "No. This is a UI concept only — no wallet connection and no transactions." },
];

const steps = [
  { n: "01", title: "PICK YOUR SHARE", copy: "Choose 25% to 100% of the memecoin balance you want working. Your remaining bag stays untouched." },
  { n: "02", title: "STAKE FROM 30 MIN", copy: "Select a short window or set a custom duration. The earning clock begins when the position enters the vault." },
  { n: "03", title: "LIQUIDITY EARNS", copy: "Vault capital is deployed into liquidity pools where trading activity can generate fees and incentives." },
  { n: "04", title: "YOU RECEIVE SOL", copy: "A share of realized vault yield is distributed to stakers in SOL, based on stake share and time active." },
];

type TokenExperienceProps = { token: TokenVisual };

type DynamicPalette = CSSProperties & Record<`--${string}`, string | number>;

const neutralPalette: DynamicPalette = {
  "--token-accent": "rgb(211 214 220)",
  "--token-secondary": "rgb(142 148 158)",
  "--token-deep": "rgb(9 10 12)",
  "--token-surface": "rgb(19 21 25)",
  "--token-soft": "rgb(31 34 40)",
  "--foreground": "rgb(236 238 242)",
  "--muted-foreground": "rgb(164 169 178)",
  "--primary": "rgb(211 214 220)",
  "--primary-foreground": "rgb(9 10 12)",
};

const periodOptions = [
  { label: "30M", hours: 0.5 },
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "12H", hours: 12 },
  { label: "1D", hours: 24 },
];

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  const light = (max + min) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * light - 1)) : 0;
  return { hue: (hue + 360) % 360, saturation: saturation * 100, light: light * 100 };
}

function hueDistance(a: number, b: number) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 360 - distance);
}

type SampledColor = {
  red: number;
  green: number;
  blue: number;
  hue: number;
  saturation: number;
  light: number;
  score: number;
};

function rgbValue(color: Pick<SampledColor, "red" | "green" | "blue">) {
  return `rgb(${Math.round(color.red)} ${Math.round(color.green)} ${Math.round(color.blue)})`;
}

function mixRgb(color: Pick<SampledColor, "red" | "green" | "blue">, target: number, amount: number) {
  return rgbValue({
    red: color.red + (target - color.red) * amount,
    green: color.green + (target - color.green) * amount,
    blue: color.blue + (target - color.blue) * amount,
  });
}

function browserSafeArtworkUrl(url: string) {
  if (!url.startsWith("https://")) return url;
  const source = url.slice("https://".length);
  return `https://images.weserv.nl/?url=${encodeURIComponent(source)}&w=96&h=96&fit=cover&output=png`;
}

function paletteFromArtwork(pixels: Uint8ClampedArray): DynamicPalette | null {
  const buckets = new Map<number, {
    weight: number;
    red: number;
    green: number;
    blue: number;
    hue: number;
    saturation: number;
    light: number;
    count: number;
  }>();

  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha === undefined || alpha < 180) continue;
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const color = rgbToHsl(red, green, blue);
    if (color.light < 7 || color.light > 96 || color.saturation < 10) continue;
    const key = Math.floor(color.hue / 12) * 10 + Math.floor(color.light / 20);
    const vividness = .35 + color.saturation / 100;
    const visibility = .45 + Math.min(color.light, 100 - color.light) / 50;
    const weight = vividness * visibility;
    const bucket = buckets.get(key) ?? { weight: 0, red: 0, green: 0, blue: 0, hue: 0, saturation: 0, light: 0, count: 0 };
    bucket.weight += weight;
    bucket.red += red * weight;
    bucket.green += green * weight;
    bucket.blue += blue * weight;
    bucket.hue += color.hue * weight;
    bucket.saturation += color.saturation * weight;
    bucket.light += color.light * weight;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const colors: SampledColor[] = [...buckets.values()]
    .filter((bucket) => bucket.count >= 2 && bucket.weight > 0)
    .map((bucket) => ({
      red: bucket.red / bucket.weight,
      green: bucket.green / bucket.weight,
      blue: bucket.blue / bucket.weight,
      hue: bucket.hue / bucket.weight,
      saturation: bucket.saturation / bucket.weight,
      light: bucket.light / bucket.weight,
      score: bucket.weight,
    }))
    .sort((a, b) => b.score - a.score);

  const primarySource = colors.find((color) => color.light >= 28 && color.light <= 78 && color.saturation >= 18) ?? colors[0];
  if (!primarySource) return null;
  const secondarySource = colors.find((color) =>
    color.light >= 20
    && color.light <= 84
    && hueDistance(color.hue, primarySource.hue) >= 32
  ) ?? colors.find((color) => Math.abs(color.light - primarySource.light) >= 18) ?? primarySource;
  const brightSource = colors
    .filter((color) => color.light >= 58)
    .sort((a, b) => b.light - a.light)[0] ?? primarySource;
  const primary = primarySource.light < 48
    ? mixRgb(primarySource, 255, Math.min(.42, (52 - primarySource.light) / 100))
    : rgbValue(primarySource);
  const foreground = brightSource.light < 72 ? mixRgb(brightSource, 255, .62) : rgbValue(brightSource);

  return {
    "--token-accent": primary,
    "--token-secondary": rgbValue(secondarySource),
    "--token-deep": mixRgb(primarySource, 0, .88),
    "--token-surface": mixRgb(primarySource, 0, .77),
    "--token-soft": mixRgb(secondarySource, 0, .68),
    "--foreground": foreground,
    "--muted-foreground": mixRgb(brightSource, 128, .42),
    "--primary": primary,
    "--primary-foreground": mixRgb(primarySource, 0, .9),
  };
}

export function TokenExperience({ token }: TokenExperienceProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(token.contractFull);
  const [searchError, setSearchError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [cardVersion, setCardVersion] = useState<2 | 3>(2);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [lockPeriod, setLockPeriod] = useState("1H");
  const [customDuration, setCustomDuration] = useState("30");
  const [customUnit, setCustomUnit] = useState<"MINUTES" | "HOURS" | "DAYS">("MINUTES");
  const [stakePercent, setStakePercent] = useState(50);
  const [customPercent, setCustomPercent] = useState("50");
  const [countdown, setCountdown] = useState(887);
  const [walletAddress, setWalletAddress] = useState("");
  const [previewWallet, setPreviewWallet] = useState("");
  const [palette, setPalette] = useState<DynamicPalette>(neutralPalette);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuickOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [token.contractFull]);

  useEffect(() => {
    if (!quickOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setQuickOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickOpen]);

  useEffect(() => {
    let cancelled = false;
    setPalette(neutralPalette);
    const dexArtwork = `https://dd.dexscreener.com/ds-data/tokens/solana/${token.contractFull}.png`;
    const candidates = [
      artUrl(token.contractFull),
      browserSafeArtworkUrl(dexArtwork),
      ...token.imageCandidates
        .filter((candidate) => candidate.startsWith("https://"))
        .map(browserSafeArtworkUrl),
      ...token.imageCandidates.filter((candidate) => candidate.startsWith("https://")),
      dexArtwork,
    ].filter((candidate, index, items) => Boolean(candidate) && items.indexOf(candidate) === index);

    const sampleCandidate = (candidateIndex: number) => {
      if (cancelled || candidateIndex >= candidates.length) return;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return sampleCandidate(candidateIndex + 1);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const nextPalette = paletteFromArtwork(context.getImageData(0, 0, canvas.width, canvas.height).data);
          if (nextPalette && !cancelled) setPalette(nextPalette);
          else sampleCandidate(candidateIndex + 1);
        } catch {
          sampleCandidate(candidateIndex + 1);
        }
      };
      image.onerror = () => sampleCandidate(candidateIndex + 1);
      image.src = candidates[candidateIndex] ?? "";
    };

    sampleCandidate(0);
    return () => { cancelled = true; };
  }, [token.contractFull, token.imageCandidates]);

  useEffect(() => {
    const artwork = `https://dd.dexscreener.com/ds-data/tokens/solana/${token.contractFull}.png`;
    let favicon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.removeAttribute("type");
    favicon.href = artwork;
  }, [token.contractFull]);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdown((value) => value > 0 ? value - 1 : 1799), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedHours = useMemo(() => {
    if (lockPeriod !== "CUSTOM") return periodOptions.find((option) => option.label === lockPeriod)?.hours ?? 6;
    const amount = Math.max(customUnit === "MINUTES" ? 30 : 1, Number(customDuration) || 1);
    return amount * (customUnit === "MINUTES" ? 1 / 60 : customUnit === "DAYS" ? 24 : 1);
  }, [customDuration, customUnit, lockPeriod]);
  const estimatedRewards = useMemo(() => Math.max(0.579, selectedHours * 2 * (stakePercent / 100)).toFixed(2), [selectedHours, stakePercent]);
  const projectionLabel = lockPeriod === "CUSTOM" ? `${Math.max(customUnit === "MINUTES" ? 30 : 1, Number(customDuration) || 1)} ${customUnit.toLowerCase()}` : lockPeriod;
  const walletLabel = previewWallet ? `${previewWallet.slice(0, 5)}…${previewWallet.slice(-5)}` : "Not selected";
  const timerMinutes = String(Math.floor(countdown / 60)).padStart(2, "0");
  const timerSeconds = String(countdown % 60).padStart(2, "0");
  const featuredTokens = [
    { label: token.ticker, name: token.name, ca: token.contractFull, images: token.imageCandidates },
    { label: "$ANSEM", name: "Ansem", ca: ANSEM_CA, images: [artUrl(ANSEM_CA), `https://dd.dexscreener.com/ds-data/tokens/solana/${ANSEM_CA}.png`].filter(Boolean) },
    { label: "$FONE", name: "Fone", ca: FONE_CA, images: [artUrl(FONE_CA), `https://dd.dexscreener.com/ds-data/tokens/solana/${FONE_CA}.png`].filter(Boolean) },
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.ca === item.ca) === index);

  return (
    <main className="site-shell theme-dynamic" style={palette}>
      <div className="market-grid" aria-hidden="true" />
      <div className="ghost-contract" aria-hidden="true">{token.ticker}</div>

      <header className="site-header">
        <a href="#top" className="brand-mark" aria-label="Bagwork home">
          <span className="brand-glyph">B</span>
          <span>BAGWORK</span>
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#stake">Stake</a>
          <a href="#how">How it works</a>
          <a href="#rewards">Rewards</a>
          <a href="#airdrop">Airdrop</a>
          <a href="#payouts">Payouts</a>
          <a href="#trust">Trust</a>
          <a href="#faq">FAQ</a>
          <a href="#share">X Card</a>
        </nav>
        <ActionButton className="wallet-button" aria-label="Connect wallet preview">Connect wallet</ActionButton>
      </header>

      <section className="hero-stage" id="top">
        <div className="hero-copy">
          <form className="ca-search" onSubmit={(event: FormEvent) => { event.preventDefault(); const ca = searchValue.trim(); if (!isSolanaAddress(ca)) { setSearchError("Enter a valid Solana contract address"); return; } setSearchError(""); navigate({ to: "/stake/$ca", params: { ca }, search: { v: undefined } }); }}>
            <label htmlFor="token-search">PASTE TOKEN CONTRACT</label>
            <div><input id="token-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} spellCheck={false} aria-describedby={searchError ? "search-error" : undefined} /><ActionButton type="submit">Load token</ActionButton></div>
            {searchError && <p id="search-error" role="alert">{searchError}</p>}
          </form>
          <div className="live-label"><span /> MARKET DATA · {token.source.toUpperCase()}</div>
          <div className="token-identity"><span>{token.ticker}</span><strong>{token.name}</strong><small>{token.contract}</small></div>
          <div className="hourly-badge"><span>30 MINIMUM</span><strong>EARN BY THE HOUR</strong></div>
          <h1>STAKE {token.symbol}.<br /><em>EARN SOL HOURLY.</em></h1>
          <p className="hero-lede">{token.description ?? `Put a share of your ${token.ticker} bag to work from just 30 minutes.`} Vault liquidity earns fees in active pools, then realized yield flows back to {token.ticker} stakers in SOL.</p>
          <div className="hero-actions">
            <ActionButton onClick={() => setConsoleOpen(true)}>Stake {token.ticker}</ActionButton>
            <a href="#airdrop" className="text-action">Check airdrop <span>↗</span></a>
          </div>
          <div className="proof-row">
            <div><span>PRICE</span><strong>{token.price}</strong></div>
            <div><span>LIQUIDITY</span><strong>{token.liquidity}</strong></div>
            <div><span>24H VOLUME</span><strong>{token.volume24h}</strong></div>
          </div>
        </div>

        <div className="hero-art">
          <TokenMedallion token={token} />
        </div>

        {consoleOpen ? (
          <aside className="stake-console" id="stake" aria-label="Staking interface preview">
            <div className="console-handle" aria-hidden="true" />
            <button className={btnClass("console-close")} onClick={() => setConsoleOpen(false)} aria-label="Close staking panel">✕</button>
            <div className="console-head">
              <div><span>YOUR POSITION</span><strong>{token.ticker}</strong></div>
              <span className="tier-pill">{token.tier}</span>
            </div>
            <div className="panel-token-summary">
              <ResilientTokenImage candidates={token.imageCandidates} alt={token.imageAlt} />
              <div><span>SELECTED TOKEN</span><strong>{token.name}</strong><small>{token.contract}</small></div>
              <span className="panel-source">{token.source}</span>
            </div>
            <form className="panel-token-search" onSubmit={(event) => { event.preventDefault(); const ca = searchValue.trim(); if (isSolanaAddress(ca)) navigate({ to: "/stake/$ca", params: { ca }, search: { v: undefined } }); }}>
              <label htmlFor="panel-token-ca">TOKEN CONTRACT</label>
              <div><input id="panel-token-ca" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} aria-label="Token contract address" spellCheck={false} /><button type="submit" className={btnClass()}>LOAD</button></div>
            </form>
            <form className="wallet-preview" onSubmit={(event) => { event.preventDefault(); setPreviewWallet(walletAddress.trim()); }}>
              <label htmlFor="wallet-preview">WATCH WALLET HOLDINGS</label>
              <div><input id="wallet-preview" value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="Paste Solana wallet address" spellCheck={false} /><button type="submit" className={btnClass()}>VIEW</button></div>
              <small>Preview any address before connecting</small>
            </form>
            <div className="amount-box percentage-box">
              <label htmlFor="stake-percent">SHARE OF HOLDINGS TO STAKE</label>
              <div className="percent-value"><input id="stake-percent" type="number" min="1" max="100" value={customPercent} onChange={(event) => { const next = Math.min(100, Math.max(1, Number(event.target.value) || 1)); setCustomPercent(event.target.value); setStakePercent(next); }} inputMode="decimal" /><span>%</span></div>
              <div className="percent-presets" aria-label="Stake percentage">{[25, 50, 75, 100].map((value) => <button key={value} type="button" className={btnClass(stakePercent === value && "active")} onClick={() => { setStakePercent(value); setCustomPercent(String(value)); }}>{value}%</button>)}</div>
            </div>
            <div className="console-stats">
              <div><span>{walletLabel}</span><strong>{stakePercent}% of holdings</strong></div>
              <div><span>Pending</span><strong>{token.pending} SOL</strong></div>
            </div>
            <div className="lock-selector" aria-label="Illustrative lock period">
              <span>STAKING TIME</span>
              <div>{periodOptions.map(({ label }) => <button key={label} className={btnClass(lockPeriod === label && "active")} onClick={() => setLockPeriod(label)}>{label}</button>)}<button className={btnClass(lockPeriod === "CUSTOM" && "active")} onClick={() => setLockPeriod("CUSTOM")}>CUSTOM</button></div>
            </div>
            {lockPeriod === "CUSTOM" && <div className="custom-duration"><label htmlFor="custom-duration">CUSTOM DURATION · 30 MIN MINIMUM</label><div><input id="custom-duration" type="number" min={customUnit === "MINUTES" ? "30" : "1"} max="365" value={customDuration} onChange={(event) => setCustomDuration(event.target.value)} /><select value={customUnit} onChange={(event) => { const unit = event.target.value as "MINUTES" | "HOURS" | "DAYS"; setCustomUnit(unit); if (unit === "MINUTES" && Number(customDuration) < 30) setCustomDuration("30"); }}><option>MINUTES</option><option>HOURS</option><option>DAYS</option></select></div></div>}
            <div className="reward-estimate"><span>EST. REWARD*</span><strong>+{estimatedRewards} SOL</strong><small>{stakePercent}% · {projectionLabel} projection</small></div>
            <div className="epoch-line"><span>Next SOL checkpoint</span><strong className="live-countdown"><i>00</i><b>:</b><i>{timerMinutes}</i><b>:</b><i>{timerSeconds}</i></strong></div>
            <div className="progress-track"><span /></div>
            <ActionButton className="console-submit">Connect wallet to stake</ActionButton>
            <p className="console-note">UI CONCEPT · NO LIVE TRANSACTION</p>
          </aside>
        ) : (
          <button className={btnClass("console-reopen")} id="stake" onClick={() => setConsoleOpen(true)}>
            <span /> OPEN STAKING PANEL
          </button>
        )}
      </section>

      <section className="protocol-band" aria-label="Live token market data">
        <div><span>PRICE</span><strong>{token.price}</strong><small>Live · {token.source}</small></div>
        <div><span>MARKET CAP</span><strong>{token.marketCap}</strong><small>Live market data</small></div>
        <div><span>LIQUIDITY</span><strong>{token.liquidity}</strong><small>Live pool depth</small></div>
        <div><span>24H VOLUME</span><strong>{token.volume24h}</strong><small>Live 24h traded</small></div>
        <div><span>24H CHANGE</span><strong className="market-move">{token.change24h}</strong><small>Live price move</small></div>
        <div><span>REWARDS PAID*</span><strong>{token.paid} SOL</strong><small>Illustrative total</small></div>
      </section>

      <section className="token-switcher" aria-label="Quick token examples">
        <div className="switcher-intro"><span>CONTRACT-DRIVEN UI</span><strong>One vault. Every cult.</strong></div>
        <div className="vault-slider"><div className="vault-slider-track">
          {[...featuredTokens, ...featuredTokens].map((option, index) => (
            <button key={`${option.ca}-${index}`} className={btnClass("token-choice", option.ca === token.contractFull && "active")} onClick={() => navigate({ to: "/stake/$ca", params: { ca: option.ca }, search: { v: undefined } })}>
              <ResilientTokenImage candidates={option.images} alt={`${option.name} token`} /><span><strong>{option.label}</strong><small>{option.ca.slice(0, 6)}…{option.ca.slice(-6)}</small></span><em>OPEN ↗</em>
            </button>
          ))}
        </div></div>
      </section>

      <section className="how-strip" id="how">
        <div className="section-kicker"><span>HOW IT WORKS</span><span>4 STEPS · 30 MIN START</span></div>
        <div className="how-grid">
          {steps.map((step) => (
            <article key={step.n}>
              <span className="how-number">{step.n}</span>
              <h2>{step.title}</h2>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="reward-engine" id="rewards">
        <div className="reward-copy">
          <div className="section-kicker"><span>REWARD ENGINE</span><span>ILLUSTRATIVE MODEL</span></div>
          <h2>CONVICTION<br /><em>COMPOUNDS.</em></h2>
          <p>Stake from 30 minutes or choose a custom window. Your share joins a managed liquidity strategy; realized pool fees and incentives fund variable SOL distributions.</p>
          <div className="reward-formula"><span>STAKE %</span><b>×</b><span>HOURS ACTIVE</span><b>×</b><span>REALIZED LP YIELD</span><b>=</b><strong>SOL SHARE</strong></div>
        </div>
        <div className="tier-ladder">
            {[
              { level: "01", title: "QUICK DIP", period: "30 MIN", boost: "BASE" },
              { level: "02", title: "ACTIVE SHIFT", period: "6 HOURS", boost: "1.08×" },
              { level: "03", title: "FULL CYCLE", period: "24 HOURS", boost: "1.20×" },
          ].map((tier, index) => <article className={index === 1 ? "active" : ""} key={tier.level}><span>{tier.level}</span><div><strong>{tier.title}</strong><small>{tier.period}</small></div><em>{tier.boost}</em></article>)}
        </div>
      </section>

      <section className="trader-strip">
        <div className="section-kicker"><span>WHY HOLD IDLE?</span><span>001—003</span></div>
        <div className="trader-grid">
          <article><span>01</span><h2>FEES CREATE<br />THE YIELD.</h2><p>Liquidity-pool trading fees and eligible incentives are the source—not endless token emissions.</p></article>
          <article><span>02</span><h2>HOURS, NOT<br />SEASONS.</h2><p>Start at 30 minutes, choose your own window, and see the time-based estimate before connecting.</p></article>
          <article><span>03</span><h2>REALIZED YIELD<br />BECOMES SOL.</h2><p>After strategy costs and reserves, distributable vault returns are allocated to active stakers.</p></article>
        </div>
      </section>

      <section className="claim-stage" id="airdrop">
        <div className="claim-ghost" aria-hidden="true">CLAIM</div>
        <div className="claim-art">
          <TokenMedallion token={token} compact />
          <div className="claim-snapshot"><span>SNAPSHOT LOCKED</span><strong>BLOCK 281,442,069</strong></div>
        </div>
        <div className="claim-content">
          <div className="live-label"><span /> WALLET FOUND ON THE LIST</div>
          <h1>THE BAG<br /><em>REMEMBERED.</em></h1>
          <p>Your conviction made the snapshot. Check the allocation, sign once, and let the SOL land.</p>
          <div className="claim-card">
            <div className="claim-token-row">
              <div><span>CLAIMING FOR</span><strong>{token.ticker}</strong><small title={token.contractFull ?? token.contract}>{token.contractFull ? `${token.contractFull.slice(0, 6)}...${token.contractFull.slice(-6)}` : token.contract}</small></div>
              <button className={btnClass("claim-share")} onClick={() => setShareOpen(true)}>SHARE ↗</button>
            </div>
            <div className="allocation"><span>YOUR SOL ALLOCATION</span><strong>{token.pending}</strong><em>SOL</em></div>
            <div className="claim-facts">
              <div><span>Eligibility</span><strong>✓ Qualified</strong></div>
              <div><span>Holder tier</span><strong>{token.tier}</strong></div>
              <div><span>Wallet</span><strong>7Vh3...9BqA</strong></div>
            </div>
            {claimed ? (
              <div className="claim-success"><span>✓</span><div><strong>SOL RECEIVED</strong><small>Transaction confirmed · UI prototype</small></div></div>
            ) : (
              <ActionButton onClick={() => setClaimed(true)} className="claim-button">Claim {token.pending} SOL</ActionButton>
            )}
          </div>
        </div>
      </section>

      <section className="payout-section" id="payouts">
        <div className="section-kicker"><span>LIVE PAYOUTS & LEADERBOARD</span><span>EPOCH 069</span></div>
        <div className="payout-columns">
          <div className="payout-feed">
            <h2>JUST PAID</h2>
            <ul>
              {payouts.map((row) => (
                <li key={row.wallet}>
                  <span className="dot" aria-hidden="true" />
                  <div><strong>{row.wallet}</strong><small>{row.tier}</small></div>
                  <em>+{row.amount} SOL</em>
                </li>
              ))}
            </ul>
          </div>
          <div className="leaderboard">
            <h2>TOP EARNERS</h2>
            <div className="lb-head"><span>#</span><span>WALLET</span><span>STAKED</span><span>SOL EARNED</span></div>
            {leaderboard.map((row) => (
              <div className="lb-row" key={row.rank}>
                <span>{row.rank}</span>
                <span>{row.wallet}</span>
                <span>{row.staked}</span>
                <em>{row.earned}</em>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-section" id="trust">
        <div className="section-kicker"><span>VAULT TRANSPARENCY</span><span>VERIFY, DON'T VIBE</span></div>
        <div className="trust-grid">
          <div className="trust-copy"><h2>EVERY NUMBER.<br /><em>ON THE RECORD.</em></h2><p>A credible staking experience should make its rules, reward source, custody model, and withdrawal timing obvious before anyone commits a token.</p><a href={`https://solscan.io/token/${token.contractFull}`} target="_blank" rel="noreferrer">Inspect token on Solscan ↗</a></div>
          <div className="trust-ledger">
            <div><span>CONTRACT</span><strong>{token.contract}</strong><em>VERIFIABLE</em></div>
            <div><span>REWARD ASSET</span><strong>SOL</strong><em>NO FARM TOKEN</em></div>
            <div><span>MINIMUM WINDOW</span><strong>30 MINUTES*</strong><em>TIME-BASED</em></div>
            <div><span>YIELD SOURCE</span><strong>LIQUIDITY POOLS*</strong><em>VARIABLE RETURNS</em></div>
            <div><span>TRANSACTIONS</span><strong>DISABLED</strong><em>UI CONCEPT</em></div>
          </div>
        </div>
      </section>

      <section className="community-section">
        <div className="community-copy"><span>COMMUNITY MILESTONES</span><h2>THE CULT<br />HAS <em>GOALS.</em></h2><p>Vault milestones turn collective conviction into visible progress. These sample targets make the staking story feel active without pretending the protocol is live.</p></div>
        <div className="milestone-track">
          {[{ value: "25%", title: "VAULT OPENS", copy: "First epoch begins" }, { value: "50%", title: "SOL BOOST", copy: "Reward pool expands" }, { value: "75%", title: "HOLDER DROP", copy: "Snapshot bonus unlocks" }, { value: "100%", title: "CULT MODE", copy: "Community vote opens" }].map((item, index) => <article key={item.value} className={index < 2 ? "reached" : ""}><span>{item.value}</span><strong>{item.title}</strong><small>{item.copy}</small></article>)}
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="section-kicker"><span>FAQ</span><span>NO FLUFF</span></div>
        <div className="faq-wrap">
          <h2>QUESTIONS<br /><em>TRADERS ASK.</em></h2>
          <div className="faq-list">
            {faqs.map((item, index) => (
              <div className={openFaq === index ? "faq-item open" : "faq-item"} key={item.q}>
                <button className={btnClass()} onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
                  <span>{item.q}</span>
                  <em>{openFaq === index ? "−" : "+"}</em>
                </button>
                {openFaq === index && <p>{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="share-section" id="share">
        <div className="section-kicker"><span>TWITTER / X PREVIEW</span><span>1200 × 630</span></div>
        <div className="card-version-tabs" role="tablist" aria-label="Preview card version">
          <button className={btnClass(cardVersion === 2 && "active")} onClick={() => setCardVersion(2)}>V2 · STAKE</button>
          <button className={btnClass(cardVersion === 3 && "active")} onClick={() => setCardVersion(3)}>V3 · CLAIM</button>
        </div>
        {HAS_IMAGE_SERVICE && <div className="generated-card-frame"><img src={cardUrl(token.contractFull, cardVersion)} alt={`${token.ticker} X preview card version ${cardVersion}`} /></div>}
        <p className="card-version-note">Use <strong>?v2</strong> or <strong>?v3</strong> on the page link to choose the card X receives. Without a version, each fresh uncached request rotates between both.</p>
      </section>

      {quickOpen && <div className="quick-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-title" onClick={() => setQuickOpen(false)}>
        <div className="quick-modal" onClick={(event) => event.stopPropagation()}>
          <button className={btnClass("quick-close")} onClick={() => setQuickOpen(false)} aria-label="Close quick stake panel">✕</button>
          <span className="quick-kicker"><i /> QUICK STAKE</span>
          <div className="quick-token">
            <ResilientTokenImage candidates={token.imageCandidates} alt={token.imageAlt} />
            <div><strong id="quick-title">{token.name}</strong><small>{token.contract}</small></div>
            <span className="quick-tier">{token.tier}</span>
          </div>
          <div className="quick-stats">
            <div><span>PRICE</span><strong>{token.price}</strong></div>
            <div><span>24H</span><strong className="market-move">{token.change24h}</strong></div>
            <div><span>NEXT PAYOUT</span><strong>00:{timerMinutes}:{timerSeconds}</strong></div>
          </div>
          <div className="quick-field">
            <label>SHARE OF HOLDINGS</label>
            <div className="quick-chips">{[25, 50, 75, 100].map((value) => <button key={value} type="button" className={btnClass(stakePercent === value && "active")} onClick={() => { setStakePercent(value); setCustomPercent(String(value)); }}>{value}%</button>)}</div>
          </div>
          <div className="quick-field">
            <label>STAKING TIME · 30 MIN MINIMUM</label>
            <div className="quick-chips">{periodOptions.map(({ label }) => <button key={label} type="button" className={btnClass(lockPeriod === label && "active")} onClick={() => setLockPeriod(label)}>{label}</button>)}</div>
          </div>
          <div className="quick-estimate"><span>EST. REWARD*</span><strong>+{estimatedRewards} SOL</strong><small>{stakePercent}% · {projectionLabel}</small></div>
          <ActionButton className="quick-submit" onClick={() => setQuickOpen(false)}>QUICK STAKE {stakePercent}% NOW</ActionButton>
          <button type="button" className={btnClass("quick-open-full")} onClick={() => { setQuickOpen(false); setConsoleOpen(true); document.getElementById("stake")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>OPEN FULL STAKING PANEL →</button>
          <p className="quick-note">UI CONCEPT · NO LIVE TRANSACTION</p>
        </div>
      </div>}

      {shareOpen && <div className="share-overlay" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={() => setShareOpen(false)}>
        <div className="share-modal" onClick={(event) => event.stopPropagation()}>
          <button className={btnClass("share-close")} onClick={() => setShareOpen(false)} aria-label="Close share window">✕</button>
          <span className="section-kicker">READY FOR THE TIMELINE</span>
          <h2 id="share-title">SHARE {token.ticker}</h2>
          <div className="share-mini"><ResilientTokenImage candidates={token.imageCandidates} alt={token.imageAlt} /><div><strong>{token.name}</strong><small>{token.contract}</small></div></div>
          <p>Choose the staking card or claim card before sharing.</p>
          <div className="card-version-tabs modal-tabs"><button className={btnClass(cardVersion === 2 && "active")} onClick={() => setCardVersion(2)}>V2 · STAKE</button><button className={btnClass(cardVersion === 3 && "active")} onClick={() => setCardVersion(3)}>V3 · CLAIM</button></div>
          <div className="share-actions"><ActionButton onClick={() => navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?v${cardVersion}`)}>Copy versioned link</ActionButton><a className="share-link" href={`https://x.com/intent/post?url=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?v${cardVersion}`)}&text=${encodeURIComponent(`Stake ${token.ticker}. Earn SOL.`)}`} target="_blank" rel="noreferrer">Post on X ↗</a><a className="share-link" href={cardUrl(token.contractFull, cardVersion)} download={`${token.symbol}-staking-card-v${cardVersion}.png`}>Download V{cardVersion} ↓</a></div>
        </div>
      </div>}

      <div className="payout-tape" aria-label="Recent SOL payout examples">
        <div>
          {Array.from({ length: 2 }).map((_, index) => (
            <span key={index}>0x7A...41 <b>+3.20 SOL</b> · 0x2C...B9 <b>+1.87 SOL</b> · 0xF4...91 <b>+0.63 SOL</b> · REWARDS HIT IN SOL · </span>
          ))}
        </div>
      </div>
    </main>
  );
}
