export const runtime = "nodejs";
export const alt = "Signal Garden — Today";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// PUBLIC_BOARD_TTL in src/lib/public-cache.ts. Same window as /today.
export const revalidate = 300;

export { default } from "./opengraph-image";
