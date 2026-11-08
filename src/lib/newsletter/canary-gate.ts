/**
 * Fail-closed canary delivery gate for the Monday weekly sender.
 *
 * newsletter_send.status `sent` means Resend accepted the message, or the
 * webhook folded `email.delivered` into that same status. Neither one proves
 * delivery. Real recipients are mailed only after a delivery query for this
 * edition's preferred canary returns last_event `delivered`.
 *
 * Fail-closed choices: `sent`, `queued`, `scheduled`, `delivery_delayed`,
 * `opened`, and `clicked` do not open the gate. A missing event, a query
 * error, and a bounded wait all leave real recipients unsent. Another
 * edition's delivery is never consulted. Dry-run does not query, write, or
 * invent a delivered result.
 */
import { weeklyIdempotencyKey, type WeeklyAudienceRow } from "./weekly-lock";

/** Wall-clock budget for one canary delivery wait, including queries and sleeps. */
export const WEEKLY_CANARY_DELIVERY_BUDGET_MS = 30_000;
/** Provider reads in one wait. The loop stops at this count even if time remains. */
export const WEEKLY_CANARY_DELIVERY_MAX_POLLS = 6;
/** Pause between non-terminal reads. Sleeps are capped by the time still left. */
export const WEEKLY_CANARY_DELIVERY_POLL_MS = 5_000;
/** One delivery read is abandoned after this long and treated as a query failure. */
export const WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS = 5_000;

export const WEEKLY_EXIT_MISSING_CANARY = 3;
export const WEEKLY_EXIT_CANARY_API = 4;
export const WEEKLY_EXIT_REAL_FAILED = 5;
export const WEEKLY_EXIT_GATE_CLOSED = 7;

const TERMINAL_NON_DELIVERY = new Set([
  "bounced",
  "failed",
  "complained",
  "canceled",
  "cancelled",
  "suppressed",
]);

/**
 * Provider `last_event` values this process will repeat in logs.
 * Anything else, including overlong or secret-bearing text, is `unknown`.
 * `opened` and `clicked` are known and still do not open the gate.
 */
const KNOWN_PROVIDER_EVENTS = new Set([
  "delivered",
  "sent",
  "queued",
  "scheduled",
  "delivery_delayed",
  "opened",
  "clicked",
  ...TERMINAL_NON_DELIVERY,
]);

export type CanaryProviderClass = "delivered" | "pending" | "terminal";

/** Only an exact delivered event opens the gate. Everything else is pending or terminal. */
export function classifyCanaryProviderEvent(lastEvent: string): CanaryProviderClass {
  const value = lastEvent.trim().toLowerCase();
  if (value === "delivered") return "delivered";
  if (TERMINAL_NON_DELIVERY.has(value)) return "terminal";
  return "pending";
}

/** Allowlisted token, or `unknown`. Never returns the raw provider string. */
export function sanitizeProviderEvent(value: string | null | undefined): string | null {
  if (value == null) return null;
  const token = value.trim().toLowerCase();
  if (!token) return null;
  return KNOWN_PROVIDER_EVENTS.has(token) ? token : "unknown";
}

export function ledgerStatusForTerminalEvent(lastEvent: string): "bounced" | "failed" {
  const value = lastEvent.trim().toLowerCase();
  if (value === "bounced" || value === "complained" || value === "suppressed") return "bounced";
  return "failed";
}

