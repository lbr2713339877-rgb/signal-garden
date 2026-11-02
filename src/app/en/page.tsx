/**
 * English share URL. Same edition as /today; only the metadata is English.
 */
import type { Metadata } from "next";
import { enShareMetadata } from "@/lib/page-meta";

export const metadata: Metadata = enShareMetadata();
// PUBLIC_BOARD_TTL in src/lib/public-cache.ts. Same edition as /today.
export const revalidate = 300;

export { default } from "../(site)/today/page";
