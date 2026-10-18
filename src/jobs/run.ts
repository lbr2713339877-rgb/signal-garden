/**
 * Job wrapper: every run is recorded in job_run, and the GitHub source's
 * health row is updated so /status can tell the truth about outages.
 */

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dataSourceHealth, jobRun } from "@/db/schema";
import { quotaSnapshot } from "@/collectors/github/client";

export interface JobResult {
  itemsIn: number;
  itemsOut: number;
  meta?: Record<string, unknown>;
}

export function log(job: string, msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${job.padEnd(8)} ${msg}`);
}

export async function runJob(job: string, fn: () => Promise<JobResult>): Promise<boolean> {
  const { db } = await getDb();
  const [run] = await db.insert(jobRun).values({ job }).returning({ id: jobRun.id });
  const started = Date.now();

  try {
    const r = await fn();
    const durationMs = Date.now() - started;
    await db
      .update(jobRun)
      .set({
        status: "ok",
        finishedAt: new Date(),
        itemsIn: r.itemsIn,
        itemsOut: r.itemsOut,
        meta: { ...r.meta, github: quotaSnapshot(), durationMs },
      })
      .where(eq(jobRun.id, run.id));
    await recordHealth(true);
    log(job, `ok in ${(durationMs / 1000).toFixed(1)}s — in ${r.itemsIn}, out ${r.itemsOut}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(jobRun)
      .set({ status: "failed", finishedAt: new Date(), lastError: message.slice(0, 2000), meta: { github: quotaSnapshot() } })
      .where(eq(jobRun.id, run.id));
    await recordHealth(false, message);
    log(job, `FAILED — ${message}`);
    return false;
  }
}

async function recordHealth(ok: boolean, error?: string) {
  const { db } = await getDb();
  const q = quotaSnapshot();
  const quotaRemaining = q.quota.core?.remaining ?? q.quota.graphql?.remaining ?? null;
  const now = new Date();

  await db
    .insert(dataSourceHealth)
    .values({
      source: "github",
      lastOkAt: ok ? now : null,
      lastError: ok ? null : error,
      lastErrorAt: ok ? null : now,
      consecutiveFailures: ok ? 0 : 1,
      quotaRemaining,
      latencyMs: q.avgLatencyMs,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: dataSourceHealth.source,
      set: ok
        ? { lastOkAt: now, consecutiveFailures: 0, quotaRemaining, latencyMs: q.avgLatencyMs, updatedAt: now }
        : {
            lastError: error,
            lastErrorAt: now,
            consecutiveFailures: sql`${dataSourceHealth.consecutiveFailures} + 1`,
            quotaRemaining,
            updatedAt: now,
          },
    });
}
