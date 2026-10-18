import assert from "node:assert/strict";
import { test } from "node:test";
import { newsletterStatusEnum } from "@/db/schema";
import {
  NEWSLETTER_STATUSES,
  afterDeliveryEvent,
  confirmOutcome,
  editionSendDecision,
  sendStatusAfterEvent,
  subscribeAction,
  unsubscribeOutcome,
} from "./state";

test("subscriber statuses match the database enum", () => {
  assert.deepEqual([...newsletterStatusEnum.enumValues], [...NEWSLETTER_STATUSES]);
});

test("signup state machine", () => {
  assert.equal(subscribeAction(null), "create");
  assert.equal(subscribeAction("pending"), "refresh");
  assert.equal(subscribeAction("unsubscribed"), "refresh");
  assert.equal(subscribeAction("active"), "ignore");
  assert.equal(subscribeAction("bounced"), "blocked");
  assert.equal(subscribeAction("complained"), "blocked");
});

test("confirm requires a click on a live pending token", () => {
  assert.equal(confirmOutcome("pending", false), "confirmed");
  assert.equal(confirmOutcome("pending", true), "expired");
  assert.equal(confirmOutcome("active", false), "already");
  assert.equal(confirmOutcome("active", true), "already");
  assert.equal(confirmOutcome("unsubscribed", false), "rejected");
  assert.equal(confirmOutcome("bounced", false), "rejected");
});

test("unsubscribe is idempotent and does not clear a suppression", () => {
  assert.equal(unsubscribeOutcome("pending"), "unsubscribed");
  assert.equal(unsubscribeOutcome("active"), "unsubscribed");
  assert.equal(unsubscribeOutcome("unsubscribed"), "already");
  assert.equal(unsubscribeOutcome("bounced"), "suppressed");
  assert.equal(unsubscribeOutcome("complained"), "suppressed");
});

test("delivery events only move a subscriber on hard bounce or complaint", () => {
  assert.equal(afterDeliveryEvent("active", "hard_bounce"), "bounced");
  assert.equal(afterDeliveryEvent("active", "complaint"), "complained");
  assert.equal(afterDeliveryEvent("complained", "hard_bounce"), "complained");
  assert.equal(afterDeliveryEvent("bounced", "complaint"), "complained");
  assert.equal(afterDeliveryEvent("active", "soft_bounce"), "active");
  assert.equal(afterDeliveryEvent("active", "delivered"), "active");
  assert.equal(afterDeliveryEvent("active", "failed"), "active");
  assert.equal(sendStatusAfterEvent("delivered"), "sent");
  assert.equal(sendStatusAfterEvent("failed"), "failed");
  assert.equal(sendStatusAfterEvent("hard_bounce"), "bounced");
  assert.equal(sendStatusAfterEvent("soft_bounce"), null);
});

test("edition send skips a short list and any date that is not today", () => {
  const base = { editionDate: "2026-10-17", isPrevious: false, count: 10, today: "2026-10-17", limit: 10 };
  assert.equal(editionSendDecision(base), "ok");
  assert.equal(editionSendDecision({ ...base, count: 9 }), "short");
  assert.equal(editionSendDecision({ ...base, editionDate: "2026-10-16" }), "wrong_date");
  assert.equal(editionSendDecision({ ...base, isPrevious: true }), "wrong_date");
});
