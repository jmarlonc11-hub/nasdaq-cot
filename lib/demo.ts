import { CATS, type Cat, type CotPayload, type CotRow, type PricePoint } from "./types";

// Datos sintéticos deterministas, solo para desarrollo local o si la CFTC no responde.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function lastTuesday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function demoPayload(): CotPayload {
  const rand = rng(42);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const weeks = 520;
  const end = lastTuesday();

  const base: Record<Cat, { l: number; s: number }> = {
    dealer: { l: 30000, s: 90000 },
    assetMgr: { l: 120000, s: 40000 },
    levFunds: { l: 45000, s: 70000 },
    other: { l: 20000, s: 15000 },
    nonRept: { l: 30000, s: 30000 },
  };
  const tilt: Record<Cat, number> = { dealer: 0, assetMgr: 0, levFunds: 0, other: 0, nonRept: 0 };

  const emini: CotRow[] = [];
  const micro: CotRow[] = [];
  const price: PricePoint[] = [];
  let px = 6500;

  for (let w = weeks - 1; w >= 0; w--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - w * 7);
    const ret = 0.0025 + 0.028 * gauss();
    px *= 1 + ret;

    tilt.assetMgr = tilt.assetMgr * 0.95 + ret * 120000 + 4000 * gauss();
    tilt.levFunds = tilt.levFunds * 0.9 + ret * 160000 + 6000 * gauss();
    tilt.dealer = -(tilt.assetMgr + tilt.levFunds) * 0.7 + 3000 * gauss();
    tilt.other = tilt.other * 0.9 + 1500 * gauss();
    tilt.nonRept = tilt.nonRept * 0.85 + ret * 30000 + 1500 * gauss();

    const long = {} as Record<Cat, number>;
    const short = {} as Record<Cat, number>;
    for (const c of CATS) {
      long[c] = Math.max(1000, Math.round(base[c].l + tilt[c] / 2));
      short[c] = Math.max(1000, Math.round(base[c].s - tilt[c] / 2));
    }
    const oi = Math.round(CATS.reduce((a, c) => a + long[c], 0) * 1.05);
    emini.push({ date: iso(d), oi, long, short });

    if (w < 300) {
      const ml = {} as Record<Cat, number>;
      const ms = {} as Record<Cat, number>;
      for (const c of CATS) {
        ml[c] = Math.round(long[c] * 0.12 * (1 + 0.1 * gauss()));
        ms[c] = Math.round(short[c] * 0.12 * (1 + 0.1 * gauss()));
      }
      micro.push({ date: iso(d), oi: Math.round(oi * 0.12), long: ml, short: ms });
    }
    price.push({ date: iso(d), close: Math.round(px * 100) / 100 });
  }

  return {
    source: "DEMO",
    priceSource: "DEMO",
    updatedAt: new Date().toISOString(),
    emini,
    micro,
    price,
  };
}