export function maskWeeklyEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, Math.min(3, local.length))}***@${domain}`;
}

export function redactMessageId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= 8) return "…";
  return `${trimmed.slice(0, 2)}…${trimmed.slice(-4)}`;
}

export function redactSensitive(value: string): string {
  const redacted = value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:re|whsec)_[A-Za-z0-9]+/gi, "[redacted-secret]")
    .replace(/bearer\s+[A-Za-z0-9._\-]+/gi, "bearer [redacted-secret]")
    .replace(/[\r\n]+/g, " ");
  return redacted.length > 240 ? `${redacted.slice(0, 240)}…` : redacted;
}

export interface WeeklyEditionSendRow {
  subscriberId: string;
  status: string;
  resendMessageId?: string | null;
}

export type DeliveryQueryResult =
  | { ok: true; lastEvent: string }
  | { ok: false; error: string };

export type WeeklyRecipientSendResult =
  | { ok: true; id: string; skipped?: boolean }
  | { ok: false; error: string; id?: string; held?: boolean };

export type WeeklyGateMode = "canary" | "real" | "all";

export interface WeeklyCanaryPreview {
  deliveredConfirmed: false;
  deliveryProof: "not-queried";
  writes: 0;
  transportSends: 0;
  canaryPresent: boolean;
  canary: string | null;
  canaryLedgerStatus: string | null;
  canaryAccepted: boolean;
  canaryAction:
    | "missing"
    | "would-send"
    | "already-accepted-not-resent"
    | "terminal-blocked"
    | "accepted-id-missing"
    | "not-sent-by-this-mode";
  realAction:
    | "not-this-mode"
    | "held-until-delivered"
    | "blocked-missing-canary"
    | "blocked-terminal-canary"
    | "blocked-accepted-id-missing"
    | "blocked-not-accepted"
    | "plan-noop";
  realRecipientsHeld: number;
  note: string;
}

export interface PollCanaryDeliveryInput {
  messageId: string;
  query: (messageId: string, signal: AbortSignal) => Promise<DeliveryQueryResult>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  maxPolls?: number;
  budgetMs?: number;
  queryTimeoutMs?: number;
}

export type PollCanaryDeliveryResult =
  | { outcome: "delivered"; polls: number; lastEvent: string; elapsedMs: number }
  | { outcome: "terminal"; polls: number; lastEvent: string; elapsedMs: number }
  | { outcome: "timeout"; polls: number; lastEvent: string | null; elapsedMs: number }
  | { outcome: "query-error"; polls: number; error: string; elapsedMs: number; lastEvent: string | null };

export interface ExecuteWeeklyGatedSendInput {
  mode: WeeklyGateMode;
  dryRun: boolean;
  issue: number;
  editionDate: string;
  canary: WeeklyAudienceRow | null;
  /** Extra canaries and real recipients. The preferred canary is not mailed from this list. */
  held: readonly WeeklyAudienceRow[];
  /** `--all` only. Ids still selected by the edition plan. */
  plannedIds?: readonly string[];
  /** Rows for this edition only. */
  ledger: readonly WeeklyEditionSendRow[];
  send: (input: { subscriberId: string; idempotencyKey: string }) => Promise<WeeklyRecipientSendResult>;
  queryDelivery: (messageId: string, signal: AbortSignal) => Promise<DeliveryQueryResult>;
  markTerminal?: (input: { subscriberId: string; status: "bounced" | "failed"; lastEvent: string }) => Promise<void>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  maxPolls?: number;
  budgetMs?: number;
  queryTimeoutMs?: number;
  /** `--all` noop. The gate does not send when the edition plan is not a send. */
  plan?: "send" | "noop";
}

export interface WeeklyGateAttempt {
  subscriberId: string;
  idempotencyKey: string;
  ok: boolean;
  skipped: boolean;
  error?: string;
}

export interface WeeklyGateRunResult {
  exitCode: number;
  reason: string;
  canarySends: number;
  realSends: number;
  failed: number;
  skipped: number;
  polls: number;
  lastEvent: string | null;
  deliveredConfirmed: boolean;
  queriedMessageIds: string[];
  attempts: WeeklyGateAttempt[];
  log: Record<string, unknown>;
}

function usableMessageId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? "";
  if (!id || id === "skipped") return null;
  return id;
}

function ledgerFor(
  rows: readonly WeeklyEditionSendRow[],
  subscriberId: string,
): WeeklyEditionSendRow | undefined {
  return rows.find((row) => row.subscriberId === subscriberId);
}

/** Provider already told us this edition's canary was not delivered. Do not resend it. */
export function canaryLedgerTerminal(row: WeeklyEditionSendRow | undefined): boolean {
  if (!row) return false;
  if (row.status === "bounced") return true;
  return row.status === "failed" && Boolean(usableMessageId(row.resendMessageId));
}

function alreadyMailed(row: WeeklyEditionSendRow | undefined): boolean {
  return row?.status === "sent" || row?.status === "bounced";
}

/** Recipients who may be mailed only after this edition's canary is delivered. */
export function selectGateHeldRecipients(input: {
  mode: WeeklyGateMode;
  canaryId: string | null;
  held: readonly WeeklyAudienceRow[];
  plannedIds?: readonly string[];
  ledger: readonly WeeklyEditionSendRow[];
}): WeeklyAudienceRow[] {
  if (input.mode === "canary") return [];
  const planned = input.mode === "all" ? new Set(input.plannedIds ?? []) : null;
  const targets: WeeklyAudienceRow[] = [];
  for (const row of input.held) {
    if (input.canaryId && row.id === input.canaryId) continue;
    if (planned && !planned.has(row.id)) continue;
    if (alreadyMailed(ledgerFor(input.ledger, row.id))) continue;
    targets.push(row);
  }
  return targets;
}

export function previewWeeklyCanaryGate(input: {
  mode: WeeklyGateMode;
  editionDate: string;
  canary: WeeklyAudienceRow | null;
  heldCount: number;
  ledger: readonly WeeklyEditionSendRow[];
  plan?: "send" | "noop";
}): WeeklyCanaryPreview {
  const row = input.canary ? ledgerFor(input.ledger, input.canary.id) : undefined;
  const accepted = Boolean(usableMessageId(row?.resendMessageId));
  const base = {
    deliveredConfirmed: false as const,
    deliveryProof: "not-queried" as const,
    writes: 0 as const,
    transportSends: 0 as const,
    canaryPresent: Boolean(input.canary),
    canary: input.canary ? maskWeeklyEmail(input.canary.email) : null,
    canaryLedgerStatus: row?.status ?? null,
    canaryAccepted: accepted,
    realRecipientsHeld: input.heldCount,
  };

  if (input.mode === "all" && input.plan === "noop") {
    return {
      ...base,
      canaryAction: "not-sent-by-this-mode",
      realAction: "plan-noop",
      realRecipientsHeld: 0,
      note: "edition plan is noop; no send and no delivery query",
    };
  }

  if (input.mode === "canary") {
    let canaryAction: WeeklyCanaryPreview["canaryAction"] = "would-send";
    if (!input.canary) canaryAction = "missing";
    else if (row?.status === "sent" || row?.status === "bounced" || accepted) canaryAction = "already-accepted-not-resent";
    return {
      ...base,
      canaryAction,
      realAction: "not-this-mode",
      realRecipientsHeld: 0,
      note: "canary mode mails only the preferred canary and does not prove delivery",
    };
  }

  if (!input.canary) {
    return {
      ...base,
      canaryAction: "missing",
      realAction: "blocked-missing-canary",
      note: `no preferred canary for ${input.editionDate}; real recipients stay unsent`,
    };
  }
  if (canaryLedgerTerminal(row)) {
    return {
      ...base,
      canaryAction: "terminal-blocked",
      realAction: "blocked-terminal-canary",
      note: `this edition's canary is ${row?.status}; real recipients stay unsent`,
    };
  }
  if (row?.status === "sent" && !accepted) {
    return {
      ...base,
      canaryAction: "accepted-id-missing",
      realAction: "blocked-accepted-id-missing",
      note: "ledger sent without a message id is not delivery; real recipients stay unsent",
    };
  }
  if (input.mode === "real" && !accepted) {
    return {
      ...base,
      canaryAction: "not-sent-by-this-mode",
      realAction: "blocked-not-accepted",
      note: "real mode does not send the canary; this edition has no accepted canary message to query",
    };
  }
  return {
    ...base,
    canaryAction: accepted ? "already-accepted-not-resent" : "would-send",
    realAction: "held-until-delivered",
    note: accepted
      ? "accepted canary is not resent; real recipients wait for this edition's delivered event"
      : "real recipients wait until this edition's canary delivery query returns delivered",
  };
}

