/**
 * Durable per-edition, per-subscriber claim for the weekly sender.
 *
 * The claim is the existing `newsletter_send` row, unique on
 * (edition_date, subscriber_id). It is not an advisory lock. A session lock
 * disappears when the connection closes; this row does not.
 *
 * Before the provider is called, the winner commits `status = sent` and
 * `resend_message_id` NULL. That means the outcome is unknown until a provider
 * id is stored. Abort, timeout, a thrown send, and a failed id write leave
 * the row as it is. Nothing in `finally` sets it back to `queued` or `failed`.
 *
 * A later run that sees a provider id only queries that id. It does not send.
 * `sent` with no id stays unknown and is not taken. `bounced`, and `failed`
 * that still has an id, are terminal and are not rewritten. `failed` with no
 * id is only the record of a documented definite rejection, so a later run
 * may claim it. There is no recovery command in this program. A person may,
 * outside it, write a missing id onto a `sent` row or delete a row after
 * confirming the provider state.
 *
 * Limits: a crash after the claim commits and before the provider is called
 * leaves the same hold, even if nothing was accepted. A claim transaction
 * that never commits does not call the provider, so a later run may claim.
 * This is not a proof about a provider call that happened without a committed
 * claim, and it is not a provider-idempotency guarantee.
 */
import type { Pool, PoolClient } from "pg";

export const WEEKLY_CLAIM_TIMEOUT_MS = 5_000;
export const WEEKLY_SEND_TIMEOUT_MS = 10_000;

export interface ClaimStatementResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface ClaimDb {
  /** One bounded statement. Must not be held open across a provider call. */
  statement<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<ClaimStatementResult<T>>;
}

/**
 * Documented Resend rejections that do not create an email.
 * Source: https://resend.com/docs/api-reference/errors (fetched 2026-11-08)
 * and the `name` values in resend 6.32.0. HTTP 408 is not in that list.
 * 409 `concurrent_idempotent_requests`, `invalid_idempotent_request`, and
 * `resource_locked` are not rejections of an unseen send. 500
 * `application_error` and 503 `service_unavailable` are not either.
 * The SDK readme says an abort returns statusCode null.
 */
export const RESEND_DEFINITE_REJECTION_STATUSES: ReadonlyMap<string, readonly number[]> = new Map([
  ["invalid_idempotency_key", [400]],
  ["validation_error", [400, 401, 403]],
  ["missing_api_key", [401]],
  ["restricted_api_key", [401, 403]],
  ["email_above_quota", [403]],
  ["invalid_permission", [403]],
  ["suspended_api_key", [403]],
  ["not_found", [404]],
  ["method_not_allowed", [405]],
  ["invalid_attachment", [422]],
  ["invalid_parameter", [422]],
  ["missing_required_field", [422]],
  ["missing_required_parameter", [422]],
  ["daily_quota_exceeded", [429]],
  ["monthly_quota_exceeded", [429]],
  ["rate_limit_exceeded", [429]],
]);

export type ClaimTransportResult =
  | { accepted: true; id: string }
  | { accepted: false; statusCode: number | null; name?: string | null; error: string };

/** True only for an allowlisted Resend rejection. Abort, 408, 409, and unknown are not. */
export function isDefiniteProviderRejection(input: {
  aborted: boolean;
  statusCode: number | null;
  name?: string | null;
}): boolean {
  if (input.aborted) return false;
  if (input.statusCode == null || input.statusCode === 408 || input.statusCode === 409) return false;
  const allowed = RESEND_DEFINITE_REJECTION_STATUSES.get(input.name?.trim() ?? "");
  return Boolean(allowed?.includes(input.statusCode));
}

export type ClaimSendResult =
  | { action: "sent"; providerId: string }
  | { action: "query"; providerId: string }
  | { action: "rejected"; error: string }
  | { action: "held"; reason: "unknown" | "terminal" | "persist-failed"; providerId?: string };

