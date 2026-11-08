import assert from "node:assert/strict";
import { test } from "node:test";
import { Resend } from "resend";

test("installed resend sdk passes AbortSignal to fetch for send and get", async () => {
  const calls: Array<{ url: string; signal: AbortSignal | undefined }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), signal: init?.signal ?? undefined });
    const url = String(input);
    const body = url.endsWith("/emails")
      ? { id: "email_abort_probe" }
      : { id: "email_abort_probe", object: "email", last_event: "sent" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const resend = new Resend("re_test_not_a_live_key");
    const controller = new AbortController();
    const sent = await resend.emails.send({
      from: "Signal Garden <hello@signalgarden.site>",
      to: "canary@example.com",
      subject: "abort probe",
      html: "<p>probe</p>",
      text: "probe",
    }, { idempotencyKey: "abort-probe", signal: controller.signal });
    const got = await resend.emails.get("email_abort_probe", { signal: controller.signal });
    assert.equal(sent.error, null);
    assert.equal(got.error, null);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.signal, controller.signal);
    assert.equal(calls[1]?.signal, controller.signal);
    assert.match(calls[0]?.url ?? "", /\/emails$/);
    assert.match(calls[1]?.url ?? "", /\/emails\/email_abort_probe$/);
  } finally {
    globalThis.fetch = original;
  }
});
