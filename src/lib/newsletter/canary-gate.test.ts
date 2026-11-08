import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WEEKLY_CANARY_DELIVERY_BUDGET_MS,
  WEEKLY_CANARY_DELIVERY_MAX_POLLS,
  WEEKLY_CANARY_DELIVERY_POLL_MS,
  WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS,
  classifyCanaryProviderEvent,
  executeWeeklyGatedSend,
  ledgerStatusForTerminalEvent,
  previewWeeklyCanaryGate,
  sanitizeProviderEvent,
  settleAcceptedSend,
  type ExecuteWeeklyGatedSendInput,
  type WeeklyEditionSendRow,
} from "./canary-gate";
import { deliveryLookupFromProvider } from "./transport";
import { runWeeklySnapshot } from "./weekly-run";
import type { WeeklyAudienceRow } from "./weekly-lock";

const CANARY: WeeklyAudienceRow = {
  id: "canary",
  email: "raynlee@mail.grokbot.com",
  source: null,
  utmSource: null,
};
const EXTRA: WeeklyAudienceRow = {
  id: "extra-canary",
  email: "ops@mail.grokbot.com",
  source: null,
  utmSource: null,
};
const REAL_A: WeeklyAudienceRow = {
  id: "real-a",
  email: "lin@foxmail.com",
  source: "footer",
  utmSource: null,
};
const REAL_B: WeeklyAudienceRow = {
  id: "real-b",
  email: "other@example.com",
  source: "footer",
  utmSource: null,
};

const PLANNED = [CANARY.id, EXTRA.id, REAL_A.id, REAL_B.id];

function run(partial: Partial<ExecuteWeeklyGatedSendInput> = {}) {
  const sends: { subscriberId: string; idempotencyKey: string }[] = [];
  const queries: string[] = [];
  const marks: Array<{ subscriberId: string; status: string; lastEvent: string }> = [];
  const result = executeWeeklyGatedSend({
    mode: "all",
    dryRun: false,
    issue: 3,
    editionDate: "2026-11-02",
    canary: CANARY,
    held: [EXTRA, REAL_A, REAL_B],
    plannedIds: PLANNED,
    ledger: [],
    now: () => 0,
    sleep: async () => {},
    pollIntervalMs: 0,
    maxPolls: 6,
    budgetMs: WEEKLY_CANARY_DELIVERY_BUDGET_MS,
    queryTimeoutMs: 40,
    plan: "send",
    ...partial,
    send: async (input) => {
      sends.push(input);
      if (partial.send) return partial.send(input);
      return { ok: true, id: `id-${input.subscriberId}` };
    },
    queryDelivery: async (messageId, signal) => {
      queries.push(messageId);
      if (partial.queryDelivery) return partial.queryDelivery(messageId, signal);
      return { ok: true, lastEvent: "delivered" };
    },
    markTerminal: async (input) => {
      marks.push(input);
      if (partial.markTerminal) await partial.markTerminal(input);
    },
  });
  return result.then((value) => ({ result: value, sends, queries, marks }));
}

function rawCanary(value: unknown): boolean {
  return JSON.stringify(value).includes("raynlee@");
}

test("only an exact delivered event opens the canary gate", () => {
  assert.equal(WEEKLY_CANARY_DELIVERY_BUDGET_MS, 30_000);
  assert.equal(WEEKLY_CANARY_DELIVERY_MAX_POLLS, 6);
  assert.equal(WEEKLY_CANARY_DELIVERY_POLL_MS, 5_000);
  assert.equal(WEEKLY_CANARY_DELIVERY_QUERY_TIMEOUT_MS, 5_000);
  for (const event of ["delivered", " Delivered "]) {
    assert.equal(classifyCanaryProviderEvent(event), "delivered");
  }
  for (const event of ["sent", "queued", "scheduled", "delivery_delayed", "opened", "clicked", ""]) {
    assert.equal(classifyCanaryProviderEvent(event), "pending");
  }
  for (const event of ["bounced", "failed", "complained", "canceled", "cancelled", "suppressed"]) {
    assert.equal(classifyCanaryProviderEvent(event), "terminal");
  }
  assert.equal(ledgerStatusForTerminalEvent("bounced"), "bounced");
  assert.equal(ledgerStatusForTerminalEvent("complained"), "bounced");
  assert.equal(ledgerStatusForTerminalEvent("failed"), "failed");
});

