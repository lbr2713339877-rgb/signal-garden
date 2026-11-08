import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  claimAndSend,
  claimDbFromPglite,
  readSendClaim,
  type ClaimDb,
  type ClaimTransportResult,
} from "./edition-claim";

async function freshDb(): Promise<{ raw: PGlite; db: ClaimDb }> {
  const raw = new PGlite();
  await raw.exec(`
    CREATE TYPE newsletter_send_status AS ENUM ('queued', 'sent', 'failed', 'bounced');
    CREATE TABLE newsletter_send (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      edition_date date NOT NULL,
      subscriber_id uuid NOT NULL,
      resend_message_id text,
      status newsletter_send_status NOT NULL,
      UNIQUE (edition_date, subscriber_id)
    );
  `);
  return { raw, db: claimDbFromPglite(raw) };
}

test("two overlapping claims allow one transport send", async () => {
  const { db } = await freshDb();
  const subscriberId = crypto.randomUUID();
  let sends = 0;
  const transport = async (): Promise<ClaimTransportResult> => {
    sends += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { accepted: true, id: "provider-one" };
  };
  const [left, right] = await Promise.all([
    claimAndSend({ db, editionDate: "2026-11-02", subscriberId, timeoutMs: 1_000, transport }),
    claimAndSend({ db, editionDate: "2026-11-02", subscriberId, timeoutMs: 1_000, transport }),
  ]);
  assert.equal(sends, 1);
  const actions = [left.action, right.action];
  assert.equal(actions.filter((action) => action === "sent").length, 1);
  assert.ok(actions.includes("held") || actions.includes("query"));
  const row = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(row?.status, "sent");
  assert.equal(row?.resend_message_id, "provider-one");
});

test("double persistence failure leaves a durable unknown claim", async () => {
  const { db } = await freshDb();
  const subscriberId = crypto.randomUUID();
  const flaky: ClaimDb = {
    async statement(text, params) {
      if (text.includes("SET resend_message_id")) throw new Error("persist failed");
      return db.statement(text, params);
    },
  };
  const first = await claimAndSend({
    db: flaky,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 1_000,
    transport: async () => ({ accepted: true, id: "provider-lost" }),
  });
  assert.equal(first.action, "held");
  if (first.action === "held") assert.equal(first.reason, "persist-failed");
  const row = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(row?.status, "sent");
  assert.equal(row?.resend_message_id, null);

  let retried = 0;
  const second = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 1_000,
    transport: async () => {
      retried += 1;
      return { accepted: true, id: "provider-again" };
    },
  });
  assert.equal(retried, 0);
  assert.equal(second.action, "held");
  const after = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(after?.status, "sent");
  assert.equal(after?.resend_message_id, null);
});

test("send timeout leaves an unknown claim that is not retried", async () => {
  const { db } = await freshDb();
  const subscriberId = crypto.randomUUID();
  let aborted = false;
  const first = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 25,
    transport: (signal) => new Promise<ClaimTransportResult>((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
    }),
  });
  assert.equal(aborted, true);
  assert.deepEqual(first, { action: "held", reason: "unknown" });
  const row = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(row?.status, "sent");
  assert.equal(row?.resend_message_id, null);

  let retried = 0;
  const second = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 1_000,
    transport: async () => {
      retried += 1;
      return { accepted: true, id: "provider-retry" };
    },
  });
  assert.equal(retried, 0);
  assert.equal(second.action, "held");
  const after = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(after?.resend_message_id, null);
  assert.equal(after?.status, "sent");
});

test("bounced rows and failed rows that still have an id are not reclaimed", async () => {
  const { db } = await freshDb();
  const bounced = crypto.randomUUID();
  await db.statement(
    `INSERT INTO newsletter_send (edition_date, subscriber_id, status)
     VALUES ($1::date, $2::uuid, 'bounced')`,
    ["2026-11-02", bounced],
  );
  const failedWithId = crypto.randomUUID();
  await db.statement(
    `INSERT INTO newsletter_send (edition_date, subscriber_id, status, resend_message_id)
     VALUES ($1::date, $2::uuid, 'failed', 'kept-id')`,
    ["2026-11-02", failedWithId],
  );
  for (const subscriberId of [bounced, failedWithId]) {
    let sends = 0;
    const result = await claimAndSend({
      db,
      editionDate: "2026-11-02",
      subscriberId,
      transport: async () => {
        sends += 1;
        return { accepted: true, id: "should-not" };
      },
    });
    assert.equal(sends, 0);
    assert.equal(result.action, "held");
    if (result.action === "held") assert.equal(result.reason, "terminal");
  }
  assert.equal((await readSendClaim(db, "2026-11-02", bounced))?.status, "bounced");
  assert.equal((await readSendClaim(db, "2026-11-02", failedWithId))?.resend_message_id, "kept-id");
});

