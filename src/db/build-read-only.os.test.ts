import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { Pool } from "pg";
import { postgresPoolConfig } from "./build-read-only";

function pgBin(name: string): string {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return name;
  for (const version of readdirSync(root)) {
    const path = join(root, version, "bin", name);
    if (existsSync(path)) return path;
  }
  return name;
}

const dataDir = mkdtempSync(join(tmpdir(), "sg-build-ro-"));
const port = 54331;
const databaseUrl = `postgresql://sgbuildro@/sgbuildro?host=${encodeURIComponent(dataDir)}&port=${port}`;

function run(bin: string, args: string[]) {
  execFileSync(bin, args, { env: process.env, stdio: "pipe" });
}

function startPostgres() {
  run(pgBin("initdb"), ["-D", dataDir, "-U", "sgbuildro", "--auth=trust", "--no-instructions"]);
  run(pgBin("pg_ctl"), ["-D", dataDir, "-l", join(dataDir, "log"), "-o", `-p ${port} -k ${dataDir} -c listen_addresses=`, "start"]);
  const ready = pgBin("pg_isready");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      execFileSync(ready, ["-h", dataDir, "-p", String(port), "-U", "sgbuildro"], { stdio: "pipe" });
      return;
    } catch (err) {
      if (attempt === 49) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

function stopPostgres() {
  try {
    run(pgBin("pg_ctl"), ["-D", dataDir, "stop", "-m", "immediate"]);
  } catch {
    // The directory is removed next.
  }
  rmSync(dataDir, { recursive: true, force: true });
}

function spawnWorker(readOnly: boolean): Promise<{ default_transaction_read_only: string; transaction_read_only: string; pid: number; write: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", "src/db/build-read-only.os-worker.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        BUILD_RO_DATABASE_URL: databaseUrl,
        SG_BUILD_READ_ONLY: readOnly ? "true" : "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`worker exit ${code}: ${stderr}\n${stdout}`));
      else resolve(JSON.parse(stdout.trim()));
    });
  });
}

describe("build read-only local postgres", { concurrency: 1 }, () => {
  before(() => {
    startPostgres();
    execFileSync(pgBin("createdb"), ["-h", dataDir, "-p", String(port), "-U", "sgbuildro", "sgbuildro"]);
  });
  after(() => stopPostgres());

  test("two workers initialize read-only before their own select, and a new backend does it again", async () => {
    const [left, right] = await Promise.all([spawnWorker(true), spawnWorker(true)]);
    for (const row of [left, right]) {
      assert.equal(row.default_transaction_read_only, "on");
      assert.equal(row.transaction_read_only, "on");
      assert.match(row.write, /read-only transaction/);
    }
    assert.notEqual(left.pid, right.pid);

    const pool = new Pool(postgresPoolConfig({ connectionString: databaseUrl, readOnly: true, max: 1 }));
    try {
      const first = await pool.query("SELECT pg_backend_pid() AS pid");
      const pid = Number(first.rows[0].pid);
      await pool.query("SELECT pg_terminate_backend($1)", [pid]).catch(() => {});
      const second = await pool.query(
        "SELECT pg_backend_pid() AS pid, current_setting('default_transaction_read_only') AS default_transaction_read_only, current_setting('transaction_read_only') AS transaction_read_only",
      );
      assert.notEqual(Number(second.rows[0].pid), pid);
      assert.equal(second.rows[0].default_transaction_read_only, "on");
      assert.equal(second.rows[0].transaction_read_only, "on");
      await assert.rejects(
        pool.query("CREATE TEMP TABLE build_ro_again(id int)"),
        /read-only transaction/,
      );
    } finally {
      await pool.end();
    }
  });

  test("the switch off does not change a normal read-write session", async () => {
    const row = await spawnWorker(false);
    assert.equal(row.default_transaction_read_only, "off");
    assert.equal(row.transaction_read_only, "off");
    assert.equal(row.write, "ok");
  });
});
