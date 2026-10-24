"use client";

import { useEffect } from "react";
import { browserSubscribeDom, runSubscribeScroll } from "@/lib/subscribe-scroll";

/** Pages with the #subscribe form. Retries after client navigations and full loads. */
export function SubscribeHash() {
  useEffect(() => {
    let stop = runSubscribeScroll(browserSubscribeDom());
    const onHash = () => {
      stop();
      stop = runSubscribeScroll(browserSubscribeDom());
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      stop();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  return null;
}
