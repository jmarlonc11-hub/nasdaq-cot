"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
} from "lightweight-charts";

export interface ChartSeries {
  title: string;
  color: string;
  type?: "line" | "histogram";
  scale?: "left" | "right";
  data: { time: string; value: number }[];
  bands?: { value: number; color: string }[];
}

export default function Chart({ series, height = 320 }: { series: ChartSeries[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const usesLeft = series.some((s) => s.scale === "left");
    const chart = createChart(el, {
      height,
      width: el.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: "#07110b" },
        textColor: "#5e9a70",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      localization: {
        priceFormatter: (p: number) =>
          Math.abs(p) >= 1000 ? Math.round(p).toLocaleString("en-US") : p.toFixed(Math.abs(p) >= 100 ? 0 : 1),
      },
      grid: {
        vertLines: { color: "#0d2416" },
        horzLines: { color: "#0d2416" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#3b6a4b", labelBackgroundColor: "#133822" },
        horzLine: { color: "#3b6a4b", labelBackgroundColor: "#133822" },
      },
      rightPriceScale: { borderColor: "#133822" },
      leftPriceScale: { visible: usesLeft, borderColor: "#133822" },
      timeScale: { borderColor: "#133822", rightOffset: 2 },
    });

    for (const s of series) {
      const common = { color: s.color, priceScaleId: s.scale ?? "right", title: s.title, priceLineVisible: false };
      const api =
        s.type === "histogram"
          ? chart.addSeries(HistogramSeries, common)
          : chart.addSeries(LineSeries, { ...common, lineWidth: 2 });
      api.setData(s.data);
      for (const b of s.bands ?? []) {
        api.createPriceLine({ price: b.value, color: b.color, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
      }
    }
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [series, height]);

  return <div ref={ref} className="chart" />;
}
