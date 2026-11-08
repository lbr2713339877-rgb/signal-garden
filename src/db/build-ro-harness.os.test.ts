import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { runBuildRoHarness } from "./build-ro-harness";

const checkout = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

function pgBin(name: string): string {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return name;
  for (const version of readdirSync(root)) {
    const path = join(root, version, "bin", name);
    if (existsSync(path)) return path;
  }
  return name;
}

const dataDir = mkdtempSync(join(tmpdir(), "sg-ro-harness-"));
const port = 54332;
const databaseUrl = `postgresql://sgharness@127.0.0.1:${port}/sgharness`;

function run(bin: string, args: string[]) {
  execFileSync(bin, args, { env: process.env, stdio: "pipe" });
}

describe("build read-only harness on disposable postgres", { concurrency: 1 }, () => {
  before(() => {
    run(pgBin("initdb"), ["-D", dataDir, "-U", "sgharness", "--auth=trust", "--no-instructions"]);
    run(pgBin("pg_ctl"), ["-D", dataDir, "-l", join(dataDir, "log"), "-o", `-p ${port} -k ${dataDir} -c listen_addresses=127.0.0.1`, "start"]);
    const ready = pgBin("pg_isready");
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        execFileSync(ready, ["-h", "127.0.0.1", "-p", String(port), "-U", "sgharness"], { stdio: "pipe" });
        break;
      } catch (err) {
        if (attempt === 49) throw err;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
      }
    }
    execFileSync(pgBin("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "sgharness", "sgharness"]);
  });

  after(() => {
    try { run(pgBin("pg_ctl"), ["-D", dataDir, "stop", "-m", "immediate"]); } catch { /* stopped */ }
    rmSync(dataDir, { recursive: true, force: true });
  });

  test("four getDb processes report postgres and both settings on", async () => {
    const result = await runBuildRoHarness({
      mode: "local",
      databaseUrl,
      flag: "true",
      candidate: checkout,
      limits: { workerTimeoutMs: 10_000, parentTimeoutMs: 30_000, killGraceMs: 200 },
    });
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 4);
    assert.equal(result.failures, 0);
    assert.equal(result.reports.length, 4);
    for (const report of result.reports) {
      assert.equal(report.candidate, checkout);
      assert.equal(report.driver, "postgres");
      assert.equal(report.flag, true);
      assert.equal(report.urlNonempty, true);
      assert.equal(report.init, "on");
      assert.equal(report.query, "on");
      assert.equal(report.port, port);
    }
  });

  test("an old checkout echo is rejected against the real HEAD", async () => {
    const result = await runBuildRoHarness({
      mode: "local",
      databaseUrl,
      flag: "true",
      candidate: "e3d878d922fb0654222987497d02a8b3df956d25",
      limits: { workerTimeoutMs: 10_000, parentTimeoutMs: 30_000, killGraceMs: 200 },
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "sha");
    assert.equal(result.attempts, 0);
    assert.equal(result.reports.length, 0);
  });

  test("an explicit read-only worker with an empty URL does not open PGlite", async () => {
    const child = spawn("pnpm", ["exec", "tsx", "src/db/build-ro-harness-worker.ts"], {
      env: {
        ...process.env,
        DATABASE_URL: "",
        SG_BUILD_READ_ONLY: "true",
        BUILD_RO_EXPECT_SHA: checkout,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
    const report = JSON.parse(stdout.trim());
    assert.notEqual(code, 0);
    assert.equal(report.reason, "missing-url");
    assert.equal(report.driver, "none");
    assert.equal(report.flag, true);
    assert.equal(report.candidate, checkout);
    assert.equal(stdout.includes("postgres://"), false);
  });

  test("getDb query timeout fires without a second pool", async () => {
    const child = spawn("pnpm", ["exec", "tsx", "src/db/build-ro-harness-worker.ts"], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SG_BUILD_READ_ONLY: "true",
        PG_POOL_MAX: "1",
        SG_BUILD_DB_CONNECT_TIMEOUT_MS: "5000",
        SG_BUILD_DB_QUERY_TIMEOUT_MS: "200",
        BUILD_RO_TEST_SLEEP: "1",
        BUILD_RO_EXPECT_SHA: checkout,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
    const report = JSON.parse(stdout.trim());
    assert.notEqual(code, 0);
    assert.equal(report.reason, "timeout");
    assert.equal(report.query, "off");
  });
});
