/**
 * English share URL. Same edition as /today; only the metadata is English.
 */
import type { Metadata } from "next";
import { enShareMetadata } from "@/lib/page-meta";

export const metadata: Metadata = enShareMetadata();
export const revalidate = 0;

export { default } from "../(site)/today/page";
