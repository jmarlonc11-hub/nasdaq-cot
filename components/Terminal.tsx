"use client";

import { useEffect, useMemo, useState } from "react";
import Chart, { type ChartSeries } from "./Chart";
import MatrixRain from "./MatrixRain";
import { CATS, CAT_COLOR, CAT_DESC, CAT_LABEL, type Cat, type ContractView, type CotPayload } from "@/lib/types";
import {
  backtest,
  bias,
  cotIndexSeries,
  divergences,
  netSeries,
  nextReleaseDate,
  priceAt,
  rowsFor,
  summarize,
} from "@/lib/metrics";

const VIEWS: { id: ContractView; label: string; key: string }[] = [
  { id: "emini", label: "E-MINI", key: "E" },
  { id: "micro", label: "MICRO", key: "M" },
  { id: "combined", label: "COMBINADO", key: "C" },
];

const LOOKBACKS = [26, 52, 156];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const signed = (n: number) => (n > 0 ? "+" : "") + fmt(n);
const pct = (n: number, d = 1) => (n > 0 ? "+" : "") + n.toFixed(d) + "%";
const tone = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "");
const idxTone = (v: number) => (v >= 90 ? "ext-hi" : v <= 10 ? "ext-lo" : "");

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false }) + " ET",
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="clock">{now}</span>;
}

