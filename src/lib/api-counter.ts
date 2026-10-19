import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { apiRequestDaily } from "@/db/schema";
import { signalDate } from "@/lib/day";

/** One increment per origin hit. The path is a route we chose, never a visitor id. */
export async function countApiRequest(path: string, day = signalDate()): Promise<void> {
  const d = await db();
  await d.insert(apiRequestDaily).values({ day, path, count: 1 }).onConflictDoUpdate({
    target: [apiRequestDaily.day, apiRequestDaily.path],
    set: { count: sql`${apiRequestDaily.count} + 1` },
  });
}
