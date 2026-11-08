/**
 * Local verifier supervisor. Children call candidate getDb(). The parent
 * does not open a pool.
 *
 * Production mode accepts only a 6543 pooler URL and changes the port to
 * 5432 in memory. Local mode is explicit and rejects those ports. The URL
 * is never logged.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { allowlistedSqlState, knownDriver, measured, workerStage, type KnownDriver, type Measured, type WorkerStage } from "./build-ro-report";

export type HarnessMode = "production" | "local";

export type HarnessLimits = {
  workers: number;
  replacementsPerWorker: number;
  maxConnections: number;
  connectionTimeoutMs: number;
  queryTimeoutMs: number;
  workerTimeoutMs: number;
  parentTimeoutMs: number;
  killGraceMs: number;
};

export function resolveHarnessLimits(mode: HarnessMode, override?: Partial<HarnessLimits>): HarnessLimits {
  if (mode === "production") return { ...HARNESS_LIMITS };
  return { ...HARNESS_LIMITS, ...override };
}

export const HARNESS_LIMITS: HarnessLimits = {
  workers: 2,
  replacementsPerWorker: 1,
  maxConnections: 4,
  connectionTimeoutMs: 5_000,
  queryTimeoutMs: 5_000,
  workerTimeoutMs: 10_000,
  parentTimeoutMs: 30_000,
  killGraceMs: 2_000,
};

const PS_BUDGET_MS = 1_000;

export type SafeWorkerReport = {
  ok: boolean;
  reason: "ok" | "missing-url" | "flag" | "driver" | "init-off" | "port" | "sha" | "timeout" | "fail";
  candidate?: string;
  flag?: boolean;
  urlNonempty?: boolean;
  /** Frontend port from pg connectionParameters. Not inet_server_port. */
  port?: number;
  /** Backend inet_server_port, informational. Not a pass/fail check. */
  backendPort?: number;
  driver?: KnownDriver;
  init?: Measured;
  query?: Measured;
  stage?: WorkerStage;
  sqlstate?: string;
  attempt?: number;
};

export type HarnessResult = {
  ok: boolean;
  reason: SafeWorkerReport["reason"] | "budget" | "cleanup";
  attempts: number;
  failures: number;
  port?: number;
  reports: SafeWorkerReport[];
};

type Spawned = {
  pid: number;
  stdout: string;
  checkGroup?: boolean;
  settled: () => boolean;
  done: Promise<number | null>;
  kill: (signal: NodeJS.Signals) => void;
};

