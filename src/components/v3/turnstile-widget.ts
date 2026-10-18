"use client";

const SCRIPT_MATCH = "challenges.cloudflare.com/turnstile/v0/api.js";
const SCRIPT_SRC = `https://${SCRIPT_MATCH}?render=explicit`;

export type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let pending: Promise<TurnstileApi> | null = null;

function existingScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(`script[src*="${SCRIPT_MATCH}"]`);
}

/**
 * Call render once the host node exists. Client navigations mount the form
 * after the effect, so a single synchronous read of the ref can miss it.
 */
export function scheduleTurnstileRender(input: {
  getHost: () => HTMLElement | null;
  render: (host: HTMLElement) => void;
  now?: () => number;
  later?: (fn: () => void, ms: number) => number;
  budgetMs?: number;
}): { cancel: () => void } {
  const now = input.now ?? (() => Date.now());
  const later = input.later ?? ((fn, ms) => window.setTimeout(fn, ms));
  const budgetMs = input.budgetMs ?? 3000;
  const started = now();
  let cancelled = false;
  const tick = () => {
    if (cancelled) return;
    const host = input.getHost();
    if (host) {
      input.render(host);
      return;
    }
    if (now() - started >= budgetMs) return;
    later(tick, 50);
  };
  tick();
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}

/** Load the explicit-render API once. Resolves immediately when the script is already on the page. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("turnstile is browser-only"));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    if (!existingScript()) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error("turnstile script failed"));
      document.head.appendChild(script);
    }
    const started = Date.now();
    const tick = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }
      if (Date.now() - started > 8000) {
        reject(new Error("turnstile did not load"));
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
  pending.catch(() => {
    pending = null;
  });
  return pending;
}
