"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789NQCOT$%+-";

export default function MatrixRain({ opacity = 0.18 }: { opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const size = 14;
    let drops: number[] = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / size) }, () => Math.random() * -50);
    };
    resize();
    window.addEventListener("resize", resize);

    const id = window.setInterval(() => {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() > 0.97 ? "#d6ffe0" : "#00ff41";
        ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y * size);
        drops[i] = y * size > canvas.height && Math.random() > 0.96 ? 0 : y + 1;
      });
    }, 60);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="matrix-rain" style={{ opacity }} aria-hidden />;
}
