/**
 * One OS process for the local Postgres claim test. Not a test file.
 * MODE=send writes one marker file if transport.send runs.
 * MODE=abort lets the send time out.
 * MODE=persist-fail throws on both id writes.
 * MODE=retry attempts a claim and writes a marker only if transport runs.
 */
import { appendFileSync } from "node:fs";
import { Pool } from "pg";
import { claimAndSend, claimDbFromPool, type ClaimDb } from "./edition-claim";

const databaseUrl = process.env.CLAIM_DATABASE_URL ?? "";
const subscriberId = process.env.CLAIM_SUBSCRIBER_ID ?? "";
const editionDate = process.env.CLAIM_EDITION_DATE ?? "2026-11-09";
const mode = process.env.CLAIM_MODE ?? "send";
const marker = process.env.CLAIM_MARKER ?? "";

if (!databaseUrl || !subscriberId || !marker) {
  console.error("missing claim worker env");
  process.exit(2);
}

function countingDb(inner: ClaimDb): ClaimDb {
  return {
    async statement(text, params) {
      if (mode === "persist-fail" && text.includes("SET resend_message_id")) {
        throw new Error("persist failed");
      }
      return inner.statement(text, params);
    },
  };
}

const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000 });
const db = countingDb(claimDbFromPool(pool));

const result = await claimAndSend({
  db,
  editionDate,
  subscriberId,
  timeoutMs: mode === "abort" ? 200 : 5_000,
  transport: (signal) => {
    appendFileSync(marker, `${process.pid}\n`);
    if (mode === "abort") {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }
    return new Promise((resolve) => {
      setTimeout(() => resolve({ accepted: true, id: `provider-${process.pid}` }), 400);
    });
  },
});

console.log(JSON.stringify({ pid: process.pid, action: result.action, reason: "reason" in result ? result.reason : null }));
await pool.end();
process.exit(0);
