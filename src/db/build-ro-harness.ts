/**
 * Local verifier supervisor. Children call candidate getDb(). The parent
 * does not open a pool.
 *
 * Production mode accepts only a 6543 pooler URL and changes the port to
 * 5432 in memory. Local mode is explicit and rejects those ports. The URL
 * is never logged.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";

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

export type SafeWorkerReport = {
  ok: boolean;
  reason: "ok" | "missing-url" | "flag" | "driver" | "init-off" | "port" | "sha" | "timeout" | "fail";
  candidate?: string;
  flag?: boolean;
  urlNonempty?: boolean;
  port?: number;
  driver?: "postgres" | "pglite" | "none";
  init?: "on" | "off";
  query?: "on" | "off";
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
      driver: parsed.driver === "postgres" || parsed.driver === "pglite" || parsed.driver === "none" ? parsed.driver : undefined,
      init: parsed.init === "on" || parsed.init === "off" ? parsed.init : undefined,
      query: parsed.query === "on" || parsed.query === "off" ? parsed.query : undefined,
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

function groupAlive(child: Spawned): boolean {
  if (!child.checkGroup || !child.pid || child.pid <= 0) return false;
  try {
    const out = execFileSync("ps", ["-o", "pid=", "-g", String(child.pid)], { encoding: "utf8", timeout: 1000 });
    return out.split(/\s+/).some((part) => Number(part) > 0);
  } catch (err) {
    return (err as { status?: number }).status !== 1;
  }
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
  const expected = { candidate: input.candidate, port: rewritten.port };
  const spawnOne = input.spawnWorker ?? ((env) => defaultSpawn(env));

  async function stopAll(): Promise<boolean> {
    const pending = () => tracked.filter((child) => !child.settled() || groupAlive(child));
    if (pending().length === 0) return true;
    for (const child of pending()) child.kill("SIGTERM");
    await delay(limits.killGraceMs);
    for (const child of pending()) child.kill("SIGKILL");
    await Promise.race([
      Promise.all(pending().map((child) => child.done.catch(() => null))),
      delay(limits.killGraceMs),
    ]);
    return pending().length === 0;
  }

  async function wave(count: number): Promise<boolean> {
    if (unclean || attempts + count > limits.maxConnections) {
      failures += 1;
      return false;
    }
    const children: Spawned[] = [];
    for (let i = 0; i < count; i += 1) {
      attempts += 1;
      const child = spawnOne(workerEnv(rewritten.url, limits));
      tracked.push(child);
      children.push(child);
    }
    let failed = false;
    const counted = new Set<Spawned>();
    await new Promise<void>((resolve) => {
      let pending = children.length;
      const finished = new Set<Spawned>();
      const finish = (child: Spawned) => {
        if (finished.has(child)) return;
        finished.add(child);
        pending -= 1;
        if (pending === 0) resolve();
      };
      const mark = (child: Spawned) => {
        if (counted.has(child)) return;
        counted.add(child);
        failed = true;
        failures += 1;
        for (const other of children) other.kill("SIGTERM");
      };
      for (const child of children) {
        const timer = setTimeout(() => {
          mark(child);
          child.kill("SIGTERM");
        }, limits.workerTimeoutMs);
        const cap = setTimeout(() => finish(child), limits.workerTimeoutMs + limits.killGraceMs);
        child.done.then((code) => {
          clearTimeout(timer);
          clearTimeout(cap);
          const report = safeReport(child.stdout);
          reports.push(report);
          if (code !== 0 || !accepted(report, expected)) mark(child);
          finish(child);
        }).catch(() => {
          clearTimeout(timer);
          clearTimeout(cap);
          mark(child);
          finish(child);
        });
      }
    });
    if (!failed) return true;
    unclean = !(await stopAll());
    return false;
  }

  let timedOut = false;
  const parentTimer = setTimeout(() => {
    timedOut = true;
    void stopAll().then((clean) => { unclean = unclean || !clean; });
  }, limits.parentTimeoutMs);

  const first = await wave(limits.workers);
  if (!first || timedOut || unclean) {
    clearTimeout(parentTimer);
    if (!(await stopAll())) unclean = true;
    return {
      ok: false,
      reason: unclean ? "cleanup" : timedOut ? "timeout" : reports.map((report) => outcome(report, expected)).find((reason) => reason !== "ok") ?? "fail",
      attempts,
      failures: Math.max(failures, 1),
      port: rewritten.port,
      reports,
    };
  }
  const second = await wave(limits.workers);
  clearTimeout(parentTimer);
  if (timedOut || unclean || !second) {
    if (!(await stopAll())) unclean = true;
  }
  return {
    ok: second && failures === 0 && !timedOut && !unclean,
    reason: unclean ? "cleanup" : timedOut ? "timeout" : second ? "ok" : reports.map((report) => outcome(report, expected)).find((reason) => reason !== "ok") ?? "fail",
    attempts,
    failures,
    port: rewritten.port,
    reports,
  };
}

function workerEnv(url: string, limits: HarnessLimits): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: url,
    SG_BUILD_READ_ONLY: "true",
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