test("missing canary sends zero real recipients", async () => {
  const { result, sends, queries } = await run({ canary: null });
  assert.equal(result.exitCode, 3);
  assert.equal(result.reason, "missing-canary");
  assert.equal(result.realSends, 0);
  assert.equal(result.deliveredConfirmed, false);
  assert.deepEqual(sends, []);
  assert.deepEqual(queries, []);
  assert.equal(rawCanary(result.log), false);
});

test("canary API error sends zero real recipients", async () => {
  const { result, sends, queries } = await run({
    plannedIds: [REAL_A.id, CANARY.id, REAL_B.id],
    send: async () => ({ ok: false, error: "resend refused raynlee@mail.grokbot.com re_livekey123" }),
  });
  assert.equal(result.exitCode, 4);
  assert.equal(result.reason, "canary-api-error");
  assert.equal(result.realSends, 0);
  assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(sends[0]?.idempotencyKey, "newsletter-weekly-3/2026-11-02/canary");
  assert.deepEqual(queries, []);
  assert.equal(rawCanary(result), false);
  assert.equal(JSON.stringify(result).includes("re_livekey123"), false);
});

test("bounced or failed canary sends zero real recipients", async () => {
  const ledgerBounced: WeeklyEditionSendRow[] = [
    { subscriberId: "canary", status: "bounced", resendMessageId: "msg-canary" },
  ];
  const bounced = await run({ ledger: ledgerBounced });
  assert.equal(bounced.result.exitCode, 7);
  assert.equal(bounced.result.reason, "canary-terminal");
  assert.equal(bounced.result.realSends, 0);
  assert.deepEqual(bounced.sends, []);
  assert.deepEqual(bounced.queries, []);

  const failedLedger = await run({
    ledger: [{ subscriberId: "canary", status: "failed", resendMessageId: "msg-canary" }],
  });
  assert.equal(failedLedger.result.reason, "canary-terminal");
  assert.equal(failedLedger.sends.length, 0);
  assert.equal(failedLedger.result.realSends, 0);

  for (const lastEvent of ["bounced", "failed", "complained"]) {
    const observed = await run({
      queryDelivery: async () => ({ ok: true, lastEvent }),
    });
    assert.deepEqual(observed.sends.map((row) => row.subscriberId), ["canary"]);
    assert.equal(observed.result.exitCode, 7);
    assert.equal(observed.result.reason, "canary-not-delivered");
    assert.equal(observed.result.realSends, 0);
    assert.equal(observed.result.deliveredConfirmed, false);
    assert.equal(observed.marks.length, 1);
    assert.equal(observed.marks[0]?.subscriberId, "canary");
    assert.equal(observed.queries.every((id) => id === "id-canary"), true);
  }
  const complained = await run({ queryDelivery: async () => ({ ok: true, lastEvent: "complained" }) });
  assert.equal(complained.marks[0]?.status, "bounced");
  const failedEvent = await run({ queryDelivery: async () => ({ ok: true, lastEvent: "failed" }) });
  assert.equal(failedEvent.marks[0]?.status, "failed");
});

test("pending or non-delivered canary sends zero real recipients", async () => {
  for (const lastEvent of ["sent", "queued", "delivery_delayed", "opened", "clicked"]) {
    const { result, sends, queries } = await run({
      plannedIds: [REAL_A.id, CANARY.id],
      maxPolls: 3,
      queryDelivery: async () => ({ ok: true, lastEvent }),
    });
    assert.equal(result.exitCode, 7);
    assert.equal(result.reason, "canary-delivery-timeout");
    assert.equal(result.lastEvent, lastEvent);
    assert.equal(result.deliveredConfirmed, false);
    assert.equal(result.realSends, 0);
    assert.equal(result.log.realSent, 0);
    assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
    assert.equal(queries.length, 3);
    assert.ok(queries.length <= 3);
  }
});

