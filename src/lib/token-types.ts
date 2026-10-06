export type TokenVisual = {
  contractFull: string;
  contract: string;
  name: string;
  ticker: string;
  symbol: string;
  image: string;
  imageCandidates: string[];
  imageAlt: string;
  price: string;
  liquidity: string;
  marketCap: string;
  volume24h: string;
  change24h: string;
  holders?: string;
  description?: string;
  source: string;
  apy: string;
  tvl: string;
  paid: string;
  walletBalance: string;
  pending: string;
  tier: string;
  hue: number;
};

export const ANSEM_CA = "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";
export const FONE_CA = "CTPoyCwkjMvoJwU4xvZZqoD8tiYk6yDchySiN5gGpump";

export function shortContract(contract: string) {
  return `${contract.slice(0, 6)}…${contract.slice(-6)}`;
}

export function contractHue(contract: string) {
  let hash = 0;
  for (const char of contract) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}
