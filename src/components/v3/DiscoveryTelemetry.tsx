'use client';

import { useEffect } from 'react';
import type { DiscoveryEvent } from '@/lib/discovery-metrics';

/** Cookieless daily counters. No IDs, localStorage, search text or referrers. */
export function DiscoveryTelemetry() {
  useEffect(() => {
    if (navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const root = document.querySelector('main');
    if (!root) return;
    const seen = new Set<string>();
    const clicked = new Set<string>();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    let queue: DiscoveryEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const read = (element: Element): Omit<DiscoveryEvent, 'event'> | null => {
      const target = element.getAttribute('data-discovery-target');
      const placement = element.getAttribute('data-discovery-placement') as DiscoveryEvent['placement'];
      return target && ['featured', 'grid', 'task'].includes(placement) ? { target, placement } : null;
    };
    function flush() {
      clearTimeout(flushTimer);
      if (!queue.length) return;
      const batch = queue.splice(0, 24);
      void fetch('/api/discovery-events', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch), credentials: 'omit', keepalive: true }).catch(() => {});
      if (queue.length) flush();
    }
    function record(element: Element, event: DiscoveryEvent['event']) {
      const data = read(element);
      if (!data) return;
      const key = `${data.placement}:${data.target}`;
      const set = event === 'impression' ? seen : clicked;
      if (set.has(key)) return;
      set.add(key);
      queue.push({ ...data, event });
      clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, 250);
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        clearTimeout(timers.get(entry.target));
        timers.delete(entry.target);
        if (entry.isIntersecting && entry.intersectionRatio >= .5 && document.visibilityState === 'visible') {
          timers.set(entry.target, setTimeout(() => { record(entry.target, 'impression'); timers.delete(entry.target); }, 1000));
        }
      }
    }, { threshold: [.5] });
    root.querySelectorAll('[data-discovery-target]').forEach((element) => observer.observe(element));
    function click(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target.closest('[data-discovery-target]') : null;
      if (!element || !root?.contains(element)) return;
      record(element, 'impression');
      record(element, 'click');
      flush();
    }
    function visibility() {
      if (document.visibilityState === 'hidden') {
        timers.forEach(clearTimeout);
        timers.clear();
        flush();
      } else {
        root?.querySelectorAll('[data-discovery-target]').forEach((element) => { observer.unobserve(element); observer.observe(element); });
      }
    }
    root.addEventListener('click', click);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      clearTimeout(flushTimer);
      root.removeEventListener('click', click);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
      flush();
    };
  }, []);
  return null;
}
