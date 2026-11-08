/**
 * Local verifier supervisor. It calls the candidate getDb through a child
 * process. It does not open its own pool.
 *
 * A 6543 pooler URL is copied in memory and only the port becomes 5432.
 * That port is a verifier override, not a separate host. The URL is never logged.
 */
import { spawn, type ChildProcess } from "node:child_process";

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
  reason: "ok" | "missing-url" | "flag" | "driver" | "init-off" | "timeout" | "fail";
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
  done: Promise<number | null>;
  kill: (signal: NodeJS.Signals) => void;
};

export function verifierDatabaseUrl(raw: string | undefined): { url: string; port: number } {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    const error = new Error("missing-url");
    (error as Error & { code: string }).code = "missing-url";
    throw error;
  }
  const protocol = trimmed.split(":", 1)[0]?.toLowerCase();
  if (protocol !== "postgres" && protocol !== "postgresql") {
    const error = new Error("bad-url");
    (error as Error & { code: string }).code = "bad-url";
    throw error;
  }
  const match = trimmed.match(/^(postgres(?:ql)?:\/\/)([^/?#]*)(.*)$/i);
  if (!match) {
    const error = new Error("bad-url");
    (error as Error & { code: string }).code = "bad-url";
    throw error;
  }
  const [, scheme, authority, rest] = match;
  const at = authority.lastIndexOf("@");
  const hostport = at === -1 ? authority : authority.slice(at + 1);
  const hostMatch = hostport.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
  if (!hostMatch) {
    const error = new Error("bad-url");
    (error as Error & { code: string }).code = "bad-url";
    throw error;
  }
  const sourcePort = hostMatch[2] ? Number(hostMatch[2]) : 5432;
  if (sourcePort !== 6543) return { url: trimmed, port: sourcePort };
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

export async function runBuildRoHarness(input: {
  databaseUrl: string | undefined;
  flag: string | undefined;
  candidate: string;
  spawnWorker?: (env: NodeJS.ProcessEnv) => Spawned;
  limits?: Partial<HarnessLimits>;
}): Promise<HarnessResult> {
  const limits = { ...HARNESS_LIMITS, ...input.limits };
  if (input.flag !== "true") return { ok: false, reason: "flag", attempts: 0, failures: 1, reports: [] };
  let rewritten: { url: string; port: number };
  try {
    rewritten = verifierDatabaseUrl(input.databaseUrl);
  } catch (err) {
    const reason = (err as { code?: string }).code === "missing-url" ? "missing-url" : "fail";
    return { ok: false, reason, attempts: 0, failures: 1, reports: [] };
  }

  const reports: SafeWorkerReport[] = [];
  let attempts = 0;
  let failures = 0;
  const live = new Set<Spawned>();

  const spawnOne = input.spawnWorker ?? ((env) => defaultSpawn(env));

  async function stopAll(graceMs: number) {
    for (const child of live) child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, graceMs));
    for (const child of live) child.kill("SIGKILL");
    await Promise.all([...live].map((child) => child.done.catch(() => null)));
    live.clear();
  }

  async function wave(count: number): Promise<boolean> {
    if (attempts + count > limits.maxConnections) {
      failures += 1;
      return false;
    }
    const children: Spawned[] = [];
    for (let i = 0; i < count; i += 1) {
      attempts += 1;
      const child = spawnOne(workerEnv(rewritten.url, rewritten.port, input.candidate, limits));
      live.add(child);
      children.push(child);
    }
    let failed = false;
    const counted = new Set<Spawned>();
    await new Promise<void>((resolve) => {
      let pending = children.length;
      const finish = () => {
        pending -= 1;
        if (pending === 0) resolve();
      };
      const mark = (child: Spawned) => {
        if (counted.has(child)) return;
        counted.add(child);
        failed = true;
        failures += 1;
        for (const other of children) other.kill("SIGTERM");
        setTimeout(() => {
          for (const other of children) other.kill("SIGKILL");
        }, limits.killGraceMs);
      };
      for (const child of children) {
        const timer = setTimeout(() => mark(child), limits.workerTimeoutMs);
        child.done.then((code) => {
          clearTimeout(timer);
          live.delete(child);
          const report = safeReport(child.stdout);
          reports.push(report);
          if (code !== 0 || !report.ok || report.driver !== "postgres" || report.init !== "on" || report.query !== "on") mark(child);
          finish();
        }).catch(() => {
          clearTimeout(timer);
          mark(child);
          finish();
        });
      }
    });
    if (failed) {
      await stopAll(limits.killGraceMs);
      return false;
    }
    return true;
  }

  let timedOut = false;
  const parentTimer = setTimeout(() => {
    timedOut = true;
    void stopAll(limits.killGraceMs);
  }, limits.parentTimeoutMs);

  const first = await wave(limits.workers);
  const second = first ? await wave(limits.workers * limits.replacementsPerWorker) : false;
  clearTimeout(parentTimer);
  if (timedOut) return { ok: false, reason: "timeout", attempts, failures: Math.max(failures, 1), port: rewritten.port, reports };
  if (attempts > limits.maxConnections) return { ok: false, reason: "budget", attempts, failures, port: rewritten.port, reports };
  return {
    ok: first && second && failures === 0,
    reason: first && second ? "ok" : reports.find((report) => !report.ok)?.reason ?? "fail",
    attempts,
    failures,
    port: rewritten.port,
    reports,
  };
}

function workerEnv(url: string, port: number, candidate: string, limits: HarnessLimits): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: url,
    SG_BUILD_READ_ONLY: "true",
    PG_POOL_MAX: "1",
    SG_BUILD_DB_CONNECT_TIMEOUT_MS: String(limits.connectionTimeoutMs),
    SG_BUILD_DB_QUERY_TIMEOUT_MS: String(limits.queryTimeoutMs),
    BUILD_RO_CANDIDATE: candidate,
    BUILD_RO_PORT: String(port),
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
  child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr?.on("data", () => {});
  const done = new Promise<number | null>((resolve) => {
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code));
  });
  const pid = child.pid ?? 0;
  return {
    pid,
    get stdout() { return stdout; },
    done,
    kill(signal) {
      if (!pid) return;
      try { process.kill(-pid, signal); } catch { try { process.kill(pid, signal); } catch { /* already gone */ } }
    },
  };
}
