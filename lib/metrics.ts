import { CATS, type Cat, type ContractView, type CotPayload, type CotRow, type PricePoint } from "./types";

// Micro E-mini = 1/10 del E-mini; se convierte a equivalente E-mini al combinar.
export function rowsFor(data: CotPayload, view: ContractView): CotRow[] {
  if (view === "emini") return data.emini;
  if (view === "micro") return data.micro;
  const micro = new Map(data.micro.map((r) => [r.date, r]));
  return data.emini.map((r) => {
    const m = micro.get(r.date);
    if (!m) return r;
    const long = {} as Record<Cat, number>;
    const short = {} as Record<Cat, number>;
    for (const c of CATS) {
      long[c] = r.long[c] + Math.round(m.long[c] / 10);
      short[c] = r.short[c] + Math.round(m.short[c] / 10);
    }
    return { date: r.date, oi: r.oi + Math.round(m.oi / 10), long, short };
  });
}

export const netSeries = (rows: CotRow[], cat: Cat) => rows.map((r) => r.long[cat] - r.short[cat]);

export function cotIndex(values: number[], i: number, n: number): number {
  const w = values.slice(Math.max(0, i - n + 1), i + 1);
  const min = Math.min(...w);
  const max = Math.max(...w);
  return max === min ? 50 : ((values[i] - min) / (max - min)) * 100;
}

export function zScore(values: number[], i: number, n: number): number {
  const w = values.slice(Math.max(0, i - n + 1), i + 1);
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
  return sd === 0 ? 0 : (values[i] - mean) / sd;
}

export function cotIndexSeries(values: number[], n: number): number[] {
  return values.map((_, i) => cotIndex(values, i, n));
}

/** Último cierre disponible en o antes de la fecha dada. */
export function priceAt(prices: PricePoint[], date: string): number | null {
  let lo = 0;
  let hi = prices.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid].date <= date) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? prices[ans].close : null;
}

export interface CatSummary {
  cat: Cat;
  long: number;
  short: number;
  net: number;
  dNet: number;
  dLong: number;
  dShort: number;
  pctLongOI: number;
  pctShortOI: number;
  idx26: number;
  idx52: number;
  idx156: number;
  z52: number;
}

export function summarize(rows: CotRow[]): CatSummary[] {
  const i = rows.length - 1;
  const cur = rows[i];
  const prev = rows[i - 1] ?? cur;
  return CATS.map((cat) => {
    const net = netSeries(rows, cat);
    return {
      cat,
      long: cur.long[cat],
      short: cur.short[cat],
      net: net[i],
      dNet: net[i] - (net[i - 1] ?? net[i]),
      dLong: cur.long[cat] - prev.long[cat],
      dShort: cur.short[cat] - prev.short[cat],
      pctLongOI: cur.oi ? (cur.long[cat] / cur.oi) * 100 : 0,
      pctShortOI: cur.oi ? (cur.short[cat] / cur.oi) * 100 : 0,
      idx26: cotIndex(net, i, 26),
      idx52: cotIndex(net, i, 52),
      idx156: cotIndex(net, i, 156),
      z52: zScore(net, i, 52),
    };
  });
}

export interface Bias {
  score: number; // 0-100
  label: "ALCISTA" | "NEUTRAL" | "BAJISTA";
  parts: { name: string; value: number }[];
}

/**
 * Heurística transparente: Asset Managers y Dealers se leen a favor de su posición,
 * Leveraged Funds se leen contrarian (índice invertido). Promedio de COT Index 52s.
 */
export function bias(sum: CatSummary[]): Bias {
  const get = (c: Cat) => sum.find((s) => s.cat === c)!.idx52;
  const parts = [
    { name: "ASSET MGRS", value: get("assetMgr") },
    { name: "DEALERS", value: get("dealer") },
    { name: "LEV FUNDS (INV)", value: 100 - get("levFunds") },
  ];
  const score = parts.reduce((a, p) => a + p.value, 0) / parts.length;
  const label = score >= 65 ? "ALCISTA" : score <= 35 ? "BAJISTA" : "NEUTRAL";
  return { score, label, parts };
}

export interface Divergence {
  date: string;
  type: "BAJISTA" | "ALCISTA";
  pricePct: number;
  netChange: number;
}

/**
 * Divergencia: precio sube N semanas pero la categoría reduce su neto de forma
 * significativa (> 0.5 desviaciones de los cambios de N semanas), o viceversa.
 */
export function divergences(rows: CotRow[], prices: PricePoint[], cat: Cat, n = 4): Divergence[] {
  if (!prices.length) return [];
  const net = netSeries(rows, cat);
  const changes = net.map((v, i) => (i >= n ? v - net[i - n] : 0)).slice(n);
  const mean = changes.reduce((a, b) => a + b, 0) / (changes.length || 1);
  const sd = Math.sqrt(changes.reduce((a, b) => a + (b - mean) ** 2, 0) / (changes.length || 1));
  const out: Divergence[] = [];
  for (let i = n; i < rows.length; i++) {
    const p0 = priceAt(prices, rows[i - n].date);
    const p1 = priceAt(prices, rows[i].date);
    if (!p0 || !p1) continue;
    const pricePct = (p1 / p0 - 1) * 100;
    const netChange = net[i] - net[i - n];
    if (pricePct > 2 && netChange < -0.5 * sd) out.push({ date: rows[i].date, type: "BAJISTA", pricePct, netChange });
    else if (pricePct < -2 && netChange > 0.5 * sd) out.push({ date: rows[i].date, type: "ALCISTA", pricePct, netChange });
  }
  return out.reverse();
}

export interface BacktestCell {
  n: number;
  avg: number;
  hit: number; // % de veces que el precio subió
}

export interface Backtest {
  horizons: number[];
  high: BacktestCell[];
  low: BacktestCell[];
  all: BacktestCell[];
}

/** Retorno futuro del precio tras lecturas extremas del COT Index (52s) de una categoría. */
export function backtest(
  rows: CotRow[],
  prices: PricePoint[],
  cat: Cat,
  lookback = 52,
  hi = 90,
  lo = 10,
  horizons = [4, 8, 12],
): Backtest | null {
  if (!prices.length || rows.length < lookback + 12) return null;
  const idx = cotIndexSeries(netSeries(rows, cat), lookback);
  const cell = (pick: (i: number) => boolean, h: number): BacktestCell => {
    const rets: number[] = [];
    for (let i = lookback; i + h < rows.length; i++) {
      if (!pick(i)) continue;
      const p0 = priceAt(prices, rows[i].date);
      const p1 = priceAt(prices, rows[i + h].date);
      if (p0 && p1) rets.push((p1 / p0 - 1) * 100);
    }
    return {
      n: rets.length,
      avg: rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0,
      hit: rets.length ? (rets.filter((r) => r > 0).length / rets.length) * 100 : 0,
    };
  };
  return {
    horizons,
    high: horizons.map((h) => cell((i) => idx[i] >= hi, h)),
    low: horizons.map((h) => cell((i) => idx[i] <= lo, h)),
    all: horizons.map((h) => cell(() => true, h)),
  };
}

export function nextReleaseDate(lastReport: string): string {
  const d = new Date(`${lastReport}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 10); // martes siguiente + 3 días = viernes
  return d.toISOString().slice(0, 10);
}