test("delivery query error sends zero real recipients", async () => {
  let reads = 0;
  const failed = await run({
    queryDelivery: async () => {
      reads += 1;
      if (reads === 1) return { ok: false, error: "HTTP 500 for raynlee@mail.grokbot.com" };
      return { ok: true, lastEvent: "delivered" };
    },
  });
  assert.equal(failed.result.exitCode, 7);
  assert.equal(failed.result.reason, "delivery-query-error");
  assert.equal(failed.result.realSends, 0);
  assert.equal(failed.result.deliveredConfirmed, false);
  assert.deepEqual(failed.sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(failed.queries.length, 1);
  assert.equal(rawCanary(failed.result.log), false);

  const thrown = await run({
    queryDelivery: async () => {
      throw new Error("socket reset raynlee@mail.grokbot.com");
    },
  });
  assert.equal(thrown.result.reason, "delivery-query-error");
  assert.equal(thrown.result.realSends, 0);
  assert.equal(thrown.queries.length, 1);
  assert.equal(rawCanary(thrown.result.log), false);

  const hung = await run({
    queryTimeoutMs: 25,
    queryDelivery: () => new Promise(() => {}),
  });
  assert.equal(hung.result.exitCode, 7);
  assert.equal(hung.result.reason, "delivery-query-error");
  assert.equal(hung.result.realSends, 0);
  assert.equal(hung.queries.length, 1);
  assert.match(String(hung.result.log.error), /timed out/);
});

test("delivery wait timeout sends zero real recipients", async () => {
  let nowMs = 0;
  const { result, sends, queries } = await run({
    now: () => nowMs,
    sleep: async (ms) => {
      nowMs += ms;
    },
    maxPolls: 10,
    budgetMs: 12_000,
    pollIntervalMs: 5_000,
    queryDelivery: async () => ({ ok: true, lastEvent: "sent" }),
  });
  assert.equal(result.exitCode, 7);
  assert.equal(result.reason, "canary-delivery-timeout");
  assert.equal(result.log.result, "timeout");
  assert.equal(result.log.budgetMs, 12_000);
  assert.equal(result.log.maxPolls, 10);
  assert.equal(result.log.realSent, 0);
  assert.equal(result.realSends, 0);
  assert.equal(result.deliveredConfirmed, false);
  assert.equal(result.lastEvent, "sent");
  assert.ok(result.polls > 0);
  assert.ok(result.polls < 10);
  assert.equal(queries.length, result.polls);
  assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(rawCanary(result.log), false);
  assert.match(JSON.stringify(result.log), /timeout/);
  assert.match(String(result.log.canary), /@mail\.grokbot\.com/);
});

test("delivered canary allows this edition's real recipients", async () => {
  const order: string[] = [];
  const { result, sends } = await run({
    send: async ({ subscriberId }) => {
      order.push(`send:${subscriberId}`);
      return { ok: true, id: `id-${subscriberId}` };
    },
    queryDelivery: async (messageId) => {
      order.push(`query:${messageId}`);
      return { ok: true, lastEvent: "delivered" };
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.reason, "delivered");
  assert.equal(result.deliveredConfirmed, true);
  assert.equal(result.polls, 1);
  assert.deepEqual(order, [
    "send:canary",
    "query:id-canary",
    "send:extra-canary",
    "send:real-a",
    "send:real-b",
  ]);
  assert.deepEqual(sends.map((row) => row.idempotencyKey), [
    "newsletter-weekly-3/2026-11-02/canary",
    "newsletter-weekly-3/2026-11-02/extra-canary",
    "newsletter-weekly-3/2026-11-02/real-a",
    "newsletter-weekly-3/2026-11-02/real-b",
  ]);
  assert.equal(result.realSends, 3);

  const partial = await run({
    held: [REAL_A, REAL_B],
    plannedIds: [CANARY.id, REAL_A.id, REAL_B.id],
    send: async ({ subscriberId }) => {
      if (subscriberId === REAL_A.id) return { ok: false, error: "mailbox lin@foxmail.com unavailable" };
      return { ok: true, id: `id-${subscriberId}` };
    },
  });
  assert.equal(partial.result.exitCode, 5);
  assert.equal(partial.result.deliveredConfirmed, true);
  assert.deepEqual(partial.sends.map((row) => row.subscriberId), ["canary", "real-a", "real-b"]);
  assert.equal(JSON.stringify(partial.result.log).includes("lin@foxmail.com"), false);
});

test("rerun keeps accepted canary and sent real recipients idempotent", async () => {
  const waiting = await run({
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    maxPolls: 2,
    queryDelivery: async () => ({ ok: true, lastEvent: "sent" }),
  });
  assert.equal(waiting.sends.length, 0);
  assert.deepEqual(waiting.queries, ["msg-canary", "msg-canary"]);
  assert.equal(waiting.result.realSends, 0);
  assert.equal(waiting.result.exitCode, 7);
  assert.equal(waiting.result.deliveredConfirmed, false);

  const delivered = await run({
    ledger: [
      { subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" },
      { subscriberId: "real-a", status: "sent", resendMessageId: "msg-real-a" },
      { subscriberId: "real-b", status: "failed" },
    ],
    queryDelivery: async (messageId) => {
      assert.equal(messageId, "msg-canary");
      return { ok: true, lastEvent: "delivered" };
    },
  });
  assert.deepEqual(delivered.sends.map((row) => row.subscriberId), ["extra-canary", "real-b"]);
  assert.deepEqual(delivered.sends.map((row) => row.idempotencyKey), [
    "newsletter-weekly-3/2026-11-02/extra-canary",
    "newsletter-weekly-3/2026-11-02/real-b",
  ]);
  assert.equal(delivered.queries.every((id) => id === "msg-canary"), true);
  assert.equal(delivered.result.canarySends, 0);
  assert.equal(delivered.result.exitCode, 0);

  const sentWithoutId = await run({
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: null }],
  });
  assert.equal(sentWithoutId.sends.length, 0);
  assert.equal(sentWithoutId.queries.length, 0);
  assert.equal(sentWithoutId.result.reason, "canary-accepted-id-missing");
  assert.equal(sentWithoutId.result.realSends, 0);
});

test("dry-run does not write, send, or fabricate delivery", async () => {
  const live = await run({
    dryRun: true,
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    queryDelivery: async () => ({ ok: true, lastEvent: "delivered" }),
  });
  assert.equal(live.result.exitCode, 0);
  assert.equal(live.result.reason, "dry-run");
  assert.equal(live.sends.length, 0);
  assert.equal(live.queries.length, 0);
  assert.equal(live.marks.length, 0);
  assert.equal(live.result.deliveredConfirmed, false);
  assert.equal(live.result.realSends, 0);
  assert.equal(live.result.canarySends, 0);
  assert.equal(live.result.log.deliveredConfirmed, false);
  assert.equal(live.result.log.deliveryProof, "not-queried");
  assert.equal(live.result.log.writes, 0);
  assert.equal(live.result.log.transportSends, 0);
  assert.equal(live.result.log.canaryAction, "already-accepted-not-resent");
  assert.equal(live.result.log.realAction, "held-until-delivered");
  assert.equal(rawCanary(live.result.log), false);

  const preview = previewWeeklyCanaryGate({
    mode: "all",
    editionDate: "2026-11-02",
    canary: null,
    heldCount: 2,
    ledger: [],
    plan: "send",
  });
  assert.equal(preview.deliveredConfirmed, false);
  assert.equal(preview.writes, 0);
  assert.equal(preview.transportSends, 0);
  assert.equal(preview.deliveryProof, "not-queried");
  assert.equal(preview.realAction, "blocked-missing-canary");
  assert.equal(preview.canary, null);

  const noop = await run({ plan: "noop" });
  assert.equal(noop.sends.length, 0);
  assert.equal(noop.queries.length, 0);
  assert.equal(noop.result.exitCode, 0);
  assert.equal(noop.result.log.realAction, "plan-noop");
});

test("real mode cannot bypass the canary gate", async () => {
  const missing = await run({ mode: "real", canary: null, held: [REAL_A, REAL_B] });
  assert.equal(missing.result.exitCode, 3);
  assert.equal(missing.sends.length, 0);
  assert.equal(missing.result.realSends, 0);

  const notAccepted = await run({ mode: "real", held: [REAL_A, REAL_B], ledger: [] });
  assert.equal(notAccepted.result.exitCode, 7);
  assert.equal(notAccepted.result.reason, "canary-not-accepted");
  assert.equal(notAccepted.sends.length, 0);
  assert.equal(notAccepted.queries.length, 0);

  const pending = await run({
    mode: "real",
    held: [REAL_A, REAL_B],
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    maxPolls: 1,
    queryDelivery: async () => ({ ok: true, lastEvent: "sent" }),
  });
  assert.equal(pending.sends.length, 0);
  assert.deepEqual(pending.queries, ["msg-canary"]);
  assert.equal(pending.result.realSends, 0);

  const opened = await run({
    mode: "real",
    held: [REAL_A, EXTRA],
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    queryDelivery: async () => ({ ok: true, lastEvent: "delivered" }),
  });
  assert.deepEqual(opened.sends.map((row) => row.subscriberId), ["real-a", "extra-canary"]);
  assert.equal(opened.sends.some((row) => row.subscriberId === "canary"), false);
  assert.equal(opened.result.deliveredConfirmed, true);
});

test("queries use this edition's canary message only", async () => {
  const { result, queries, sends } = await run({
    ledger: [],
    maxPolls: 1,
    send: async ({ subscriberId }) => ({
      ok: true,
      id: subscriberId === "canary" ? "this-edition" : `id-${subscriberId}`,
    }),
    queryDelivery: async (messageId) => {
      if (messageId === "prior-edition-delivered") return { ok: true, lastEvent: "delivered" };
      return { ok: true, lastEvent: "sent" };
    },
  });
  assert.deepEqual(queries, ["this-edition"]);
  assert.equal(queries.includes("prior-edition-delivered"), false);
  assert.equal(result.realSends, 0);
  assert.equal(result.deliveredConfirmed, false);
  assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(sends[0]?.idempotencyKey, "newsletter-weekly-3/2026-11-02/canary");

  const otherEdition = await run({
    editionDate: "2026-10-26",
    issue: 2,
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "issue-3-delivered" }],
    maxPolls: 1,
    queryDelivery: async (messageId) => {
      assert.equal(messageId, "issue-3-delivered");
      return { ok: true, lastEvent: "sent" };
    },
  });
  assert.equal(otherEdition.sends.length, 0);
  assert.deepEqual(otherEdition.queries, ["issue-3-delivered"]);
  assert.equal(otherEdition.result.realSends, 0);
});