test("408, 409, unknown, and network results stay held and are not retried", async () => {
  const cases = [
    { statusCode: 408, name: "validation_error", error: "request timeout" },
    { statusCode: 409, name: "concurrent_idempotent_requests", error: "in progress" },
    { statusCode: 409, name: "invalid_idempotent_request", error: "payload changed" },
    { statusCode: 409, name: "resource_locked", error: "locked" },
    { statusCode: 400, name: "not_a_resend_code", error: "unknown name" },
    { statusCode: 400, name: null, error: "missing name" },
    { statusCode: null, name: "application_error", error: "network" },
    { statusCode: 500, name: "application_error", error: "server" },
  ];
  for (const item of cases) {
    const { db } = await freshDb();
    const subscriberId = crypto.randomUUID();
    const first = await claimAndSend({
      db,
      editionDate: "2026-11-02",
      subscriberId,
      timeoutMs: 1_000,
      transport: async () => ({ accepted: false, ...item }),
    });
    assert.equal(first.action, "held", JSON.stringify(item));
    const row = await readSendClaim(db, "2026-11-02", subscriberId);
    assert.equal(row?.status, "sent");
    assert.equal(row?.resend_message_id, null);
    let retried = 0;
    const second = await claimAndSend({
      db,
      editionDate: "2026-11-02",
      subscriberId,
      timeoutMs: 1_000,
      transport: async () => {
        retried += 1;
        return { accepted: true, id: "retry-id" };
      },
    });
    assert.equal(retried, 0, JSON.stringify(item));
    assert.equal(second.action, "held");
  }
});

test("an aborted send is not treated as a documented rejection", async () => {
  const { db } = await freshDb();
  const subscriberId = crypto.randomUUID();
  const result = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 20,
    transport: (signal) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        resolve({ accepted: false, statusCode: 422, name: "invalid_attachment", error: "late validation" });
      });
    }),
  });
  assert.equal(result.action, "held");
  const row = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(row?.status, "sent");
  assert.equal(row?.resend_message_id, null);
  let retried = 0;
  const second = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 1_000,
    transport: async () => {
      retried += 1;
      return { accepted: true, id: "retry-id" };
    },
  });
  assert.equal(retried, 0);
  assert.equal(second.action, "held");
});

test("a documented attachment rejection is failed with no id and can be retried", async () => {
  const { db } = await freshDb();
  const subscriberId = crypto.randomUUID();
  const first = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 1_000,
    transport: async () => ({ accepted: false, statusCode: 422, name: "invalid_attachment", error: "missing content" }),
  });
  assert.equal(first.action, "rejected");
  const row = await readSendClaim(db, "2026-11-02", subscriberId);
  assert.equal(row?.status, "failed");
  assert.equal(row?.resend_message_id, null);
  let retried = 0;
  const second = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    timeoutMs: 1_000,
    transport: async () => {
      retried += 1;
      return { accepted: true, id: "retry-id" };
    },
  });
  assert.equal(retried, 1);
  assert.equal(second.action, "sent");
});

test("an existing provider id is queried and not sent", async () => {
  const { db } = await freshDb();
  const subscriberId = crypto.randomUUID();
  await db.statement(
    `INSERT INTO newsletter_send (edition_date, subscriber_id, status, resend_message_id)
     VALUES ($1::date, $2::uuid, 'sent', $3)`,
    ["2026-11-02", subscriberId, "already-there"],
  );
  let sends = 0;
  const result = await claimAndSend({
    db,
    editionDate: "2026-11-02",
    subscriberId,
    transport: async () => {
      sends += 1;
      return { accepted: true, id: "new-id" };
    },
  });
  assert.equal(sends, 0);
  assert.deepEqual(result, { action: "query", providerId: "already-there" });
});
