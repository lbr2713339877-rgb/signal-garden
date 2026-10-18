/** Homepage subscribe target. Hash scrolling in the App Router drops the hash when the form streams in late. */

export const SUBSCRIBE_HASH = "#subscribe";
export const SUBSCRIBE_ID = "subscribe";
export const SUBSCRIBE_SCROLL_BUDGET_MS = 3000;
export const SUBSCRIBE_SCROLL_MARGIN_PX = 110;

export function subscribeHref(medium: string): string {
  const params = new URLSearchParams({
    utm_source: "signalgarden",
    utm_medium: medium,
    utm_campaign: "subscribe",
  });
  return `/?${params.toString()}${SUBSCRIBE_HASH}`;
}

export function isSubscribeHash(hash: string): boolean {
  return hash === SUBSCRIBE_HASH;
}

export type SubscribeAttempt = "wait" | "scroll" | "stop";

/** Keep waiting until the form exists, then scroll. Stop once the budget passes or the hash leaves. */
export function nextSubscribeAttempt(input: {
  hash: string;
  hasTarget: boolean;
  elapsedMs: number;
  budgetMs?: number;
}): SubscribeAttempt {
  if (!isSubscribeHash(input.hash)) return "stop";
  if (input.hasTarget) return "scroll";
  if (input.elapsedMs >= (input.budgetMs ?? SUBSCRIBE_SCROLL_BUDGET_MS)) return "stop";
  return "wait";
}

export type SubscribeDom = {
  hash: () => string;
  target: () => HTMLElement | null;
  emailInput: (target: HTMLElement) => HTMLElement | null;
  scroll: (target: HTMLElement) => void;
  focus: (input: HTMLElement) => void;
  now: () => number;
  frame: (fn: () => void) => number;
  later: (fn: () => void, ms: number) => number;
  cancelFrame: (id: number) => void;
  cancelLater: (id: number) => void;
};

/**
 * On mount and hashchange: if the hash is #subscribe, scroll the form into view
 * and focus the email field. Retries with a frame plus a short interval until
 * the element exists, then scrolls once more so a late route scroll-to-top
 * does not leave the page at the top.
 */
export function runSubscribeScroll(dom: SubscribeDom, budgetMs = SUBSCRIBE_SCROLL_BUDGET_MS): () => void {
  const started = dom.now();
  let frameId = 0;
  let timerId = 0;
  let stopped = false;
  let scrolls = 0;

  const clear = () => {
    if (frameId) dom.cancelFrame(frameId);
    if (timerId) dom.cancelLater(timerId);
    frameId = 0;
    timerId = 0;
  };

  const stop = () => {
    stopped = true;
    clear();
  };

  const tick = () => {
    if (stopped) return;
    clear();
    const elapsed = dom.now() - started;
    const target = dom.target();
    const attempt = nextSubscribeAttempt({
      hash: dom.hash(),
      hasTarget: Boolean(target),
      elapsedMs: elapsed,
      budgetMs,
    });
    if (attempt === "stop") return;
    if (attempt === "scroll" && target) {
      dom.scroll(target);
      const input = dom.emailInput(target);
      if (input) dom.focus(input);
      scrolls += 1;
      // One later pass covers a route scroll-to-top that lands after the first paint.
      if (scrolls >= 2 || elapsed >= budgetMs) return;
      timerId = dom.later(tick, 250);
      return;
    }
    frameId = dom.frame(() => {
      if (stopped) return;
      timerId = dom.later(tick, 50);
    });
  };

  tick();
  return stop;
}

export function browserSubscribeDom(): SubscribeDom {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    hash: () => window.location.hash,
    target: () => document.getElementById(SUBSCRIBE_ID),
    emailInput: (target) => target.querySelector<HTMLElement>("input[type='email']"),
    scroll: (target) => target.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }),
    focus: (input) => input.focus({ preventScroll: true }),
    now: () => performance.now(),
    frame: (fn) => window.requestAnimationFrame(fn),
    later: (fn, ms) => window.setTimeout(fn, ms),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
    cancelLater: (id) => window.clearTimeout(id),
  };
}
