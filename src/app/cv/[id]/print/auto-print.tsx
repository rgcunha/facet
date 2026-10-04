"use client";

import { useEffect } from "react";

/** Opens the print dialog once fonts have loaded, so the layout is final. */
export function AutoPrint() {
  useEffect(() => {
    let cancelled = false; // React runs effects twice in development; only the surviving run prints.
    void document.fonts.ready.then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