interface SendRow {
  id: string;
  status: string;
  resend_message_id: string | null;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function rowsOf<T>(result: { rows?: T[]; rowCount?: number | null; affectedRows?: number }): ClaimStatementResult<T> {
  const rows = result.rows ?? [];
  const rowCount = result.rowCount ?? result.affectedRows ?? rows.length;
  return { rows, rowCount };
}

export function claimDbFromPglite(client: {
  query: (text: string, params?: unknown[]) => Promise<{ rows?: Record<string, unknown>[]; rowCount?: number; affectedRows?: number }>;
}): ClaimDb {
  return {
    async statement<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
      const result = await withTimeout(client.query(text, params), WEEKLY_CLAIM_TIMEOUT_MS, "claim statement timed out");
      return rowsOf(result) as ClaimStatementResult<T>;
    },
  };
}

export function claimDbFromPool(pool: Pool): ClaimDb {
  return {
    async statement<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
      let client: PoolClient | undefined;
      let destroy = false;
      try {
        client = await withTimeout(pool.connect(), WEEKLY_CLAIM_TIMEOUT_MS, "claim connection timed out");
        await client.query("BEGIN");
        await client.query(`SET LOCAL lock_timeout = '${WEEKLY_CLAIM_TIMEOUT_MS}ms'`);
        await client.query(`SET LOCAL statement_timeout = '${WEEKLY_CLAIM_TIMEOUT_MS}ms'`);
        const result = await withTimeout(client.query(text, params), WEEKLY_CLAIM_TIMEOUT_MS, "claim statement timed out");
        await client.query("COMMIT");
        return rowsOf(result) as ClaimStatementResult<T>;
      } catch (err) {
        destroy = true;
        await client?.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        if (client) {
          const release = client.release(destroy);
          await withTimeout(Promise.resolve(release), 1_000, "claim connection release timed out").catch(() => undefined);
        }
      }
    },
  };
}

const INSERT_CLAIM = `
  INSERT INTO newsletter_send (edition_date, subscriber_id, status)
  VALUES ($1::date, $2::uuid, 'sent')
  ON CONFLICT (edition_date, subscriber_id) DO NOTHING
  RETURNING id, status, resend_message_id
`;

const UPGRADE_RETRYABLE = `
  UPDATE newsletter_send
  SET status = 'sent'
  WHERE edition_date = $1::date
    AND subscriber_id = $2::uuid
    AND resend_message_id IS NULL
    AND status IN ('queued', 'failed')
  RETURNING id, status, resend_message_id
`;

const READ_CLAIM = `
  SELECT id, status, resend_message_id
  FROM newsletter_send
  WHERE edition_date = $1::date AND subscriber_id = $2::uuid
`;

const WRITE_ID = `
  UPDATE newsletter_send
  SET resend_message_id = $2
  WHERE id = $1::uuid
    AND resend_message_id IS NULL
  RETURNING id
`;

const MARK_DEFINITE_REJECTION = `
  UPDATE newsletter_send
  SET status = 'failed'
  WHERE id = $1::uuid
    AND status = 'sent'
    AND resend_message_id IS NULL
  RETURNING id
`;

function asRow(value: Record<string, unknown> | undefined): SendRow | null {
  if (!value) return null;
  return {
    id: String(value.id),
    status: String(value.status),
    resend_message_id: value.resend_message_id == null ? null : String(value.resend_message_id),
  };
}

async function readClaim(db: ClaimDb, editionDate: string, subscriberId: string): Promise<SendRow | null> {
  const result = await db.statement<Record<string, unknown>>(READ_CLAIM, [editionDate, subscriberId]);
  return asRow(result.rows[0]);
}

async function takeClaim(db: ClaimDb, editionDate: string, subscriberId: string): Promise<
  | { won: true; rowId: string }
  | { won: false; row: SendRow | null }
