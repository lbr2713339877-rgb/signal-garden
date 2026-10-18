"use client";

import { useEffect } from "react";
import { trackEvent } from "./track";

/** Fires one Umami event when the page mounts. */
export function TrackOnLoad({ event, data }: { event: string; data?: Record<string, string | number> }) {
  useEffect(() => {
    trackEvent(event, data);
    // Fire once per event name. `data` is read at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
  return null;
}
