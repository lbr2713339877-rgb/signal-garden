"use client";

import { useEffect } from "react";
import { ATTRIBUTION_STORAGE_KEY, firstTouchRecord } from "@/lib/newsletter/attribution";

/**
 * Records the first landing in this tab. It reads the address bar and
 * document.referrer only, writes sessionStorage once, and does not fetch.
 */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const existing = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      const next = firstTouchRecord(existing, window.location.search, document.referrer);
      if (next !== null) window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, next);
    } catch {
      /* A blocked sessionStorage must not break the page. Signup still works. */
    }
  }, []);
  return null;
}