/**
 * Starts one read with an AbortSignal and stops waiting at `timeoutMs`.
 * The signal is aborted when the deadline wins, and again in `finally` if the
 * read has not finished. Callers that pass the signal through to fetch cancel
 * the socket. A caller that ignores the signal can still leave a promise
 * pending; the race does not wait for it.
 */
async function waitForQuery<T>(
  start: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("delivery query timed out"));
    }, timeoutMs);
  });
  const work = Promise.resolve()
    .then(() => start(controller.signal))
    .then(
      (value) => {
        settled = true;
        return value;
      },
      (err: unknown) => {
        if (controller.signal.aborted) throw new Error("delivery query timed out");
        throw err;
      },
    );
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    if (!settled) controller.abort();
  }
}

/**
 * Provider accepted `id`. Try to store `sent` plus the id. If that write fails,
 * store the id alone so a later run can poll it instead of sending again.
 * Returns the id either way. A second write failure means this process still
 * has the id, but the next process will not.
 */
export async function settleAcceptedSend(
  id: string,
  write: (patch: { status?: "sent"; resendMessageId: string }) => Promise<void>,
): Promise<{ ok: true } | { ok: false; id: string; error: string }> {
  try {
    await write({ status: "sent", resendMessageId: id });
    return { ok: true };
  } catch {
    try {
      await write({ resendMessageId: id });
    } catch {
      return { ok: false, id, error: "provider accepted but ledger update failed" };
    }
    return { ok: false, id, error: "provider accepted but sent-status update failed" };
  }
}

