import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { HARNESS_LIMITS, resolveHarnessLimits, runBuildRoHarness, track, verifierDatabaseUrl, type SafeWorkerReport } from "./build-ro-harness";

const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const OLD = "e3d878d922fb0654222987497d02a8b3df956d25";
const OTHER = "0000000000000000000000000000000000000000";
const LOCAL_URL = "postgresql://sg@127.0.0.1:54332/local";
const PRODUCTION_URL = "postgresql://app:secret-not-prod@pooler.internal:6543/garden";

function okReport(port: number, candidate = HEAD): SafeWorkerReport {
  return {
    ok: true,
    reason: "ok",
    candidate,
    flag: true,
    urlNonempty: true,
    port,
    backendPort: 16001,
    driver: "postgres",
    init: "on",
    query: "on",
    attempt: 1,
  };
}

function portOf(env: NodeJS.ProcessEnv): number {
  return Number(env.DATABASE_URL?.match(/:(\d+)(?:\/|\?|$)/)?.[1]);
}

function scripted(results: Array<"ok" | "fail" | "hang" | "stuck">, candidate = HEAD) {
  const calls: NodeJS.ProcessEnv[] = [];
  const spawnWorker = (env: NodeJS.ProcessEnv) => {
    const index = calls.length;
    calls.push(env);
    const kind = results[index] ?? "fail";
    let closed = false;
    let finish: (code: number | null) => void = () => {};
    const done = new Promise<number | null>((resolve) => { finish = resolve; });
    const report = kind === "ok"
      ? okReport(portOf(env), candidate)
      : { ok: false, reason: "fail" as const, port: portOf(env), driver: "postgres" as const, init: "off" as const, query: "off" as const, attempt: 1 as const };
    const child = {
      pid: 0,
      checkGroup: false,
      stdout: kind === "hang" || kind === "stuck" ? "" : JSON.stringify(report),
      settled: () => closed,
      done,
      kill(signal: NodeJS.Signals) {
        if (kind === "stuck") return;
        if (signal === "SIGTERM" || signal === "SIGKILL") {
          closed = true;
          finish(1);
        }
      },
    };
    if (kind !== "hang" && kind !== "stuck") queueMicrotask(() => { closed = true; finish(kind === "ok" ? 0 : 1); });
    return child;
  };
  return { calls, spawnWorker };
}