> {
  const inserted = await db.statement<Record<string, unknown>>(INSERT_CLAIM, [editionDate, subscriberId]);
  const insertedRow = asRow(inserted.rows[0]);
  if (insertedRow) return { won: true, rowId: insertedRow.id };
  const upgraded = await db.statement<Record<string, unknown>>(UPGRADE_RETRYABLE, [editionDate, subscriberId]);
  const upgradedRow = asRow(upgraded.rows[0]);
  if (upgradedRow) return { won: true, rowId: upgradedRow.id };
  return { won: false, row: await readClaim(db, editionDate, subscriberId) };
}

function classifyExisting(row: SendRow | null): ClaimSendResult {
  if (!row) return { action: "held", reason: "unknown" };
  if (row.status === "bounced" || row.status === "failed") return { action: "held", reason: "terminal" };
  if (row.resend_message_id?.trim()) return { action: "query", providerId: row.resend_message_id.trim() };
  return { action: "held", reason: "unknown" };
}

async function persistProviderId(db: ClaimDb, rowId: string, providerId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const written = await db.statement(WRITE_ID, [rowId, providerId]);
      if (written.rows.length > 0) return true;
      const current = await db.statement<Record<string, unknown>>(
        "SELECT resend_message_id FROM newsletter_send WHERE id = $1::uuid",
        [rowId],
      );
      if (String(current.rows[0]?.resend_message_id ?? "") === providerId) return true;
    } catch {
      // The claim row stays. A second attempt is the only retry.
    }
  }
  return false;
}

function definiteRejection(result: ClaimTransportResult, aborted: boolean): boolean {
  if (result.accepted) return false;
  return isDefiniteProviderRejection({ aborted, statusCode: result.statusCode, name: result.name });
}

/**
 * Claim this edition+subscriber, then send at most once.
 * Unknown results leave the committed claim in place.
 */
export async function claimAndSend(input: {
  db: ClaimDb;
  editionDate: string;
  subscriberId: string;
  timeoutMs?: number;
  transport: (signal: AbortSignal) => Promise<ClaimTransportResult>;
}): Promise<ClaimSendResult> {
  const timeoutMs = input.timeoutMs ?? WEEKLY_SEND_TIMEOUT_MS;
  let claimed: Awaited<ReturnType<typeof takeClaim>>;
  try {
    claimed = await takeClaim(input.db, input.editionDate, input.subscriberId);
  } catch {
    return { action: "held", reason: "unknown" };
  }
  if (!claimed.won) return classifyExisting(claimed.row);

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = input.transport(controller.signal);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("send timed out"));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([work, timeout]);
    if (controller.signal.aborted) {
      void persistLateId(input.db, claimed.rowId, work);
      return { action: "held", reason: "unknown" };
    }
    if (result.accepted && result.id.trim()) {
      const stored = await persistProviderId(input.db, claimed.rowId, result.id.trim());
      if (!stored) return { action: "held", reason: "persist-failed", providerId: result.id.trim() };
      return { action: "sent", providerId: result.id.trim() };
    }
    if (definiteRejection(result, controller.signal.aborted)) {
      try {
        const released = await input.db.statement(MARK_DEFINITE_REJECTION, [claimed.rowId]);
        if (released.rows.length === 0) return { action: "held", reason: "unknown" };
      } catch {
        return { action: "held", reason: "unknown" };
      }
      return { action: "rejected", error: result.accepted ? "rejected" : result.error };
    }
    return { action: "held", reason: "unknown" };
  } catch {
    controller.abort();
    void persistLateId(input.db, claimed.rowId, work);
    return { action: "held", reason: "unknown" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function persistLateId(db: ClaimDb, rowId: string, work: Promise<ClaimTransportResult>): Promise<void> {
  try {
    const result = await work;
    if (result.accepted && result.id.trim()) await persistProviderId(db, rowId, result.id.trim());
  } catch {
    // Still unknown. Do not mark the claim failed.
  }
}

export async function readSendClaim(db: ClaimDb, editionDate: string, subscriberId: string): Promise<SendRow | null> {
  return readClaim(db, editionDate, subscriberId);
}
