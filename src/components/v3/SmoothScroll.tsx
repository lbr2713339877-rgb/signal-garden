'use client';

/**
 * Site-wide smooth scrolling via Lenis.
 *
 * Three edge cases matter more than the effect itself:
 *
 *   1. `prefers-reduced-motion: reduce` — Lenis hijacks the wheel and replays
 *      it, which is exactly the motion a vestibular-sensitive user asked to
 *      avoid. We never initialise it in that case; the page keeps native scroll.
 *   2. Touch devices — Lenis on a touchscreen fights momentum scrolling and
 *      makes the page feel broken. We disable `smoothWheel` there and let the
 *      browser handle it natively.
 *   3. Client-side navigation — without an explicit reset the new route opens
 *      at the previous page's scroll offset. We scroll to top on pathname change.
 *
 * The animation loop uses the library's own rAF pattern; there is no React
 * state involved, so scrolling never triggers a re-render.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    window.matchMedia('(hover: none)').matches
  );
}

export function SmoothScroll() {
  const pathname = usePathname();
  const enabled = pathname.startsWith('/c/') || pathname === '/discoveries';
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Reduced motion or touch: stay on native scrolling, permanently.
    if (!enabled || reducedMotion() || isTouchDevice()) return;

    const lenis = new Lenis({
      duration: 0.7,
      autoToggle: true,
      allowNestedScroll: true,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled]);

  /* Route change: jump to the top so the new page does not inherit the old
     scroll position. `immediate` skips the smoothing on purpose. */
  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
  }, [pathname]);

  /* In-page anchors (the legal pages use #section links) must go through Lenis.
     Native `scroll-behavior: smooth` is disabled while Lenis is active, so a
     plain anchor click would jump instantly without this interception. */
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('a[href^="#"]');
      if (!target) return;
      const id = target.getAttribute('href')?.slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -80 });
      history.pushState(null, '', `#${id}`);
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pathname]);

  return null;
}