test("the weekly script gates live sends and leaves dry-run before transport", () => {
  const script = readFileSync(new URL("../../../scripts/newsletter-weekly.tsx", import.meta.url), "utf8");
  const runner = readFileSync(new URL("./weekly-run.ts", import.meta.url), "utf8");
  const transport = readFileSync(new URL("./transport.ts", import.meta.url), "utf8");
  const snapshot = script.indexOf("runWeeklySnapshot(");
  const created = script.indexOf("newsletterTransport()");
  assert.ok(snapshot !== -1 && created !== -1 && snapshot < created);
  assert.match(runner, /input\.dryRun \|\| input\.mode === "dry-run"/);
  assert.match(runner, /"canary" \| "real" \| "all"/);
  assert.match(runner, /edition-not-due/);
  assert.match(runner, /allPlan\.action === "noop"/);
  assert.match(script, /eq\(newsletterSend\.editionDate, editionDate\)/);
  assert.match(script, /previewWeeklyCanaryGate/);
  assert.match(script, /getDelivery/);
  assert.match(script, /claimAndSend/);
  assert.match(script, /sg-newsletter-weekly/);
  assert.match(script, /gateMode === "real"/);
  assert.match(script, /audience\.reals/);
  assert.match(script, /idempotencyKey/);
  assert.doesNotMatch(script, /sendMany\(/);
  assert.match(transport, /emails\.get\(messageId, \{ signal \}\)/);
  assert.match(transport, /last_event/);
  const mockStart = transport.indexOf("export function mockTransport");
  const liveStart = transport.indexOf("export function liveTransport");
  assert.ok(mockStart !== -1 && liveStart > mockStart);
  assert.doesNotMatch(transport.slice(mockStart, liveStart), /getDelivery/);
});

test("a timed-out delivery read aborts its signal", async () => {
  let saw: AbortSignal | undefined;
  const { result, sends } = await run({
    queryTimeoutMs: 20,
    queryDelivery: (_messageId, signal) => {
      saw = signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    },
  });
  assert.equal(saw?.aborted, true);
  assert.equal(result.exitCode, 7);
  assert.equal(result.realSends, 0);
  assert.equal(result.deliveredConfirmed, false);
  assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
  assert.match(String(result.log.error), /timed out/);
});

test("an illegal or overlong last_event is logged as unknown", async () => {
  const poison = `not-a-real-event ${"A".repeat(400)} raynlee@mail.grokbot.com re_livekey123`;
  const { result } = await run({
    maxPolls: 1,
    queryDelivery: async () => ({ ok: true, lastEvent: poison }),
  });
  assert.equal(sanitizeProviderEvent(poison), "unknown");
  assert.equal(result.lastEvent, "unknown");
  assert.equal(result.log.lastEvent, "unknown");
  assert.equal(result.realSends, 0);
  assert.equal(result.deliveredConfirmed, false);
  assert.equal(result.exitCode, 7);
  const dumped = JSON.stringify(result);
  assert.equal(dumped.includes(poison), false);
  assert.equal(dumped.includes("raynlee@"), false);
  assert.equal(dumped.includes("re_livekey123"), false);
  assert.equal(dumped.includes("A".repeat(80)), false);
});

test("a stored provider id is not resent when the sent-status write failed", async () => {
  const patches: Array<{ status?: "sent"; resendMessageId: string }> = [];
  const settled = await settleAcceptedSend("msg-canary", async (patch) => {
    patches.push(patch);
    if (patch.status === "sent") throw new Error("db status write failed");
  });
  assert.equal(settled.ok, false);
  if (settled.ok) return;
  assert.equal(settled.id, "msg-canary");
  assert.deepEqual(patches[1], { resendMessageId: "msg-canary" });

  const lost = await settleAcceptedSend("msg-canary", async () => {
    throw new Error("db down");
  });
  assert.equal(lost.ok, false);
  if (!lost.ok) assert.equal(lost.id, "msg-canary");

  const first = await run({
    send: async () => ({ ok: false, id: "msg-canary", error: "provider accepted but sent-status update failed" }),
  });
  assert.deepEqual(first.sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(first.sends[0]?.idempotencyKey, "newsletter-weekly-3/2026-11-02/canary");
  assert.equal(first.result.reason, "canary-ledger-persist-failed");
  assert.equal(first.result.realSends, 0);
  assert.equal(first.queries.length, 0);

  const second = await run({
    ledger: [{ subscriberId: "canary", status: "queued", resendMessageId: "msg-canary" }],
    maxPolls: 1,
    queryDelivery: async () => ({ ok: true, lastEvent: "sent" }),
  });
  assert.equal(second.sends.length, 0);
  assert.deepEqual(second.queries, ["msg-canary"]);
  assert.equal(second.result.realSends, 0);
  assert.equal(second.result.deliveredConfirmed, false);
});

test("explicit canary mode sends the preferred canary only", async () => {
  const { result, sends } = await run({
    mode: "canary",
    held: [EXTRA, REAL_A, REAL_B],
  });
  assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(sends[0]?.idempotencyKey, "newsletter-weekly-3/2026-11-02/canary");
  assert.equal(result.realSends, 0);
  assert.equal(result.exitCode, 0);
  assert.equal(result.deliveredConfirmed, false);
});

test("a provider error object sends zero real recipients", async () => {
  const poison = "mailbox raynlee@mail.grokbot.com rejected re_livekey123";
  const lookup = deliveryLookupFromProvider({ data: null, error: { message: poison } });
  assert.equal(lookup.ok, false);
  if (lookup.ok) return;
  assert.equal(lookup.error.includes("raynlee@"), false);
  assert.equal(lookup.error.includes("re_livekey123"), false);
  const { result, sends, queries } = await run({
    queryDelivery: async () => lookup,
  });
  assert.equal(result.exitCode, 7);
  assert.equal(result.reason, "delivery-query-error");
  assert.equal(result.realSends, 0);
  assert.deepEqual(sends.map((row) => row.subscriberId), ["canary"]);
  assert.equal(queries.length, 1);
  const dumped = JSON.stringify(result);
  assert.equal(dumped.includes("raynlee@"), false);
  assert.equal(dumped.includes("re_livekey123"), false);
});

test("script dry-run performs zero writes, sends, and delivery queries", async () => {
  let writes = 0;
  let sends = 0;
  let queries = 0;
  const outcome = await runWeeklySnapshot({
    mode: "all",
    dryRun: true,
    editionDate: "2026-11-02",
    today: "2026-11-02",
    eligibleIds: ["canary", "real-a"],
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    weeklyEnabled: true,
    sendMode: "live",
    unsubSecret: "secret",
    liveSend: async () => {
      writes += 1;
      sends += 1;
      queries += 1;
      throw new Error("dry-run invoked the live sender");
    },
  });
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.phase, "dry-run");
  assert.equal(writes, 0);
  assert.equal(sends, 0);
  assert.equal(queries, 0);
});

test("live real mode does not send before the edition day", async () => {
  let sends = 0;
  const early = await runWeeklySnapshot({
    mode: "real",
    dryRun: false,
    editionDate: "2026-11-02",
    today: "2026-11-09",
    eligibleIds: ["canary", "real-a"],
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    weeklyEnabled: true,
    sendMode: "live",
    unsubSecret: "secret",
    liveSend: async () => {
      sends += 1;
      return { exitCode: 0 };
    },
  });
  assert.equal(early.exitCode, 7);
  assert.equal(early.phase, "refused");
  assert.equal(early.reason, "edition-not-due");
  assert.equal(sends, 0);

  const later = await runWeeklySnapshot({
    mode: "all",
    dryRun: false,
    editionDate: "2026-11-02",
    today: "2026-11-09",
    eligibleIds: ["canary", "real-a"],
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    weeklyEnabled: true,
    sendMode: "live",
    unsubSecret: "secret",
    liveSend: async () => {
      sends += 1;
      return { exitCode: 0 };
    },
  });
  assert.equal(later.phase, "noop");
  assert.equal(later.exitCode, 0);
  assert.equal(sends, 0);

  const due = await runWeeklySnapshot({
    mode: "real",
    dryRun: false,
    editionDate: "2026-11-02",
    today: "2026-11-02",
    eligibleIds: ["canary", "real-a"],
    ledger: [{ subscriberId: "canary", status: "sent", resendMessageId: "msg-canary" }],
    weeklyEnabled: true,
    sendMode: "live",
    unsubSecret: "secret",
    liveSend: async () => {
      sends += 1;
      return { exitCode: 0 };
    },
  });
  assert.equal(due.phase, "send");
  assert.equal(sends, 1);
});

test("live canary mode is an explicit preferred-canary send", async () => {
  let mode = "";
  const outcome = await runWeeklySnapshot({
    mode: "canary",
    dryRun: false,
    editionDate: "2026-11-02",
    today: "2026-11-09",
    eligibleIds: ["canary", "real-a"],
    ledger: [],
    weeklyEnabled: true,
    sendMode: "live",
    unsubSecret: "secret",
    liveSend: async (args) => {
      mode = args.mode;
      return { exitCode: 0 };
    },
  });
  assert.equal(outcome.phase, "send");
  assert.equal(mode, "canary");

  let drySends = 0;
  const preview = await runWeeklySnapshot({
    mode: "canary",
    dryRun: true,
    editionDate: "2026-11-02",
    today: "2026-11-02",
    eligibleIds: ["canary"],
    ledger: [],
    weeklyEnabled: false,
    sendMode: "mock",
    liveSend: async () => {
      drySends += 1;
      return { exitCode: 0 };
    },
  });
  assert.equal(preview.exitCode, 0);
  assert.equal(preview.phase, "dry-run");
  assert.equal(drySends, 0);
});