test("production mode rewrites only 6543 and rejects other ports and query overrides", () => {
  const secret = "secret-not-prod";
  const rewritten = verifierDatabaseUrl(`postgresql://app:${secret}@pooler.internal:6543/garden?sslmode=require`, "production");
  assert.equal(rewritten.port, 5432);
  assert.equal(rewritten.url, `postgresql://app:${secret}@pooler.internal:5432/garden?sslmode=require`);
  assert.throws(() => verifierDatabaseUrl(LOCAL_URL, "production"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl("postgresql://app@pooler.internal:5432/garden", "production"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl(`${PRODUCTION_URL}?port=1`, "production"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl(`${PRODUCTION_URL}?host=other.internal`, "production"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl("", "production"), /missing-url/);
  assert.throws(() => verifierDatabaseUrl("https://example", "production"), /bad-url/);
});

test("local mode is explicit and cannot select the production ports", () => {
  const local = verifierDatabaseUrl(LOCAL_URL, "local");
  assert.equal(local.port, 54332);
  assert.equal(local.url, LOCAL_URL);
  assert.throws(() => verifierDatabaseUrl(PRODUCTION_URL, "local"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl("postgresql://app@pooler.internal:5432/garden", "local"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl(`${LOCAL_URL}?port=6543`, "local"), /bad-url/);
  assert.throws(() => verifierDatabaseUrl(`${LOCAL_URL}?host=pooler.internal`, "local"), /bad-url/);
});

test("missing URL and a flag that is not true spawn nothing", async () => {
  const missing = await runBuildRoHarness({
    mode: "production",
    databaseUrl: "",
    flag: "true",
    candidate: HEAD,
    spawnWorker: () => { throw new Error("spawned"); },
  });
  assert.equal(missing.reason, "missing-url");
  assert.equal(missing.attempts, 0);
  const off = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "false",
    candidate: HEAD,
    spawnWorker: () => { throw new Error("spawned"); },
  });
  assert.equal(off.reason, "flag");
  assert.equal(off.attempts, 0);
});

test("production mode keeps the locked limits and ignores caller overrides", async () => {
  const script = scripted(["ok", "ok", "ok", "ok"]);
  const result = await runBuildRoHarness({
    mode: "production",
    databaseUrl: PRODUCTION_URL,
    flag: "true",
    candidate: HEAD,
    spawnWorker: script.spawnWorker,
    limits: { workers: 9, maxConnections: 99, connectionTimeoutMs: 1, queryTimeoutMs: 1, workerTimeoutMs: 1, parentTimeoutMs: 1, killGraceMs: 1 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 4);
  assert.equal(result.failures, 0);
  assert.equal(result.port, 5432);
  assert.equal(script.calls.length, 4);
  assert.equal(script.calls[0]?.PG_POOL_MAX, "1");
  assert.equal(script.calls[0]?.SG_BUILD_READ_ONLY, "true");
  assert.equal(script.calls[0]?.SG_BUILD_DB_CONNECT_TIMEOUT_MS, "5000");
  assert.equal(script.calls[0]?.SG_BUILD_DB_QUERY_TIMEOUT_MS, "5000");
  assert.equal(script.calls[0]?.BUILD_RO_PORT, undefined);
  assert.equal(script.calls[0]?.BUILD_RO_CANDIDATE, undefined);
  assert.equal(script.calls[0]?.BUILD_RO_EXPECT_SHA, HEAD);
  assert.equal(script.calls[0]?.DATABASE_URL?.includes(":5432/"), true);
  assert.equal(script.calls[0]?.DATABASE_URL?.includes(":6543"), false);
  assert.equal(result.reports.every((report) => report.candidate === HEAD && report.flag === true && report.port === 5432 && report.backendPort === 16001 && report.init === "on" && report.query === "on" && report.driver === "postgres"), true);
  assert.deepEqual(resolveHarnessLimits("production", { workers: 9, maxConnections: 99, connectionTimeoutMs: 1, queryTimeoutMs: 1, workerTimeoutMs: 1, parentTimeoutMs: 1, killGraceMs: 1 }), HARNESS_LIMITS);
});

test("an unapproved checkout spawns nothing and opens no pool", async () => {
  let calls = 0;
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: OLD,
    spawnWorker: () => { calls += 1; throw new Error("spawned"); },
  });
  assert.equal(calls, 0);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "sha");
  assert.equal(result.attempts, 0);
  assert.equal(result.reports.length, 0);
  const other = await runBuildRoHarness({
    mode: "production",
    databaseUrl: PRODUCTION_URL,
    flag: "true",
    candidate: OTHER,
    spawnWorker: () => { calls += 1; throw new Error("spawned"); },
  });
  assert.equal(calls, 0);
  assert.equal(other.attempts, 0);
  assert.equal(other.reason, "sha");
});

test("a reported port that is not the rewritten port fails closed", async () => {
  const spawnWorker = () => {
    let closed = false;
    let finish: (code: number | null) => void = () => {};
    const done = new Promise<number | null>((resolve) => { finish = resolve; });
    queueMicrotask(() => { closed = true; finish(0); });
    return {
      pid: 0,
      checkGroup: false,
      stdout: JSON.stringify(okReport(6543)),
      settled: () => closed,
      done,
      kill() { closed = true; finish(1); },
    };
  };
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    spawnWorker,
    limits: { workerTimeoutMs: 1000, parentTimeoutMs: 1000, killGraceMs: 10 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "port");
  assert.equal(result.attempts, 2);
});

test("the first failed attempt stops the wave and does not start replacements", async () => {
  const script = scripted(["fail", "hang", "ok", "ok"]);
  const started = Date.now();
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    spawnWorker: script.spawnWorker,
    limits: { workerTimeoutMs: 1000, parentTimeoutMs: 1000, killGraceMs: 10 },
  });
  assert.equal(result.ok, false);
  assert.equal(script.calls.length, 2);
  assert.equal(result.attempts, 2);
  assert.ok(result.failures >= 1);
  assert.ok(Date.now() - started < 500);
});

test("a worker timeout is killed and counted once", async () => {
  const script = scripted(["hang", "hang"]);
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    spawnWorker: script.spawnWorker,
    limits: { workerTimeoutMs: 30, parentTimeoutMs: 500, killGraceMs: 10 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason === "timeout" || result.reason === "fail", true);
  assert.equal(script.calls.length, 2);
  assert.equal(result.attempts, 2);
});

test("an unconfirmed exit fails and does not start the replacement wave", async () => {
  const script = scripted(["stuck", "stuck", "ok", "ok"]);
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    spawnWorker: script.spawnWorker,
    limits: { workerTimeoutMs: 30, parentTimeoutMs: 2000, killGraceMs: 20 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "cleanup");
  assert.equal(result.attempts, 2);
  assert.equal(script.calls.length, 2);
});

test("the parent timer kills a TERM-resistant child and does not continue", async () => {
  const pids: number[] = [];
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    limits: { workerTimeoutMs: 5_000, parentTimeoutMs: 300, killGraceMs: 200 },
    spawnWorker: () => {
      const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], {
        detached: true,
        stdio: "ignore",
      });
      pids.push(child.pid ?? 0);
      return track(child);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "timeout");
  assert.equal(result.attempts, 2);
  for (const pid of pids) assert.throws(() => process.kill(pid, 0));
});