function Panel({ id, title, right, children }: { id?: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel" id={id}>
      <header className="panel-head">
        <span>{title}</span>
        {right && <span className="panel-right">{right}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export default function Terminal({ data }: { data: CotPayload }) {
  const [view, setView] = useState<ContractView>("emini");
  const [focus, setFocus] = useState<Cat>("levFunds");
  const [lookback, setLookback] = useState(52);
  const [shown, setShown] = useState<Cat[]>(["dealer", "assetMgr", "levFunds"]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const v = VIEWS.find((x) => x.key === e.key.toUpperCase());
      if (v && (v.id !== "micro" || data.micro.length)) setView(v.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.micro.length]);

  const rows = useMemo(() => rowsFor(data, view), [data, view]);
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2] ?? last;
  const sum = useMemo(() => summarize(rows), [rows]);
  const b = useMemo(() => bias(sum), [sum]);
  const divs = useMemo(() => divergences(rows, data.price, focus), [rows, data.price, focus]);
  const bt = useMemo(() => backtest(rows, data.price, focus, lookback), [rows, data.price, focus, lookback]);
  const lastPrice = last ? priceAt(data.price, last.date) : null;
  const prevPrice = prev ? priceAt(data.price, prev.date) : null;

  const priceSeries: ChartSeries | null = useMemo(() => {
    if (!data.price.length || !rows.length) return null;
    const from = rows[0].date;
    return {
      title: "NQ",
      color: "#e6fff0",
      scale: "right",
      data: data.price.filter((p) => p.date >= from).map((p) => ({ time: p.date, value: p.close })),
    };
  }, [data.price, rows]);

  const netChart = useMemo<ChartSeries[]>(() => {
    const s: ChartSeries[] = shown.map((c) => ({
      title: CAT_LABEL[c],
      color: CAT_COLOR[c],
      scale: "left",
      data: netSeries(rows, c).map((v, i) => ({ time: rows[i].date, value: v })),
    }));
    return priceSeries ? [...s, priceSeries] : s;
  }, [rows, shown, priceSeries]);

  const idxChart = useMemo<ChartSeries[]>(() => {
    const idx = cotIndexSeries(netSeries(rows, focus), lookback);
    const s: ChartSeries[] = [
      {
        title: `COT IDX ${lookback}S`,
        color: CAT_COLOR[focus],
        scale: "left",
        data: idx.map((v, i) => ({ time: rows[i].date, value: Math.round(v * 10) / 10 })),
        bands: [
          { value: 90, color: "#ff4d6a" },
          { value: 50, color: "#3b6a4b" },
          { value: 10, color: "#2bff6a" },
        ],
      },
    ];
    return priceSeries ? [...s, priceSeries] : s;
  }, [rows, focus, lookback, priceSeries]);

  const oiChart = useMemo<ChartSeries[]>(() => {
    const s: ChartSeries[] = [
      {
        title: "OI",
        color: "rgba(43,255,106,0.18)",
        type: "histogram",
        scale: "left",
        data: rows.map((r) => ({ time: r.date, value: r.oi })),
      },
    ];
    return priceSeries ? [...s, priceSeries] : s;
  }, [rows, priceSeries]);

  if (!last) {
    return <main className="term"><p className="warn">SIN DATOS PARA ESTE CONTRATO.</p></main>;
  }

  const dOI = last.oi - prev.oi;
  const tape = sum.map((s) => (
    <span key={s.cat} className="tape-item">
      <b style={{ color: CAT_COLOR[s.cat] }}>{CAT_LABEL[s.cat]}</b> NET {signed(s.net)}{" "}
      <span className={tone(s.dNet)}>{s.dNet >= 0 ? "▲" : "▼"} {signed(s.dNet)}</span>{" "}
      IDX52 {s.idx52.toFixed(0)}
    </span>
  ));

  return (
    <main className="term">
      <header className="top">
        <MatrixRain />
        <div className="top-inner">
          <div className="brand">
            <span className="logo">COT<span className="slash">//</span>NQ</span>
            <span className="sub">TERMINAL DE POSICIONAMIENTO · NASDAQ-100</span>
          </div>
          <div className="cmd">
            <span className="amber">NQ1</span> &lt;INDEX&gt; <span className="amber">COT</span> &lt;GO&gt;
            <span className="cursor">█</span>
          </div>
          <div className="status">
            <span className={`badge ${data.source === "CFTC" ? "live" : "demo"}`}>
              {data.source === "CFTC" ? "● CFTC LIVE" : "● DEMO"}
            </span>
            <Clock />
          </div>
        </div>
      </header>

      <nav className="fkeys">
        <a href="#resumen"><kbd>F1</kbd>RESUMEN</a>
        <a href="#posiciones"><kbd>F2</kbd>POSICIONES</a>
        <a href="#indice"><kbd>F3</kbd>COT INDEX</a>
        <a href="#divergencias"><kbd>F4</kbd>DIVERGENCIAS</a>
        <a href="#backtest"><kbd>F5</kbd>BACKTEST</a>
        <span className="spacer" />
        <div className="seg" role="tablist" aria-label="Contrato">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              className={view === v.id ? "on" : ""}
              disabled={v.id === "micro" && !data.micro.length}
              onClick={() => setView(v.id)}
              title={`Atajo: ${v.key}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </nav>

      {data.source === "DEMO" && (
        <div className="warn">
          ⚠ DATOS DE DEMOSTRACIÓN — no se pudo conectar a la CFTC{data.error ? ` (${data.error})` : ""}. Los números NO son reales.
        </div>
      )}
      {data.priceSource === "NONE" && <div className="warn">⚠ Precio del NQ no disponible: los gráficos se muestran sin precio.</div>}

      <div className="tape" aria-hidden>
        <div className="tape-track">{tape}{tape}</div>
      </div>

      <div className="grid g-3" id="resumen">
        <Panel title="SESGO COMPUESTO" right="COT IDX 52S">
          <div className={`bias bias-${b.label.toLowerCase()}`}>
            <div className="bias-label">{b.label}</div>
            <div className="bias-score">{b.score.toFixed(0)}<small>/100</small></div>
            <div className="meter"><div style={{ width: `${b.score}%` }} /></div>
          </div>
          <ul className="kv">
            {b.parts.map((p) => (
              <li key={p.name}><span>{p.name}</span><b>{p.value.toFixed(0)}</b></li>
            ))}
          </ul>
          <p className="note">Heurística: AM y Dealers a favor, Lev Funds contrarian. No es recomendación.</p>
        </Panel>

        <Panel title="SNAPSHOT" right={VIEWS.find((v) => v.id === view)?.label}>
          <ul className="kv big">
            <li><span>FECHA POSICIÓN</span><b>{last.date}</b></li>
            <li><span>PRÓX. REPORTE</span><b className="amber">{nextReleaseDate(last.date)} 15:30 ET</b></li>
            <li><span>OPEN INTEREST</span><b>{fmt(last.oi)}</b></li>
            <li><span>Δ OI SEMANA</span><b className={tone(dOI)}>{signed(dOI)}</b></li>
            {lastPrice != null && (
              <li>
                <span>NQ AL CORTE</span>
                <b>
                  {lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                  {prevPrice ? <span className={tone(lastPrice - prevPrice)}>{pct((lastPrice / prevPrice - 1) * 100, 2)}</span> : null}
                </b>
              </li>
            )}
            <li><span>LECTURA OI</span><b>{dOI > 0 && lastPrice && prevPrice ? (lastPrice > prevPrice ? "DINERO NUEVO ALCISTA" : "DINERO NUEVO BAJISTA") : dOI < 0 ? "LIQUIDACIÓN / CIERRE" : "—"}</b></li>
          </ul>
        </Panel>

        <Panel title="EXTREMOS ACTIVOS" right="IDX ≥90 / ≤10">
          <ul className="kv">
            {sum.map((s) => {
              const ext = s.idx52 >= 90 ? "MÁX 52S" : s.idx52 <= 10 ? "MÍN 52S" : "—";
              return (
                <li key={s.cat}>
                  <span style={{ color: CAT_COLOR[s.cat] }}>{CAT_LABEL[s.cat]}</span>
                  <b className={idxTone(s.idx52)}>{ext}</b>
                </li>
              );
            })}
          </ul>
          <p className="note">Z-SCORE 52S de LEV FUNDS: <b className="amber">{sum.find((s) => s.cat === "levFunds")!.z52.toFixed(2)}σ</b></p>
        </Panel>
      </div>

      <Panel id="posiciones" title="POSICIONES POR TIPO DE TRADER" right="CLICK EN UNA FILA = FOCO">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CATEGORÍA</th><th>LONG</th><th>Δ</th><th>SHORT</th><th>Δ</th><th>NETO</th><th>Δ NETO</th>
                <th>%OI L/S</th><th>IDX26</th><th>IDX52</th><th>IDX156</th><th>Z52</th>
              </tr>
            </thead>
            <tbody>
              {sum.map((s) => (
                <tr key={s.cat} className={focus === s.cat ? "sel" : ""} onClick={() => setFocus(s.cat)} title={CAT_DESC[s.cat]}>
                  <td style={{ color: CAT_COLOR[s.cat] }}>{focus === s.cat ? "▶ " : ""}{CAT_LABEL[s.cat]}</td>
                  <td>{fmt(s.long)}</td>
                  <td className={tone(s.dLong)}>{signed(s.dLong)}</td>
                  <td>{fmt(s.short)}</td>
                  <td className={tone(-s.dShort)}>{signed(s.dShort)}</td>
                  <td className={tone(s.net)}><b>{signed(s.net)}</b></td>
                  <td className={tone(s.dNet)}>{signed(s.dNet)}</td>
                  <td>{s.pctLongOI.toFixed(1)}/{s.pctShortOI.toFixed(1)}</td>
                  <td className={idxTone(s.idx26)}>{s.idx26.toFixed(0)}</td>
                  <td className={idxTone(s.idx52)}>{s.idx52.toFixed(0)}</td>
                  <td className={idxTone(s.idx156)}>{s.idx156.toFixed(0)}</td>
                  <td className={Math.abs(s.z52) >= 2 ? "ext-hi" : ""}>{s.z52.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">{CAT_DESC[focus]}</p>
      </Panel>

      <Panel
        title="POSICIÓN NETA vs NQ"
        right={
          <span className="chips">
            {CATS.map((c) => (
              <button
                key={c}
                className={shown.includes(c) ? "on" : ""}
                style={{ "--c": CAT_COLOR[c] } as React.CSSProperties}
                onClick={() => setShown((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}
              >
                {CAT_LABEL[c]}
              </button>
            ))}
          </span>
        }
      >
        <Chart series={netChart} height={360} />
      </Panel>

      <div className="grid g-2" id="indice">
        <Panel
          title={`COT INDEX · ${CAT_LABEL[focus]}`}
          right={
            <span className="chips">
              {LOOKBACKS.map((n) => (
                <button key={n} className={lookback === n ? "on" : ""} onClick={() => setLookback(n)}>{n}S</button>
              ))}
            </span>
          }
        >
          <Chart series={idxChart} height={280} />
        </Panel>
        <Panel title="OPEN INTEREST vs NQ">
          <Chart series={oiChart} height={280} />
        </Panel>
      </div>

      <div className="grid g-2">
        <Panel id="divergencias" title={`DIVERGENCIAS 4S · ${CAT_LABEL[focus]}`} right={`${divs.length} SEÑALES`}>
          {divs.length ? (
            <div className="table-wrap scroll">
              <table>
                <thead><tr><th>FECHA</th><th>TIPO</th><th>NQ 4S</th><th>Δ NETO 4S</th></tr></thead>
                <tbody>
                  {divs.slice(0, 40).map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td className={d.type === "ALCISTA" ? "up" : "down"}>{d.type}</td>
                      <td className={tone(d.pricePct)}>{pct(d.pricePct)}</td>
                      <td className={tone(d.netChange)}>{signed(d.netChange)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">Sin divergencias (o sin datos de precio).</p>
          )}
          <p className="note">Precio ±2% en 4 semanas mientras el neto se mueve en contra &gt; 0.5σ.</p>
        </Panel>

        <Panel id="backtest" title={`BACKTEST EXTREMOS · ${CAT_LABEL[focus]}`} right={`IDX ${lookback}S`}>
          {bt ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CONDICIÓN</th>
                    {bt.horizons.map((h) => <th key={h}>+{h}S RET / HIT</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([["IDX ≥ 90", bt.high], ["IDX ≤ 10", bt.low], ["TODAS LAS SEMANAS", bt.all]] as const).map(([label, cells]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      {cells.map((c, i) => (
                        <td key={i}>
                          {c.n ? (
                            <>
                              <span className={tone(c.avg)}>{pct(c.avg)}</span> / {c.hit.toFixed(0)}%
                              <small className="dim"> n={c.n}</small>
                            </>
                          ) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">Backtest no disponible (requiere precio y suficiente historial).</p>
          )}
          <p className="note">Retorno promedio del NQ y % de veces al alza tras la lectura. Las señales se solapan; compara contra &quot;todas las semanas&quot;.</p>
        </Panel>
      </div>

      <footer className="foot">
        FUENTE: CFTC TRADERS IN FINANCIAL FUTURES (FUTURES ONLY) · CÓDIGO 209742 E-MINI NASDAQ-100 · MICRO = 1/10 EN COMBINADO ·
        PRECIO: {data.priceSource} · ACTUALIZADO {data.updatedAt.slice(0, 16).replace("T", " ")} UTC · ATAJOS: E / M / C
        <br />Herramienta informativa. No constituye asesoría financiera.
      </footer>
    </main>
  );
}
