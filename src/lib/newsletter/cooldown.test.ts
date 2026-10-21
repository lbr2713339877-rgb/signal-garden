import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RESEND_COOLDOWN_MS, resendCooldownRemaining, resendCooldownSeconds } from "./resend-policy";

test("resend cooldown remaining time comes from the deadline", () => {
  const now = 1_700_000_000_000;
  const deadline = now + RESEND_COOLDOWN_MS;
  assert.equal(resendCooldownRemaining(deadline, now), resendCooldownSeconds());
  assert.equal(resendCooldownRemaining(deadline, now + 10_000), 50);
  assert.equal(resendCooldownRemaining(deadline, now + 58_500), 2);
  assert.equal(resendCooldownRemaining(deadline, now + 59_001), 1);
  assert.equal(resendCooldownRemaining(deadline, deadline), 0);
  assert.equal(resendCooldownRemaining(deadline, deadline + 5_000), 0);
  assert.equal(resendCooldownRemaining(Number.NaN, now), 0);
});

test("the subscribe resend countdown ticks from a stored deadline", () => {
  const form = readFileSync(new URL("../../components/v3/NewsletterForm.tsx", import.meta.url), "utf8");
  assert.match(form, /Date\.now\(\) \+ resendCooldownSeconds\(\) \* 1000/);
  assert.match(form, /resendCooldownRemaining\(resendDeadline, Date\.now\(\)\)/);
  assert.match(form, /window\.setInterval\(tick, 1000\)/);
  assert.doesNotMatch(form, /value - 1|cooldown - 1|setCooldown\(\(value\)/);
});
