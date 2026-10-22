"use client";

import { useEffect } from "react";

/** Registers the offline shell. Fails silently when unsupported. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
