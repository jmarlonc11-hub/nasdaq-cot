"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Pide datos nuevos al servidor sin recargar la página (pestañas que quedan abiertas).
export default function AutoRefresh({ everyMs = 30 * 60 * 1000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
