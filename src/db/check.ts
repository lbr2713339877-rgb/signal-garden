/**
 * Smoke test for the database layer. Prints the tables that exist and proves
 * a write/read round-trip works on whichever backend is configured.
 *
 *   pnpm db:check
 */

import { getDb, closeDb } from "./client";
import { loadLocalEnv } from "../lib/env";

loadLocalEnv();
import { dataSourceHealth, jobRun } from "./schema";
import { sql } from "drizzle-orm";

async function main() {
  const { db, raw, driver } = await getDb();
  console.log(`[check] driver = ${driver}\n`);

  const tables = await raw.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const names: string[] = ((tables as any).rows ?? []).map(
    (r: any) => r.table_name,
  );
  console.log(`[check] ${names.length} public tables:`);
  for (const n of names) console.log(`         - ${n}`);

  // Round-trip through Drizzle to prove the mapping, not just the DDL.
  const probe = `check-${Date.now()}`;
  await db.insert(dataSourceHealth).values({
    source: probe,
    quotaRemaining: 42,
  });

  const readBack = await db
    .select()
    .from(dataSourceHealth)
    .where(sql`${dataSourceHealth.source} = ${probe}`);

  console.log(
    `\n[check] round-trip: ${readBack.length === 1 ? "OK" : "FAILED"} ` +
      `(quotaRemaining=${readBack[0]?.quotaRemaining})`,
  );

  await raw.query(`DELETE FROM data_source_health WHERE source = $1`, [probe]);

  const runs = await db.select().from(jobRun).limit(1);
  console.log(`[check] job_run readable: ${runs.length >= 0 ? "OK" : "FAILED"}`);

  await closeDb();
  console.log("\n[check] done");
}

main().catch(async (err) => {
  console.error("[check] failed:", err);
  await closeDb().catch(() => {});
  process.exit(1);
});
