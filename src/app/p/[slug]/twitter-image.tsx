export const runtime = "nodejs";
export const alt = "Signal Garden";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// PROJECT_PAGE_TTL in src/lib/public-cache.ts. Segment config must be a literal.
export const revalidate = 21600;

export { default } from "./opengraph-image";
