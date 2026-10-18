"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Saved items live in localStorage in v1 — no account, no backend.
 *
 * The stored shape is already just a list of project slugs, which is what
 * user_save will key on when accounts arrive, so merging upward is a copy.
 */
const KEY = "signal-garden:saved";

export function useSaved() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      setSlugs(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setSlugs([]);
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: string[]) => {
    setSlugs(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode or quota: the in-memory list still works for this session.
    }
  }, []);

  return {
    slugs,
    ready,
    has: (slug: string) => slugs.includes(slug),
    toggle: (slug: string) =>
      persist(slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug]),
    clear: () => persist([]),
  };
}
