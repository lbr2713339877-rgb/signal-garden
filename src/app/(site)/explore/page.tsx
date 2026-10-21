import { redirect } from "next/navigation";

/**
 * /explore is retired.
 *
 * v1 organised this page around four "focus themes" (web, design, motion,
 * token). V2 replaces them with six categories that carry their own second
 * level and sort control, so a separate intent page would be a third taxonomy
 * to keep in sync. The redirect keeps any existing link working.
 */
export default function ExplorePage() {
  redirect("/c");
}
