"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { browserSubscribeDom, runSubscribeScroll, subscribeHref } from "@/lib/subscribe-scroll";

/**
 * Plain anchor, not next/link. Cross-page loads keep the hash; on the homepage
 * the click scrolls to the form without a client navigation that drops it.
 */
export function SubscribeLink({
  medium,
  className,
  children,
}: {
  medium: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const href = subscribeHref(medium);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") return;
    event.preventDefault();
    const url = new URL(href, window.location.origin);
    const next = `${url.pathname}${url.search}#subscribe`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== next) window.history.pushState(null, "", next);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    runSubscribeScroll(browserSubscribeDom());
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
