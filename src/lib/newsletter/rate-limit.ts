import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { newsletterRateEvent } from "@/db/schema";

/** Returns true when this attempt is still inside the window. */
export async function allowRate(input: {
  bucket: "ip" | "email";
  keyHash: string;
  limit: number;
  windowMs: number;
  now: Date;
}): Promise<boolean> {
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
  if (Number(row?.n ?? 0) >= input.limit) return false;
  await d.insert(newsletterRateEvent).values({
    bucket: input.bucket,
    keyHash: input.keyHash,
    createdAt: input.now,
  });
  await d.delete(newsletterRateEvent).where(lt(
    newsletterRateEvent.createdAt,
    new Date(input.now.getTime() - 48 * 60 * 60 * 1000),
  ));
  return true;
}
