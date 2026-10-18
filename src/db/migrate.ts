/**
 * Applies generated migrations to whichever backend the environment selects.
 *
 *   pnpm db:migrate        # local PGlite file database
 *   DATABASE_URL=... pnpm db:migrate   # production Postgres
 *
 * This runs the same .sql files in both places, which is the entire reason
 * PGlite was chosen over SQLite: one set of migrations to trust.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "./client";
import { loadLocalEnv } from "../lib/env";

loadLocalEnv();

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

async function rawExec(raw: any, sql: string) {
  // PGlite exposes exec(); node-postgres exposes query(). Both execute a SQL
  // string, so migrations need this tiny adapter to run on either backend.
  if (typeof raw.exec === "function") return raw.exec(sql);
  return raw.query(sql);
}

async function ensureJournalTable(raw: any) {
  // Drizzle's own bookkeeping table. Created by hand so the first run on a
  // blank database has somewhere to record what it applied.
  await rawExec(raw, `
    CREATE TABLE IF NOT EXISTS _sg_migrations (
      tag        text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

function migrationFiles(): { tag: string; sql: string }[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch {
    return [];
  }

  return entries
    .filter((f) => /^\d+_[\w-]+\.sql$/.test(f))
    .sort() // drizzle prefixes with a zero-padded index, so lexical sort is order
    .map((f) => ({
      tag: f.replace(/\.sql$/, ""),
      sql: readFileSync(join(MIGRATIONS_DIR, f), "utf8"),
    }));
}

async function main() {
  const { raw, driver } = await getDb();
  console.log(`[migrate] driver=${driver}`);

  await ensureJournalTable(raw);

  let applied = 0;
  for (const { tag, sql } of migrationFiles()) {
    const seen = await raw.query(
      `SELECT 1 FROM _sg_migrations WHERE tag = $1`,
      [tag],
    );
    if (seen.rows?.length) {
      console.log(`[migrate] skip   ${tag}`);
      continue;
    }

    console.log(`[migrate] apply  ${tag}`);
    // Drizzle emits each statement separated by this marker.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await rawExec(raw, statement);
    }

    await raw.query(`INSERT INTO _sg_migrations (tag) VALUES ($1)`, [tag]);
    applied += 1;
  }

  console.log(
    applied === 0
      ? "[migrate] up to date — nothing to apply"
      : `[migrate] applied ${applied} migration(s)`,
  );

  await closeDb();
}

main().catch(async (err) => {
  console.error("[migrate] failed:", err);
  await closeDb().catch(() => {});
  process.exit(1);
});
