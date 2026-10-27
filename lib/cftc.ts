import { CATS, type Cat, type CotPayload, type CotRow, type PricePoint } from "./types";
import { demoPayload } from "./demo";

// Traders in Financial Futures (TFF) - Futures Only, API Socrata de la CFTC.
const DATASET = process.env.CFTC_TFF_DATASET ?? "gpe5-46if";
const CFTC_URL = `https://publicreporting.cftc.gov/resource/${DATASET}.json`;
const EMINI_CODE = "209742"; // NASDAQ-100 E-mini (CME)
const REVALIDATE = 3600;

type RawRow = Record<string, string | undefined>;

// Prefijos de columnas del TFF; algunas llevan sufijo "_all" y otras no.
const LONG_KEY: Record<Cat, string> = {
  dealer: "dealer_positions_long",
  assetMgr: "asset_mgr_positions_long",
  levFunds: "lev_money_positions_long",
  other: "other_rept_positions_long",
  nonRept: "nonrept_positions_long",
};
const SHORT_KEY: Record<Cat, string> = {
  dealer: "dealer_positions_short",
  assetMgr: "asset_mgr_positions_short",
  levFunds: "lev_money_positions_short",
  other: "other_rept_positions_short",
  nonRept: "nonrept_positions_short",
};

function field(r: RawRow, key: string): number {
  const v = r[key] ?? r[`${key}_all`];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toRow(r: RawRow): CotRow {
  const long = {} as Record<Cat, number>;
  const short = {} as Record<Cat, number>;
  for (const c of CATS) {
    long[c] = field(r, LONG_KEY[c]);
    short[c] = field(r, SHORT_KEY[c]);
  }
  return {
    date: String(r.report_date_as_yyyy_mm_dd ?? "").slice(0, 10),
    oi: field(r, "open_interest"),
    long,
    short,
  };
}

function dedupeSorted(rows: CotRow[]): CotRow[] {
  const byDate = new Map<string, CotRow>();
  for (const r of rows) if (r.date) byDate.set(r.date, r);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchCot(): Promise<{ emini: CotRow[]; micro: CotRow[] }> {
  const params = new URLSearchParams({
    $where: "upper(market_and_exchange_names) like '%NASDAQ%'",
    $order: "report_date_as_yyyy_mm_dd ASC",
    $limit: "50000",
  });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.CFTC_APP_TOKEN) headers["X-App-Token"] = process.env.CFTC_APP_TOKEN;

  const res = await fetch(`${CFTC_URL}?${params}`, { headers, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`CFTC HTTP ${res.status}`);
  const raw = (await res.json()) as RawRow[];

  const emini: CotRow[] = [];
  const micro: CotRow[] = [];
  for (const r of raw) {
    const name = String(r.market_and_exchange_names ?? "").toUpperCase();
    const code = String(r.cftc_contract_market_code ?? "").trim();
    if (code === EMINI_CODE) emini.push(toRow(r));
    else if (name.includes("MICRO") && name.includes("NASDAQ")) micro.push(toRow(r));
  }
  if (!emini.length) throw new Error("CFTC: sin filas para el E-mini Nasdaq (209742)");
  return { emini: dedupeSorted(emini), micro: dedupeSorted(micro) };
}

async function fetchYahoo(symbol: string): Promise<PricePoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=20y&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; nasdaq-cot/1.0)" },
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  const out: PricePoint[] = [];
  ts.forEach((t, i) => {
    const c = closes[i];
    if (c != null && Number.isFinite(c)) {
      out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), close: c });
    }
  });
  if (!out.length) throw new Error(`Yahoo: sin datos para ${symbol}`);
  return out;
}

async function fetchPrice(): Promise<PricePoint[]> {
  try {
    return await fetchYahoo("NQ=F");
  } catch {
    return await fetchYahoo("^NDX");
  }
}

export async function getCotPayload(): Promise<CotPayload> {
  const updatedAt = new Date().toISOString();
  const [cot, price] = await Promise.allSettled([fetchCot(), fetchPrice()]);

  if (cot.status === "rejected") {
    // En producción, al revalidar, un error hace que Next siga sirviendo la última versión buena
    // en lugar de cambiarla por datos demo. En build/dev se usan los datos demo.
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (process.env.NODE_ENV === "production" && !isBuild) throw cot.reason;
    const demo = demoPayload();
    return { ...demo, updatedAt, error: String(cot.reason?.message ?? cot.reason) };
  }
  if (price.status === "rejected") {
    return { source: "CFTC", priceSource: "NONE", updatedAt, ...cot.value, price: [] };
  }
  return { source: "CFTC", priceSource: "YAHOO", updatedAt, ...cot.value, price: price.value };
}
