import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DICT } from "@/lib/dict";
import {
  confirmStatusQuery,
  normalizeSubscribeLocation,
  resendAnalytics,
  subscribeAck,
  subscribeAnalyticsProps,
  subscribeResponse,
  todayInlineInsertIndex,
} from "./placement";

test("signup placements stay on the allowlist and today maps to the inline box", () => {
  assert.equal(normalizeSubscribeLocation("today"), "today_inline");
  assert.equal(normalizeSubscribeLocation("today_inline"), "today_inline");
  assert.equal(normalizeSubscribeLocation("project_bottom"), "project_bottom");
  assert.equal(normalizeSubscribeLocation("project_cta"), "project_cta");
  assert.equal(normalizeSubscribeLocation("footer"), "footer");
  assert.equal(normalizeSubscribeLocation("home"), "home");
  assert.equal(normalizeSubscribeLocation("reader@example.com"), null);
  assert.equal(normalizeSubscribeLocation("javascript:alert(1)"), null);
  assert.deepEqual(subscribeAnalyticsProps("project_bottom", "direct"), {
    location: "project_bottom",
    page: "project",
    source: "direct",
  });
  assert.deepEqual(subscribeAnalyticsProps("project_cta", "direct"), {
    location: "project_cta",
    page: "project",
    source: "direct",
  });
  assert.equal(subscribeAnalyticsProps("today_inline", "newsletter").location, "today_inline");
  assert.equal(subscribeAnalyticsProps("footer", "direct").page, "footer");
});

test("a successful response with sent false is not treated as a fresh send", () => {
  assert.equal(subscribeAck({ sent: true }), "sent");
  assert.equal(subscribeAck({ sent: false }), "limited");
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
  assert.equal(
    DICT["newsletter.body"][1],
    "One email each Monday: the 10 hottest new GitHub projects this week. Free, unsubscribe any time.",
  );
  assert.equal(DICT["newsletter.sample"][0], "看第 1 期");
  assert.equal(DICT["newsletter.confirmHeading"][0], "还差一步：去邮箱点确认链接");
  assert.equal(DICT["newsletter.confirmHeading"][1], "One step left: open your inbox and tap the confirm link");
  assert.doesNotMatch(DICT["newsletter.confirmHeading"][1], /[\u4e00-\u9fff]/);
  assert.equal(DICT["newsletter.limited"][0], "已发送过多次，请查看已有邮件或稍后再试");
  assert.equal(DICT["newsletter.resend"][0], "没收到？重发");
  assert.equal(DICT["newsletter.confirmSpam"][0], "如果没看到，请到垃圾箱和推广邮件里找。");
  assert.match(DICT["newsletter.confirmSpam"][1], /spam and promotions/);
});

test("confirm redirect carries location and never a raw address", () => {
  assert.equal(confirmStatusQuery("confirmed", "footer"), "status=confirmed&loc=footer");
  assert.equal(confirmStatusQuery("confirmed", "today"), "status=confirmed&loc=today_inline");
  assert.equal(confirmStatusQuery("confirmed", "project_cta"), "status=confirmed&loc=project_cta");
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
  assert.match(project, /location="project_cta"/);
  const ctaAt = project.indexOf('location="project_cta"');
  const bottomAt = project.indexOf('location="project_bottom"');
  assert.ok(ctaAt > 0 && bottomAt > ctaAt);
  const hero = project.slice(project.indexOf("mt-10 flex flex-col"), ctaAt);
  assert.match(hero, /flex-col/);
  assert.match(hero, /lg:flex-row/);
  assert.match(hero, /shrink-0/);
  assert.match(hero, /whitespace-nowrap/);
  assert.match(hero, /pd\.hero\.openRepo/);
  assert.match(footer, /location="footer"/);
  assert.match(form, /subscribe_submit/);
  assert.match(form, /subscribeAnalyticsProps/);
  assert.match(form, /source: location/);
  assert.match(form, /location === "project_cta"/);
  assert.match(form, /newsletter\.body/);
  assert.match(form, /href="\/weekly\/1"/);
  const home = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /location="home"/);
  const errors = form.split("\n").filter((line) => line.includes('trackEvent("subscribe_error"'));
  assert.equal(errors.length, 4);
  for (const line of errors) {
    assert.match(line, /\.\.\.analytics|\.\.\.subscribeAnalyticsProps\(location/);
  }
  assert.match(form, /const analytics = subscribeAnalyticsProps\(location, currentUtmSource\(\)\)/);
  assert.match(form, /trackEvent\("subscribe_submit", analytics\)/);
  assert.match(form, /subscribeAck\(body\) === "limited"/);
  assert.match(form, /message === "ok" \? \(/);
  assert.match(form, /<ConfirmStep/);
  assert.match(form, /message === "limited" \? <T k="newsletter\.limited"/);
  assert.doesNotMatch(form.slice(form.indexOf('message === "limited"')), /ConfirmStep/);
  assert.match(form, /CONFIRM_SUBJECT/);
  assert.match(form, /CONFIRM_FROM_ADDRESS/);
  assert.match(form, /from "@\/lib\/newsletter\/confirm-copy"/);
  assert.match(form, /mailboxUrl\(email\)/);
  assert.match(form, /resendCooldownSeconds\(\)/);
  assert.match(form, /trackEvent\("subscribe_resend", resendAnalytics\(location, currentUtmSource\(\), sent\)\)/);
  assert.deepEqual(resendAnalytics("footer", "direct", true), {
    location: "footer",
    page: "footer",
    source: "direct",
    outcome: "sent",
  });
  assert.deepEqual(resendAnalytics("project_cta", "newsletter", false), {
    location: "project_cta",
    page: "project",
    source: "newsletter",
    outcome: "limited",
  });
  assert.equal(subscribeAnalyticsProps("project_cta", "newsletter").location, "project_cta");
  const confirm = readFileSync(new URL("../../app/subscribe/confirm/page.tsx", import.meta.url), "utf8");
  assert.match(confirm, /event="subscribe_confirmed"/);
  assert.match(confirm, /\{ location \}/);
});
