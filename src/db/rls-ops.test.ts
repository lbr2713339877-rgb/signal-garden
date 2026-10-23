import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const TAG = "0019_enable_rls_newsletter_and_ops_tables";
const TABLES = [
  "newsletter_subscriber",
  "newsletter_send",
  "newsletter_rate_event",
  "indexnow_submission",
  "api_request_daily",
  "project_slug_alias",
] as const;

const STATEMENTS = TABLES.map((table) => `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);

test("newsletter and ops RLS migration matches production and blocks anon", async () => {
  const sql = readFileSync(`drizzle/${TAG}.sql`, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((part) => part.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
  assert.deepEqual(statements, STATEMENTS);

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: { tag: string }[];
  };
  assert.equal(journal.entries.at(-1)?.tag, TAG);

  const raw = new PGlite();
  try {
    const files = readdirSync("drizzle").filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
    for (const file of files) await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
    await raw.exec(sql);

    const flags = await raw.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (${TABLES.map((table) => `'${table}'`).join(", ")})
      ORDER BY c.relname
    `);
    assert.deepEqual(
      flags.rows.map((row) => row.relname),
      [...TABLES].sort(),
    );
    for (const row of flags.rows) {
      assert.equal(row.relrowsecurity, true, row.relname);
      assert.equal(row.relforcerowsecurity, false, row.relname);
    }

    const policies = await raw.query<{ tablename: string }>(`
      SELECT tablename FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (${TABLES.map((table) => `'${table}'`).join(", ")})
    `);
    assert.equal(policies.rows.length, 0);

    await raw.exec(`
      INSERT INTO newsletter_subscriber (email_hash, unsub_token_hash)
      VALUES ('owner-hash', 'owner-unsub')
    `);
    const owner = await raw.query<{ n: number }>(`
      SELECT count(*)::int AS n FROM newsletter_subscriber WHERE email_hash = 'owner-hash'
    `);
    assert.equal(owner.rows[0]?.n, 1);

    await raw.exec(`
      CREATE ROLE sg_anon NOLOGIN;
      GRANT USAGE ON SCHEMA public TO sg_anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON
        public.newsletter_subscriber,
        public.newsletter_send,
        public.newsletter_rate_event,
        public.indexnow_submission,
        public.api_request_daily,
        public.project_slug_alias
      TO sg_anon;
    `);
    await raw.exec("SET ROLE sg_anon");
    const hidden = await raw.query<{ n: number }>("SELECT count(*)::int AS n FROM newsletter_subscriber");
    assert.equal(hidden.rows[0]?.n, 0);
    await assert.rejects(
      raw.exec(`
        INSERT INTO newsletter_rate_event (bucket, key_hash)
        VALUES ('subscribe', 'anon-hash')
      `),
    );
  } finally {
    await raw.close();
  }
});
