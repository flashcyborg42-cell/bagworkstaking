import ansemImage from "../assets/ansem-real.jpg";
import foneImage from "../assets/fone-real.jpg";

export type TokenId = "ansem" | "fone";

export type TokenVisual = {
  id: TokenId;
  name: string;
  ticker: string;
  contract: string;
  contractFull?: string;
  image: string;
  imageAlt: string;
  apy: string;
  tvl: string;
  paid: string;
  walletBalance: string;
  pending: string;
  tier: string;
};

export const tokens: Record<TokenId, TokenVisual> = {
  ansem: {
    id: "ansem",
    name: "THE BLACK BULL",
    ticker: "$ANSEM",
    contract: "9cRC...pump",
    contractFull: "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump",
    image: ansemImage,
    imageAlt: "Official $ANSEM The Black Bull token logo",
    apy: "58.4%",
    tvl: "$9.64M",
    paid: "31,880",
    walletBalance: "12.6M",
    pending: "24.71",
    tier: "Black Horn",
  },
  fone: {
    id: "fone",
    name: "APE ON FONE",
    ticker: "$FONE",
    contract: "CTPo...pump",
    contractFull: "CTPoyCwkjMvoJwU4xvZZqoD8tiYk6yDchySiN5gGpump",
    image: foneImage,
    imageAlt: "Official $FONE apeonfone token logo",
    apy: "44.2%",
    tvl: "$3.18M",
    paid: "14,205",
    walletBalance: "8.90M",
    pending: "11.36",
    tier: "Screen Time Max",
  },
};