/**
 * Poll this message id until it is delivered, terminally not delivered, the
 * query fails, or the attempt/time budget is spent. Pending events never
 * count as delivered.
 */
export async function pollCanaryDelivery(input: PollCanaryDeliveryInput): Promise<PollCanaryDeliveryResult> {
  const pollIntervalMs = input.pollIntervalMs ?? WEEKLY_CANARY_DELIVERY_POLL_MS;
  const maxPolls = input.maxPolls ?? WEEKLY_CANARY_DELIVERY_MAX_POLLS;
  const budgetMs = input.budgetMs ?? WEEKLY_CANARY_DELIVERY_BUDGET_MS;
  const queryTimeoutMs = input.queryTimeoutMs ?? WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS;
  const started = input.now();
  const deadline = started + budgetMs;
  let polls = 0;
  let lastEvent: string | null = null;
  const elapsed = () => Math.max(0, input.now() - started);

  if (!(budgetMs > 0) || !(maxPolls > 0)) {
    return { outcome: "timeout", polls: 0, lastEvent: null, elapsedMs: elapsed() };
  }

  while (polls < maxPolls) {
    if (input.now() >= deadline) break;
    polls += 1;
    let report: DeliveryQueryResult;
    try {
      const remaining = Math.max(1, deadline - input.now());
      const cap = Math.min(queryTimeoutMs, remaining);
      report = await waitForQuery((signal) => input.query(input.messageId, signal), cap);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { outcome: "query-error", polls, error: redactSensitive(message), elapsedMs: elapsed(), lastEvent };
    }
    if (!report.ok) {
      return {
        outcome: "query-error",
        polls,
        error: redactSensitive(report.error || "delivery query failed"),
        elapsedMs: elapsed(),
        lastEvent,
      };
    }
    const event = sanitizeProviderEvent(report.lastEvent);
    if (!event) {
      return {
        outcome: "query-error",
        polls,
        error: "delivery query returned no last_event",
        elapsedMs: elapsed(),
        lastEvent: null,
      };
    }
    lastEvent = event;
    const kind = classifyCanaryProviderEvent(event);
    if (kind === "delivered") return { outcome: "delivered", polls, lastEvent, elapsedMs: elapsed() };
    if (kind === "terminal") return { outcome: "terminal", polls, lastEvent, elapsedMs: elapsed() };
    if (polls >= maxPolls) break;
    const remaining = deadline - input.now();
    if (remaining <= 0) break;
    await input.sleep(Math.min(pollIntervalMs, remaining));
  }

  return { outcome: "timeout", polls, lastEvent, elapsedMs: elapsed() };
}

