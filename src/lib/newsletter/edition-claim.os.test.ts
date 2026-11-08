import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { Pool } from "pg";

function pgBin(name: string): string {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return name;
  for (const version of readdirSync(root)) {
    const path = join(root, version, "bin", name);
    if (existsSync(path)) return path;
  }
  return name;
}

const dataDir = mkdtempSync(join(tmpdir(), "sg-weekly-pg-"));
const port = 54329;
const databaseUrl = `postgresql://sgclaim@/sgclaim?host=${encodeURIComponent(dataDir)}&port=${port}`;
let pool: Pool | undefined;

function run(bin: string, args: string[]) {
  execFileSync(bin, args, { env: process.env, stdio: "pipe" });
}

async function startPostgres() {
  run(pgBin("initdb"), ["-D", dataDir, "-U", "sgclaim", "--auth=trust", "--no-instructions"]);
  run(pgBin("pg_ctl"), ["-D", dataDir, "-l", join(dataDir, "log"), "-o", `-p ${port} -k ${dataDir} -c listen_addresses=`, "start"]);
  const ready = pgBin("pg_isready");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      execFileSync(ready, ["-h", dataDir, "-p", String(port), "-U", "sgclaim"], { stdio: "pipe" });
      break;
    } catch (err) {
      if (attempt === 49) throw err;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  execFileSync(pgBin("createdb"), ["-h", dataDir, "-p", String(port), "-U", "sgclaim", "sgclaim"]);
  pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5_000 });
  await pool.query(`
    CREATE TYPE newsletter_send_status AS ENUM ('queued', 'sent', 'failed', 'bounced');
    CREATE TABLE newsletter_send (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_date date NOT NULL,
      subscriber_id uuid NOT NULL,
      resend_message_id text,
      status newsletter_send_status NOT NULL,
      UNIQUE (edition_date, subscriber_id)
    );
  `);
}

function spawnWorker(mode: string, subscriberId: string, marker: string) {
  return new Promise<{ code: number; stdout: string }>((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "src/lib/newsletter/edition-claim.os-worker.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAIM_DATABASE_URL: databaseUrl,
        CLAIM_SUBSCRIBER_ID: subscriberId,
        CLAIM_EDITION_DATE: "2026-11-09",
        CLAIM_MODE: mode,
        CLAIM_MARKER: marker,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`worker ${mode} exit ${code}: ${stderr}\n${stdout}`));
      else resolve({ code: code ?? 1, stdout });
    });
  });
}

function markerCount(path: string): number {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split("\n").filter(Boolean).length;
}

describe("local postgres os processes", { concurrency: 1 }, () => {
before(startPostgres);

test("two OS processes send once for one edition subscriber", async () => {
  const subscriberId = crypto.randomUUID();
  const marker = join(dataDir, "sends.log");
  const [left, right] = await Promise.all([
    spawnWorker("send", subscriberId, marker),
    spawnWorker("send", subscriberId, marker),
  ]);
  assert.equal(left.code, 0);
  assert.equal(right.code, 0);
  assert.equal(markerCount(marker), 1);
  const row = await pool!.query(
    "SELECT status, resend_message_id FROM newsletter_send WHERE subscriber_id = $1",
    [subscriberId],
  );
  assert.equal(row.rows.length, 1);
  assert.equal(row.rows[0].status, "sent");
  assert.ok(String(row.rows[0].resend_message_id ?? "").startsWith("provider-"));
});

test("an aborted send stays held after the process exits", async () => {
  const subscriberId = crypto.randomUUID();
  const marker = join(dataDir, "abort.log");
  const first = await spawnWorker("abort", subscriberId, marker);
  assert.equal(first.code, 0);
  assert.equal(markerCount(marker), 1);
  let row = await pool!.query(
    "SELECT status, resend_message_id FROM newsletter_send WHERE subscriber_id = $1",
    [subscriberId],
  );
  assert.equal(row.rows[0].status, "sent");
  assert.equal(row.rows[0].resend_message_id, null);
  const retryMarker = join(dataDir, "abort-retry.log");
  const second = await spawnWorker("retry", subscriberId, retryMarker);
  assert.equal(second.code, 0);
  assert.equal(markerCount(retryMarker), 0);
  row = await pool!.query(
    "SELECT status, resend_message_id FROM newsletter_send WHERE subscriber_id = $1",
    [subscriberId],
  );
  assert.equal(row.rows[0].status, "sent");
  assert.equal(row.rows[0].resend_message_id, null);
});

test("two failed id writes stay held after the process exits", async () => {
  const subscriberId = crypto.randomUUID();
  const marker = join(dataDir, "persist.log");
  const first = await spawnWorker("persist-fail", subscriberId, marker);
  assert.equal(first.code, 0);
  assert.equal(markerCount(marker), 1);
  let row = await pool!.query(
    "SELECT status, resend_message_id FROM newsletter_send WHERE subscriber_id = $1",
    [subscriberId],
  );
  assert.equal(row.rows[0].status, "sent");
  assert.equal(row.rows[0].resend_message_id, null);
  const retryMarker = join(dataDir, "persist-retry.log");
  const second = await spawnWorker("retry", subscriberId, retryMarker);
  assert.equal(second.code, 0);
  assert.equal(markerCount(retryMarker), 0);
  row = await pool!.query(
    "SELECT status, resend_message_id FROM newsletter_send WHERE subscriber_id = $1",
    [subscriberId],
  );
  assert.equal(row.rows[0].status, "sent");
  assert.equal(row.rows[0].resend_message_id, null);
});

after(async () => {
  await pool?.end().catch(() => undefined);
  try {
    execFileSync(pgBin("pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"], { stdio: "pipe" });
  } catch {
    // The cluster may already be stopped.
  }
  rmSync(dataDir, { recursive: true, force: true });
});
});
