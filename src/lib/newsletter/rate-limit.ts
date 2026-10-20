import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { newsletterRateEvent } from "@/db/schema";

export async function countRate(input: {
  bucket: string;
  keyHash: string;
  windowMs: number;
  now: Date;
}): Promise<number> {
  const d = await db();
  const since = new Date(input.now.getTime() - input.windowMs);
  const [row] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(newsletterRateEvent)
    .where(and(
      eq(newsletterRateEvent.bucket, input.bucket),
      eq(newsletterRateEvent.keyHash, input.keyHash),
      gte(newsletterRateEvent.createdAt, since),
    ));
  return Number(row?.n ?? 0);
}

export async function recordRate(input: {
  bucket: string;
  keyHash: string;
  now: Date;
}): Promise<void> {
  const d = await db();
  await d.insert(newsletterRateEvent).values({
    bucket: input.bucket,
    keyHash: input.keyHash,
    createdAt: input.now,
  });
  await d.delete(newsletterRateEvent).where(lt(
    newsletterRateEvent.createdAt,
    new Date(input.now.getTime() - 48 * 60 * 60 * 1000),
  ));
}

/** Returns true when this attempt is still inside the window. */
export async function allowRate(input: {
  bucket: string;
  keyHash: string;
  limit: number;
  windowMs: number;
  now: Date;
}): Promise<boolean> {
  const n = await countRate(input);
  if (n >= input.limit) return false;
  await recordRate(input);
  return true;
}