test("a leader exit cannot leave a live descendant", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sg-ro-reap-"));
  const files: string[] = [];
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    limits: { workers: 1, workerTimeoutMs: 2_000, parentTimeoutMs: 5_000, killGraceMs: 200 },
    spawnWorker: () => {
      const file = join(dir, `grand-${files.length}`);
      files.push(file);
      const child = spawn(process.execPath, ["-e", `
        const { spawn } = require("child_process");
        const fs = require("fs");
        const grand = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: "ignore" });
        fs.writeFileSync(process.env.PIDFILE, String(grand.pid));
        setTimeout(() => process.exit(0), 100);
      `], {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, PIDFILE: file },
      });
      return track(child);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1);
  assert.notEqual(result.reason, "ok");
  for (const file of files) {
    const pid = Number(readFileSync(file, "utf8").trim());
    assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0));
  }
});

test("a valid success report with a live descendant fails and does not continue", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sg-ro-success-desc-"));
  const files: string[] = [];
  const result = await runBuildRoHarness({
    mode: "local",
    databaseUrl: LOCAL_URL,
    flag: "true",
    candidate: HEAD,
    limits: { workers: 2, workerTimeoutMs: 2_000, parentTimeoutMs: 5_000, killGraceMs: 200 },
    spawnWorker: () => {
      const file = join(dir, `grand-${files.length}`);
      files.push(file);
      const report = JSON.stringify(okReport(54332, HEAD));
      const child = spawn(process.execPath, ["-e", `
        const { spawn } = require("child_process");
        const fs = require("fs");
        const grand = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: "ignore" });
        fs.writeFileSync(process.env.PIDFILE, String(grand.pid));
        process.stdout.write(process.env.REPORT + "\\n");
        setTimeout(() => process.exit(0), 150);
      `], {
        detached: true,
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, PIDFILE: file, REPORT: report },
      });
      return track(child);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "cleanup");
  assert.equal(result.attempts, 2);
  assert.equal(files.length, 2);
  for (const file of files) {
    const pid = Number(readFileSync(file, "utf8").trim());
    assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0));
  }
});

function runWorker(env: Record<string, string>): Promise<{ code: number | null; report: Record<string, unknown> }> {
  const child = spawn("pnpm", ["exec", "tsx", "src/db/build-ro-harness-worker.ts"], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
  return new Promise((resolve) => {
    child.on("close", (code) => {
      resolve({ code, report: JSON.parse(stdout.trim() || "{}") as Record<string, unknown> });
    });
  });
}

test("the worker checks the approved sha and the real flag before any connection", async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const listenPort = typeof address === "object" && address ? address.port : 0;
  let connects = 0;
  server.on("connection", (socket) => { connects += 1; socket.destroy(); });
  const url = `postgresql://sg@127.0.0.1:${listenPort}/none`;
  try {
    const wrongSha = await runWorker({
      DATABASE_URL: url,
      SG_BUILD_READ_ONLY: "true",
      BUILD_RO_EXPECT_SHA: OTHER,
      PG_POOL_MAX: "1",
    });
    assert.equal(wrongSha.report.reason, "sha");
    assert.equal(wrongSha.report.candidate, HEAD);
    assert.equal(wrongSha.report.driver, "unknown");
    assert.equal(wrongSha.report.init, "unknown");
    assert.equal(wrongSha.report.query, "unknown");
    assert.notEqual(wrongSha.code, 0);
    assert.equal(connects, 0);
    const wrongFlag = await runWorker({
      DATABASE_URL: url,
      SG_BUILD_READ_ONLY: "1",
      BUILD_RO_EXPECT_SHA: HEAD,
      PG_POOL_MAX: "1",
    });
    assert.equal(wrongFlag.report.reason, "flag");
    assert.equal(wrongFlag.report.flag, false);
    assert.notEqual(wrongFlag.code, 0);
    assert.equal(connects, 0);
  } finally {
    server.close();
  }
});

test("process-group cleanup reaps a descendant after the leader is signaled", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sg-ro-group-"));
  const pidfile = join(dir, "pids");
  const child = spawn(process.execPath, ["-e", `
    const { spawn } = require("child_process");
    const fs = require("fs");
    const grand = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], { stdio: "ignore" });
    fs.writeFileSync(process.env.PIDFILE, process.pid + "\\n" + grand.pid + "\\n");
    setInterval(() => {}, 1000);
  `], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PIDFILE: pidfile },
  });
  const tracked = track(child);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const [parentPid, grandPid] = readFileSync(pidfile, "utf8").trim().split("\n").map(Number);
  tracked.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 50));
  tracked.kill("SIGKILL");
  await tracked.done;
  await new Promise((resolve) => setTimeout(resolve, 50));
  for (const pid of [parentPid, grandPid]) assert.throws(() => process.kill(pid, 0));
});