function coded(message: string, code: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

function queryOverrides(rest: string): boolean {
  const query = rest.indexOf("?");
  if (query === -1) return false;
  for (const key of new URLSearchParams(rest.slice(query + 1)).keys()) {
    const name = key.toLowerCase();
    if (name === "host" || name === "port") return true;
  }
  return false;
}

export function verifierDatabaseUrl(raw: string | undefined, mode: HarnessMode): { url: string; port: number } {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) throw coded("missing-url", "missing-url");
  const protocol = trimmed.split(":", 1)[0]?.toLowerCase();
  if (protocol !== "postgres" && protocol !== "postgresql") throw coded("bad-url", "bad-url");
  const match = trimmed.match(/^(postgres(?:ql)?:\/\/)([^/?#]*)(.*)$/i);
  if (!match) throw coded("bad-url", "bad-url");
  const [, scheme, authority, rest] = match;
  if (queryOverrides(rest)) throw coded("bad-url", "bad-url");
  const at = authority.lastIndexOf("@");
  const hostport = at === -1 ? authority : authority.slice(at + 1);
  const hostMatch = hostport.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!hostMatch) throw coded("bad-url", "bad-url");
  const sourcePort = hostMatch[2] ? Number(hostMatch[2]) : 5432;
  if (mode === "local") {
    if (sourcePort === 6543 || sourcePort === 5432) throw coded("bad-url", "bad-url");
    return { url: trimmed, port: sourcePort };
  }
  if (sourcePort !== 6543) throw coded("bad-url", "bad-url");
  const prefix = at === -1 ? "" : authority.slice(0, at + 1);
  return { url: `${scheme}${prefix}${hostMatch[1]}:5432${rest}`, port: 5432 };
}

export function actualCheckoutSha(): string {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: PS_BUDGET_MS,
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw coded("sha", "sha");
  return sha;
}

function safeReport(stdout: string): SafeWorkerReport {
  const line = stdout.trim().split("\n").filter(Boolean).at(-1) ?? "";
  try {
    const parsed = JSON.parse(line) as SafeWorkerReport;
    return {
      ok: parsed.ok === true,
      reason: parsed.reason ?? "fail",
      candidate: typeof parsed.candidate === "string" && /^[0-9a-f]{40}$/.test(parsed.candidate) ? parsed.candidate : undefined,
      flag: parsed.flag === true ? true : parsed.flag === false ? false : undefined,
      urlNonempty: parsed.urlNonempty === true ? true : parsed.urlNonempty === false ? false : undefined,
      port: Number.isInteger(parsed.port) ? parsed.port : undefined,
      backendPort: Number.isInteger(parsed.backendPort) ? parsed.backendPort : undefined,
      driver: parsed.driver === undefined ? undefined : knownDriver(parsed.driver),
      init: parsed.init === undefined ? undefined : measured(parsed.init),
      query: parsed.query === undefined ? undefined : measured(parsed.query),
      stage: workerStage(parsed.stage),
      sqlstate: allowlistedSqlState({ code: parsed.sqlstate }),
      attempt: parsed.attempt === 1 ? 1 : undefined,
    };
  } catch {
    return { ok: false, reason: "fail" };
  }
}

function accepted(report: SafeWorkerReport, expected: { candidate: string; port: number }): boolean {
  return report.ok
    && report.reason === "ok"
    && report.candidate === expected.candidate
    && report.flag === true
    && report.urlNonempty === true
    && report.port === expected.port
    && report.driver === "postgres"
    && report.init === "on"
    && report.query === "on"
    && report.attempt === 1;
}

function outcome(report: SafeWorkerReport, expected: { candidate: string; port: number }): SafeWorkerReport["reason"] {
  if (accepted(report, expected)) return "ok";
  if (report.candidate && report.candidate !== expected.candidate) return "sha";
  if (report.port !== undefined && report.port !== expected.port) return "port";
  if (report.flag === false) return "flag";
  return report.reason === "ok" ? "fail" : report.reason;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBuildRoHarness(input: {
  databaseUrl: string | undefined;
  flag: string | undefined;
  candidate: string;
  mode: HarnessMode;
  spawnWorker?: (env: NodeJS.ProcessEnv) => Spawned;
  limits?: Partial<HarnessLimits>;
}): Promise<HarnessResult> {
  const limits = resolveHarnessLimits(input.mode, input.limits);
  if (input.flag !== "true") return { ok: false, reason: "flag", attempts: 0, failures: 1, reports: [] };
  let head = "";
  try {
    head = actualCheckoutSha();
  } catch {
    return { ok: false, reason: "sha", attempts: 0, failures: 1, reports: [] };
  }
  if (input.candidate !== head) return { ok: false, reason: "sha", attempts: 0, failures: 1, reports: [] };
  let rewritten: { url: string; port: number };
  try {
    rewritten = verifierDatabaseUrl(input.databaseUrl, input.mode);
  } catch (err) {
    const reason = (err as { code?: string }).code === "missing-url" ? "missing-url" : "fail";
    return { ok: false, reason, attempts: 0, failures: 1, reports: [] };
  }

  const reports: SafeWorkerReport[] = [];
  const tracked: Spawned[] = [];
  let attempts = 0;
  let failures = 0;
  let unclean = false;
  let timedOut = false;
  const expected = { candidate: head, port: rewritten.port };
  const spawnOne = input.spawnWorker ?? ((env) => defaultSpawn(env));
  const startedAt = Date.now();
  const deadlineAt = startedAt + limits.parentTimeoutMs + limits.killGraceMs + PS_BUDGET_MS;
  const remaining = () => Math.max(0, deadlineAt - Date.now());

  async function boundedDelay(ms: number): Promise<void> {
    const wait = Math.min(Math.max(0, ms), remaining());
    if (wait === 0) return;
    await delay(wait);
  }

  function groupAlive(child: Spawned): boolean {
    if (!child.checkGroup || !child.pid || child.pid <= 0) return false;
    const budget = Math.min(PS_BUDGET_MS, remaining());
    if (budget < 50) return true;
    try {
      const out = execFileSync("ps", ["-o", "pid=", "-g", String(child.pid)], {
        encoding: "utf8",
        timeout: budget,
        killSignal: "SIGKILL",
      });
      return out.split(/\s+/).some((part) => Number(part) > 0);
    } catch (err) {
      return (err as { status?: number }).status !== 1;
    }
  }

  function groupsClear(): boolean {
    return tracked.every((child) => !groupAlive(child));
  }

  let cleanupPromise: Promise<boolean> | null = null;
  function beginCleanup(): Promise<boolean> {
    if (!cleanupPromise) {
      cleanupPromise = (async () => {
        for (const child of tracked) child.kill("SIGTERM");
        await boundedDelay(limits.killGraceMs);
        for (const child of tracked) child.kill("SIGKILL");
        await Promise.race([
          Promise.all(tracked.map((child) => child.done.catch(() => null))),
          boundedDelay(limits.killGraceMs),
        ]);
        return tracked.every((child) => child.settled() && !groupAlive(child));
      })();
    }
    return cleanupPromise;
  }

  async function wave(count: number): Promise<boolean> {
    if (unclean || cleanupPromise || attempts + count > limits.maxConnections) {
      failures += 1;
      return false;
    }
    const children: Spawned[] = [];
    for (let i = 0; i < count; i += 1) {
      attempts += 1;
      const child = spawnOne(workerEnv(rewritten.url, head, limits));
      tracked.push(child);
      children.push(child);
    }
    let failed = false;
    const counted = new Set<Spawned>();
    await new Promise<void>((resolve) => {
      let pending = children.length;
      const finished = new Set<Spawned>();
      const timers: NodeJS.Timeout[] = [];
      let settledWave = false;
      let cap: NodeJS.Timeout | undefined;
      const resolveOnce = () => {
        if (settledWave) return;
        settledWave = true;
        clearTimeout(cap);
        for (const timer of timers) clearTimeout(timer);
        resolve();
      };
      const finish = (child: Spawned) => {
        if (finished.has(child)) return;
        finished.add(child);
        pending -= 1;
        if (pending === 0) resolveOnce();
      };
      const mark = (child: Spawned) => {
        if (counted.has(child)) return;
        counted.add(child);
        failed = true;
        failures += 1;
        void beginCleanup().then(() => resolveOnce());
      };
      cap = setTimeout(() => {
        failed = true;
        failures += 1;
        void beginCleanup().then(() => resolveOnce());
      }, Math.max(0, deadlineAt - Date.now()));
      for (const child of children) {
        const timer = setTimeout(() => mark(child), Math.min(limits.workerTimeoutMs, Math.max(0, deadlineAt - Date.now())));
        timers.push(timer);
        child.done.then((code) => {
          clearTimeout(timer);
          const report = safeReport(child.stdout);
          reports.push(report);
          if (code !== 0 || !accepted(report, expected)) mark(child);
          finish(child);
        }).catch(() => {
          clearTimeout(timer);
          mark(child);
          finish(child);
        });
      }
    });
    if (failed || timedOut) {
      const clean = await beginCleanup();
      if (!clean) unclean = true;
      return false;
    }
    if (!groupsClear()) {
      unclean = true;
      const clean = await beginCleanup();
      if (!clean) unclean = true;
      return false;
    }
    return true;
  }

  function result(ok: boolean): HarnessResult {
    return {
      ok,
      reason: unclean ? "cleanup" : timedOut ? "timeout" : ok ? "ok" : reports.map((report) => outcome(report, expected)).find((reason) => reason !== "ok") ?? "fail",
      attempts,
      failures: ok ? failures : Math.max(failures, 1),
      port: rewritten.port,
      reports,
    };
  }

  const parentTimer = setTimeout(() => {
    timedOut = true;
    void beginCleanup();
  }, Math.min(limits.parentTimeoutMs, Math.max(0, deadlineAt - Date.now())));

  const first = await wave(limits.workers);
  if (!first || timedOut || unclean || !groupsClear()) {
    if (!groupsClear()) unclean = true;
    clearTimeout(parentTimer);
    const clean = await beginCleanup();
    if (!clean) unclean = true;
    return result(false);
  }
  const second = await wave(limits.workers);
  clearTimeout(parentTimer);
  if (!second || timedOut || unclean || !groupsClear()) {
    if (!groupsClear()) unclean = true;
    const clean = await beginCleanup();
    if (!clean) unclean = true;
    return result(false);
  }
  if (timedOut || !groupsClear()) {
    if (!groupsClear()) unclean = true;
    const clean = await beginCleanup();
    if (!clean) unclean = true;
    return result(false);
  }
  return result(true);
}

function workerEnv(url: string, approvedSha: string, limits: HarnessLimits): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: url,
    SG_BUILD_READ_ONLY: "true",
    BUILD_RO_EXPECT_SHA: approvedSha,
    PG_POOL_MAX: "1",
    SG_BUILD_DB_CONNECT_TIMEOUT_MS: String(limits.connectionTimeoutMs),
    SG_BUILD_DB_QUERY_TIMEOUT_MS: String(limits.queryTimeoutMs),
  };
}

function defaultSpawn(env: NodeJS.ProcessEnv): Spawned {
  const child = spawn("pnpm", ["exec", "tsx", "src/db/build-ro-harness-worker.ts"], {
    cwd: process.cwd(),
    detached: true,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return track(child);
}

export function track(child: ChildProcess): Spawned {
  let stdout = "";
  let settled = false;
  child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr?.on("data", () => {});
  const done = new Promise<number | null>((resolve) => {
    child.on("error", () => { settled = true; resolve(1); });
    child.on("close", (code) => { settled = true; resolve(code); });
  });
  const pid = child.pid ?? 0;
  return {
    pid,
    get stdout() { return stdout; },
    checkGroup: true,
    settled: () => settled,
    done,
    kill(signal) {
      if (!pid) return;
      try { process.kill(-pid, signal); } catch { try { process.kill(pid, signal); } catch { /* already gone */ } }
    },
  };
}
