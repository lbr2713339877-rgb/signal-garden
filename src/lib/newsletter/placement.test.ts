import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DICT } from "@/lib/dict";
import {
  confirmStatusQuery,
  normalizeSubscribeLocation,
  subscribeAck,
  subscribeAnalyticsProps,
  subscribeResponse,
  todayInlineInsertIndex,
} from "./placement";

test("signup placements stay on the allowlist and today maps to the inline box", () => {
  assert.equal(normalizeSubscribeLocation("today"), "today_inline");
  assert.equal(normalizeSubscribeLocation("today_inline"), "today_inline");
  assert.equal(normalizeSubscribeLocation("project_bottom"), "project_bottom");
  assert.equal(normalizeSubscribeLocation("footer"), "footer");
  assert.equal(normalizeSubscribeLocation("home"), "home");
  assert.equal(normalizeSubscribeLocation("reader@example.com"), null);
  assert.equal(normalizeSubscribeLocation("javascript:alert(1)"), null);
  assert.deepEqual(subscribeAnalyticsProps("project_bottom", "direct"), {
    location: "project_bottom",
    page: "project",
    source: "direct",
  });
  assert.equal(subscribeAnalyticsProps("today_inline", "newsletter").location, "today_inline");
  assert.equal(subscribeAnalyticsProps("footer", "direct").page, "footer");
});

test("a successful response with sent false is not treated as a fresh send", () => {
  assert.equal(subscribeAck({ sent: true }), "sent");
  assert.equal(subscribeAck({ sent: false }), "already");
  assert.equal(subscribeAck({}), "sent");
  assert.equal(subscribeAck(null), "sent");
  assert.deepEqual(subscribeResponse({ ok: true, sent: false }), {
    status: 200,
    body: { ok: true, sent: false },
  });
  assert.deepEqual(subscribeResponse({ ok: true, sent: true }), {
    status: 200,
    body: { ok: true, sent: true },
  });
  assert.equal(subscribeResponse({ ok: false, error: "rate_limited" }).status, 429);
  assert.equal(subscribeResponse({ ok: false, error: "invalid_email" }).status, 400);
  assert.equal(DICT["newsletter.alreadyBody"][0], "已发过，请查收件箱");
  assert.notEqual(DICT["newsletter.alreadyBody"][0], DICT["newsletter.sent"][0]);
  assert.equal(DICT["newsletter.body"][0], "每周一 1 封：本周热度最高的 10 个 GitHub 新项目。免费，随时退订。");
  assert.equal(DICT["newsletter.sample"][0], "看第 1 期");
});

test("confirm redirect carries location and never a raw address", () => {
  assert.equal(confirmStatusQuery("confirmed", "footer"), "status=confirmed&loc=footer");
  assert.equal(confirmStatusQuery("confirmed", "today"), "status=confirmed&loc=today_inline");
  assert.equal(confirmStatusQuery("already", "nope"), "status=already");
  assert.doesNotMatch(confirmStatusQuery("confirmed", "a@b.c"), /@/);
});

test("the inline today box sits after the third card, or after the last when shorter", () => {
  assert.equal(todayInlineInsertIndex(10), 3);
  assert.equal(todayInlineInsertIndex(3), 3);
  assert.equal(todayInlineInsertIndex(2), 2);
  assert.equal(todayInlineInsertIndex(0), 0);
  const today = readFileSync(new URL("../../app/today/page.tsx", import.meta.url), "utf8");
  const project = readFileSync(new URL("../../app/p/[slug]/page.tsx", import.meta.url), "utf8");
  const footer = readFileSync(new URL("../../components/brand/FooterBrand.tsx", import.meta.url), "utf8");
  const form = readFileSync(new URL("../../components/v3/NewsletterForm.tsx", import.meta.url), "utf8");
  assert.match(today, /todayInlineInsertIndex/);
  assert.match(today, /location="today_inline"/);
  assert.match(project, /location="project_bottom"/);
  assert.match(footer, /location="footer"/);
  assert.match(form, /subscribe_submit/);
  assert.match(form, /subscribeAnalyticsProps/);
  assert.match(form, /href="\/weekly\/1"/);
  const home = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /location="home"/);
  const errors = form.split("\n").filter((line) => line.includes('trackEvent("subscribe_error"'));
  assert.equal(errors.length, 4);
  for (const line of errors) {
    assert.match(line, /\.\.\.analytics|\.\.\.subscribeAnalyticsProps\(location/);
  }
  assert.match(form, /trackEvent\("subscribe_submit", analytics\)/);
  const confirm = readFileSync(new URL("../../app/subscribe/confirm/page.tsx", import.meta.url), "utf8");
  assert.match(confirm, /event="subscribe_confirmed"/);
  assert.match(confirm, /\{ location \}/);
});
