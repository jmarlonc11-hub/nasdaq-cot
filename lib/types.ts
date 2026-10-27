export const CATS = ["dealer", "assetMgr", "levFunds", "other", "nonRept"] as const;
export type Cat = (typeof CATS)[number];

export const CAT_LABEL: Record<Cat, string> = {
  dealer: "DEALERS",
  assetMgr: "ASSET MGRS",
  levFunds: "LEV FUNDS",
  other: "OTROS REP.",
  nonRept: "NO REPORT.",
};

export const CAT_DESC: Record<Cat, string> = {
  dealer: "Bancos / intermediarios (sell-side). Suelen estar del otro lado del flujo.",
  assetMgr: "Fondos institucionales, pensiones, mutual funds. Dinero lento y direccional.",
  levFunds: "Hedge funds y CTAs. Dinero rápido, siguen tendencia; extremos = contrarian.",
  other: "Otros grandes reportables (tesorerías corporativas, etc.).",
  nonRept: "Pequeños especuladores (retail).",
};

export const CAT_COLOR: Record<Cat, string> = {
  dealer: "#ffb000",
  assetMgr: "#00ff41",
  levFunds: "#ff3b5c",
  other: "#4fd1ff",
  nonRept: "#8a9a8a",
};

export interface CotRow {
  date: string; // YYYY-MM-DD (martes de la posición)
  oi: number;
  long: Record<Cat, number>;
  short: Record<Cat, number>;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface CotPayload {
  source: "CFTC" | "DEMO";
  priceSource: "YAHOO" | "DEMO" | "NONE";
  error?: string;
  updatedAt: string;
  emini: CotRow[];
  micro: CotRow[];
  price: PricePoint[];
}

export type ContractView = "emini" | "micro" | "combined";
