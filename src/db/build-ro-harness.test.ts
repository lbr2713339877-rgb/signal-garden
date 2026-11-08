import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeFileSync, readFileSync } from "node:fs";
import { runBuildRoHarness, track, verifierDatabaseUrl, type SafeWorkerReport } from "./build-ro-harness";

const CANDIDATE = "e3d878d922fb0654222987497d02a8b3df956d25";

function okReport(port: number): SafeWorkerReport {
  return { ok: true, reason: "ok", candidate: CANDIDATE, flag: true, urlNonempty: true, port, driver: "postgres", init: "on", query: "on", attempt: 1 };
}

function scripted(results: Array<"ok" | "fail" | "hang">) {
  const calls: NodeJS.ProcessEnv[] = [];
  const spawned: Array<{ pid: number; kill: (signal: NodeJS.Signals) => void }> = [];
  const spawnWorker = (env: NodeJS.ProcessEnv) => {
    const index = calls.length;
    calls.push(env);
    const kind = results[index] ?? "fail";
    let finish: (code: number | null) => void = () => {};
    const done = new Promise<number | null>((resolve) => { finish = resolve; });
    const report = kind === "ok" ? okReport(Number(env.BUILD_RO_PORT)) : { ok: false, reason: "fail" as const, port: Number(env.BUILD_RO_PORT), driver: "postgres" as const, init: "off" as const, query: "off" as const, attempt: 1 as const };
    const child = {
      pid: 1000 + index,
      stdout: kind === "hang" ? "" : JSON.stringify(report),
      done,
      kill(signal: NodeJS.Signals) {
        if (signal === "SIGTERM" || signal === "SIGKILL") finish(1);
      },
    };
    spawned.push(child);
    if (kind !== "hang") queueMicrotask(() => finish(kind === "ok" ? 0 : 1));
    return child;
  };
  return { calls, spawned, spawnWorker };
}

test("6543 is rewritten in memory and other ports stay", () => {
  const secret = "secret-not-prod";
  const rewritten = verifierDatabaseUrl(`postgresql://app:${secret}@pooler.internal:6543/garden?sslmode=require`);
  assert.equal(rewritten.port, 5432);
  assert.equal(rewritten.url, `postgresql://app:${secret}@pooler.internal:5432/garden?sslmode=require`);
  const local = verifierDatabaseUrl("postgresql://sg@127.0.0.1:54332/local");
  assert.equal(local.port, 54332);
  assert.equal(local.url, "postgresql://sg@127.0.0.1:54332/local");
  assert.throws(() => verifierDatabaseUrl(""), /missing-url/);
  assert.throws(() => verifierDatabaseUrl("https://example"), /bad-url/);
});

test("missing URL and a flag that is not true spawn nothing", async () => {
  const missing = await runBuildRoHarness({ databaseUrl: "", flag: "true", candidate: CANDIDATE, spawnWorker: () => { throw new Error("spawned"); } });
  assert.equal(missing.reason, "missing-url");
  assert.equal(missing.attempts, 0);
  const off = await runBuildRoHarness({ databaseUrl: "postgresql://sg@127.0.0.1:54332/local", flag: "false", candidate: CANDIDATE, spawnWorker: () => { throw new Error("spawned"); } });
  assert.equal(off.reason, "flag");
  assert.equal(off.attempts, 0);
});

test("both initial successes are required before one replacement wave, and the budget stays at 4", async () => {
  const script = scripted(["ok", "ok", "ok", "ok"]);
  const result = await runBuildRoHarness({
    databaseUrl: "postgresql://app:secret-not-prod@pooler.internal:6543/garden",
    flag: "true",
    candidate: CANDIDATE,
    spawnWorker: script.spawnWorker,
    limits: { workerTimeoutMs: 1000, parentTimeoutMs: 1000, killGraceMs: 10 },
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
  assert.equal(script.calls[0]?.BUILD_RO_PORT, "5432");
  assert.equal(script.calls[0]?.DATABASE_URL?.includes(":5432/"), true);
  assert.equal(script.calls[0]?.DATABASE_URL?.includes(":6543"), false);
  assert.equal(result.reports.every((report) => report.init === "on" && report.query === "on" && report.driver === "postgres"), true);
});

test("the first failed attempt stops the wave and does not start replacements", async () => {
  const script = scripted(["fail", "hang", "ok", "ok"]);
  const result = await runBuildRoHarness({
    databaseUrl: "postgresql://sg@127.0.0.1:54332/local",
    flag: "true",
    candidate: CANDIDATE,
    spawnWorker: script.spawnWorker,
    limits: { workerTimeoutMs: 1000, parentTimeoutMs: 1000, killGraceMs: 10 },
  });
  assert.equal(result.ok, false);
  assert.equal(script.calls.length, 2);
  assert.equal(result.attempts, 2);
  assert.ok(result.failures >= 1);
});

test("a worker timeout is killed and counted once", async () => {
  const script = scripted(["hang", "hang"]);
  const result = await runBuildRoHarness({
    databaseUrl: "postgresql://sg@127.0.0.1:54332/local",
    flag: "true",
    candidate: CANDIDATE,
    spawnWorker: script.spawnWorker,
    limits: { workerTimeoutMs: 30, parentTimeoutMs: 500, killGraceMs: 10 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason === "timeout" || result.reason === "fail", true);
  assert.equal(script.calls.length, 2);
  assert.equal(result.attempts, 2);
});

test("parent timeout terminates a descendant and the pids are reaped", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sg-ro-reap-"));
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
  for (const pid of [parentPid, grandPid]) {
    assert.throws(() => process.kill(pid, 0));
  }
});
