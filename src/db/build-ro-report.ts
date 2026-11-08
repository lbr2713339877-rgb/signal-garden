/**
 * Fields a harness worker is allowed to print.
 * A stage is set only at the call that threw. SQLSTATE is copied only from
 * an allowlisted driver code. Error text is never copied.
 */
export const WORKER_STAGES = [
  "import",
  "getDb",
  "connect",
  "init-set",
  "init-show-default",
  "init-show-tx",
  "query",
  "release",
  "close",
] as const;

export type WorkerStage = (typeof WORKER_STAGES)[number];

export type Measured = "on" | "off" | "unknown";

export type KnownDriver = "postgres" | "pglite" | "unknown";

/** PostgreSQL SQLSTATE values this diagnostic is allowed to repeat. */
export const SQLSTATE_ALLOWLIST = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "0A000",
  "22023",
  "25006",
  "28000",
  "28P01",
  "3D000",
  "42501",
  "42601",
  "42P01",
  "53300",
  "57014",
  "57P01",
  "XX000",
]);

const STAGE_SET = new Set<string>(WORKER_STAGES);

export function workerStage(value: unknown): WorkerStage | undefined {
  return typeof value === "string" && STAGE_SET.has(value) ? value as WorkerStage : undefined;
}

export function allowlistedSqlState(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && SQLSTATE_ALLOWLIST.has(code) ? code : undefined;
}

export function stageOnError(err: unknown): WorkerStage | undefined {
  if (!err || typeof err !== "object") return undefined;
  return workerStage((err as { stage?: unknown }).stage);
}

export function measuredOff(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { observed?: unknown }).observed === "off";
}

export function stampStage<T>(err: T, stage: WorkerStage, observed?: "off"): T {
  if (err && typeof err === "object") {
    Object.assign(err as object, observed ? { stage, observed } : { stage });
  }
  return err;
}

export function knownDriver(value: unknown): KnownDriver {
  return value === "postgres" || value === "pglite" ? value : "unknown";
}

export function measured(value: unknown): Measured {
  return value === "on" || value === "off" ? value : "unknown";
}
