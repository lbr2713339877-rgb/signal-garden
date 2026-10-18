import assert from "node:assert/strict";
import { test } from "node:test";
import { turnstileCode, verifyTurnstile } from "./turnstile";

test("turnstile codes stay short cloudflare tokens", () => {
  assert.equal(turnstileCode("timeout-or-duplicate"), "timeout-or-duplicate");
  assert.equal(turnstileCode(" Invalid-Input-Response "), "invalid-input-response");
  assert.equal(turnstileCode("has space"), "failed");
  assert.equal(turnstileCode(undefined), "failed");
});

test("siteverify keeps the cloudflare error-code and skips the network when the token is empty", async () => {
  let called = false;
  const empty = await verifyTurnstile({
    token: "  ",
    secret: "secret",
    fetchImpl: async () => {
      called = true;
      return new Response("{}");
    },
  });
  assert.equal(called, false);
  assert.deepEqual(empty, { status: "failed", code: "missing-input-response" });

  const failed = await verifyTurnstile({
    token: "spent-token",
    secret: "secret",
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), {
        headers: { "content-type": "application/json" },
      }),
  });
  assert.deepEqual(failed, { status: "failed", code: "timeout-or-duplicate" });

  const ok = await verifyTurnstile({
    token: "fresh-token",
    secret: "secret",
    fetchImpl: async () => new Response(JSON.stringify({ success: true })),
  });
  assert.deepEqual(ok, { status: "ok" });

  const skipped = await verifyTurnstile({ token: "", secret: "" });
  assert.deepEqual(skipped, { status: "skipped" });
});