interface AttemptWithId extends WeeklyGateAttempt {
  id?: string;
  held?: boolean;
}

export async function executeWeeklyGatedSend(input: ExecuteWeeklyGatedSendInput): Promise<WeeklyGateRunResult> {
  const attempts: AttemptWithId[] = [];
  const queriedMessageIds: string[] = [];
  let messageId: string | null = null;
  const budgetMs = input.budgetMs ?? WEEKLY_CANARY_DELIVERY_BUDGET_MS;
  const maxPolls = input.maxPolls ?? WEEKLY_CANARY_DELIVERY_MAX_POLLS;
  const pollIntervalMs = input.pollIntervalMs ?? WEEKLY_CANARY_DELIVERY_POLL_MS;
  const queryTimeoutMs = input.queryTimeoutMs ?? WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS;
  const now = input.now ?? (() => Date.now());
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const held = selectGateHeldRecipients({
    mode: input.mode,
    canaryId: input.canary?.id ?? null,
    held: input.held,
    plannedIds: input.plannedIds,
    ledger: input.ledger,
  });

  function finish(partial: {
    exitCode: number;
    reason: string;
    canarySends?: number;
    realSends?: number;
    failed?: number;
    skipped?: number;
    polls?: number;
    lastEvent?: string | null;
    elapsedMs?: number;
    deliveredConfirmed?: boolean;
    error?: string;
    markError?: string;
  }): WeeklyGateRunResult {
    const canarySends = partial.canarySends ?? 0;
    const realSends = partial.realSends ?? 0;
    const deliveredConfirmed = partial.deliveredConfirmed ?? false;
    const safeLastEvent = sanitizeProviderEvent(partial.lastEvent);
    const log: Record<string, unknown> = {
      phase: "canary-gate",
      result: partial.reason === "canary-delivery-timeout" ? "timeout" : partial.reason,
      reason: partial.reason,
      exitCode: partial.exitCode,
      editionDate: input.editionDate,
      issue: input.issue,
      mode: input.mode,
      canary: input.canary ? maskWeeklyEmail(input.canary.email) : null,
      messageId: messageId ? redactMessageId(messageId) : null,
      polls: partial.polls ?? 0,
      maxPolls,
      pollIntervalMs,
      budgetMs,
      queryTimeoutMs,
      elapsedMs: partial.elapsedMs ?? 0,
      lastEvent: safeLastEvent,
      canarySends,
      realSends,
      realSent: realSends,
      failed: partial.failed ?? 0,
      deliveredConfirmed,
      error: partial.error,
      markError: partial.markError,
    };
    return {
      exitCode: partial.exitCode,
      reason: partial.reason,
      canarySends,
      realSends,
      failed: partial.failed ?? 0,
      skipped: partial.skipped ?? 0,
      polls: partial.polls ?? 0,
      lastEvent: safeLastEvent,
      deliveredConfirmed,
      queriedMessageIds: [...queriedMessageIds],
      attempts: attempts.map(({ subscriberId, idempotencyKey, ok, skipped, error }) => ({
        subscriberId,
        idempotencyKey,
        ok,
        skipped,
        error,
      })),
      log,
    };
  }

  if (input.dryRun || (input.mode === "all" && input.plan === "noop")) {
    const preview = previewWeeklyCanaryGate({
      mode: input.mode,
      editionDate: input.editionDate,
      canary: input.canary,
      heldCount: input.dryRun ? held.length : 0,
      ledger: input.ledger,
      plan: input.mode === "all" ? (input.plan ?? "send") : undefined,
    });
    const reason = input.dryRun ? "dry-run" : "plan-noop";
    const result = finish({ exitCode: 0, reason, deliveredConfirmed: false });
    result.log.result = reason;
    result.log.deliveredConfirmed = false;
    result.log.deliveryProof = preview.deliveryProof;
    result.log.writes = 0;
    result.log.transportSends = 0;
    result.log.canaryAction = preview.canaryAction;
    result.log.realAction = preview.realAction;
    result.log.note = preview.note;
    result.log.canaryAccepted = preview.canaryAccepted;
    result.deliveredConfirmed = false;
    result.realSends = 0;
    result.canarySends = 0;
    return result;
  }

  async function sendRecipient(row: WeeklyAudienceRow): Promise<AttemptWithId> {
    const idempotencyKey = weeklyIdempotencyKey(input.issue, input.editionDate, row.id);
    try {
      const sent = await input.send({ subscriberId: row.id, idempotencyKey });
      const attempt: AttemptWithId = {
        subscriberId: row.id,
        idempotencyKey,
        ok: sent.ok,
        skipped: sent.ok ? Boolean(sent.skipped) : false,
        error: sent.ok ? undefined : redactSensitive(sent.error),
        id: sent.id,
        held: sent.ok ? false : Boolean(sent.held),
      };
      attempts.push(attempt);
      return attempt;
    } catch (err) {
      const attempt: AttemptWithId = {
        subscriberId: row.id,
        idempotencyKey,
        ok: false,
        skipped: false,
        error: redactSensitive(err instanceof Error ? err.message : String(err)),
      };
      attempts.push(attempt);
      return attempt;
    }
  }

  if (input.mode === "canary") {
    if (!input.canary) return finish({ exitCode: WEEKLY_EXIT_MISSING_CANARY, reason: "missing-canary" });
    const row = ledgerFor(input.ledger, input.canary.id);
    if (row?.status === "sent" && !usableMessageId(row.resendMessageId)) {
      return finish({ exitCode: WEEKLY_EXIT_GATE_CLOSED, reason: "claim-held" });
    }
    if (row?.status === "bounced" || canaryLedgerTerminal(row)) {
      return finish({ exitCode: WEEKLY_EXIT_GATE_CLOSED, reason: "canary-terminal" });
    }
    if (row?.status === "sent" || usableMessageId(row?.resendMessageId)) {
      messageId = usableMessageId(row?.resendMessageId);
      return finish({ exitCode: 0, reason: "canary-already-recorded", deliveredConfirmed: false });
    }
    const attempt = await sendRecipient(input.canary);
    if (attempt.held) return finish({ exitCode: WEEKLY_EXIT_GATE_CLOSED, reason: attempt.id ? "canary-ledger-persist-failed" : "claim-held", failed: 1 });
    if (!attempt.ok) return finish({ exitCode: WEEKLY_EXIT_CANARY_API, reason: "canary-api-error", failed: 1 });
    messageId = usableMessageId(attempt.id);
    return finish({
      exitCode: 0,
      reason: "canary-accepted",
      canarySends: attempt.skipped ? 0 : 1,
      deliveredConfirmed: false,
    });
  }

  if (!input.canary) return finish({ exitCode: WEEKLY_EXIT_MISSING_CANARY, reason: "missing-canary" });

  const row = ledgerFor(input.ledger, input.canary.id);
  if (canaryLedgerTerminal(row)) {
    messageId = usableMessageId(row?.resendMessageId);
    return finish({
      exitCode: WEEKLY_EXIT_GATE_CLOSED,
      reason: "canary-terminal",
      lastEvent: row?.status ?? null,
    });
  }
  if (row?.status === "sent" && !usableMessageId(row.resendMessageId)) {
    return finish({ exitCode: WEEKLY_EXIT_GATE_CLOSED, reason: "canary-accepted-id-missing" });
  }

  messageId = usableMessageId(row?.resendMessageId);
  let canarySends = 0;
  if (!messageId) {
    if (input.mode === "real") {
      return finish({ exitCode: WEEKLY_EXIT_GATE_CLOSED, reason: "canary-not-accepted" });
    }
    const attempt = await sendRecipient(input.canary);
    messageId = usableMessageId(attempt.id);
    if (attempt.held || (!attempt.ok && messageId)) {
      return finish({
        exitCode: WEEKLY_EXIT_GATE_CLOSED,
        reason: messageId ? "canary-ledger-persist-failed" : "claim-held",
        failed: 1,
      });
    }
    if (!attempt.ok) return finish({ exitCode: WEEKLY_EXIT_CANARY_API, reason: "canary-api-error", failed: 1 });
    if (!messageId) return finish({ exitCode: WEEKLY_EXIT_GATE_CLOSED, reason: "canary-accepted-id-missing" });
    if (!attempt.skipped) canarySends = 1;
  }

  const polled = await pollCanaryDelivery({
    messageId,
    now,
    sleep,
    pollIntervalMs,
    maxPolls,
    budgetMs,
    queryTimeoutMs,
    query: async (id, signal) => {
      queriedMessageIds.push(id);
      return input.queryDelivery(id, signal);
    },
  });

  if (polled.outcome === "query-error") {
    return finish({
      exitCode: WEEKLY_EXIT_GATE_CLOSED,
      reason: "delivery-query-error",
      polls: polled.polls,
      lastEvent: polled.lastEvent,
      elapsedMs: polled.elapsedMs,
      error: polled.error,
      canarySends,
    });
  }
  if (polled.outcome === "timeout") {
    return finish({
      exitCode: WEEKLY_EXIT_GATE_CLOSED,
      reason: "canary-delivery-timeout",
      polls: polled.polls,
      lastEvent: polled.lastEvent,
      elapsedMs: polled.elapsedMs,
      canarySends,
    });
  }
  if (polled.outcome === "terminal") {
    const status = ledgerStatusForTerminalEvent(polled.lastEvent);
    let markError: string | undefined;
    try {
      await input.markTerminal?.({ subscriberId: input.canary.id, status, lastEvent: polled.lastEvent });
    } catch (err) {
      markError = redactSensitive(err instanceof Error ? err.message : String(err));
    }
    return finish({
      exitCode: WEEKLY_EXIT_GATE_CLOSED,
      reason: "canary-not-delivered",
      polls: polled.polls,
      lastEvent: polled.lastEvent,
      elapsedMs: polled.elapsedMs,
      canarySends,
      markError,
    });
  }

  let failed = 0;
  let realSends = 0;
  let skipped = 0;
  let heldUnknown = input.held.filter((recipient) => {
    const ledger = ledgerFor(input.ledger, recipient.id);
    return ledger?.status === "sent" && !usableMessageId(ledger.resendMessageId);
  }).length;
  for (const recipient of held) {
    const attempt = await sendRecipient(recipient);
    if (attempt.held) heldUnknown += 1;
    else if (!attempt.ok) failed += 1;
    else if (attempt.skipped) skipped += 1;
    else realSends += 1;
  }
  if (heldUnknown > 0) {
    return finish({
      exitCode: WEEKLY_EXIT_GATE_CLOSED,
      reason: "reconciliation-held",
      canarySends,
      realSends,
      failed,
      skipped,
      polls: polled.polls,
      lastEvent: polled.lastEvent,
      elapsedMs: polled.elapsedMs,
      deliveredConfirmed: true,
    });
  }
  return finish({
    exitCode: failed > 0 ? WEEKLY_EXIT_REAL_FAILED : 0,
    reason: failed > 0 ? "real-failed" : "delivered",
    canarySends,
    realSends,
    failed,
    skipped,
    polls: polled.polls,
    lastEvent: polled.lastEvent,
    elapsedMs: polled.elapsedMs,
    deliveredConfirmed: true,
  });
}
