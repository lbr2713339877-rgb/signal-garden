import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DICT } from "@/lib/dict";
import { renderConfirmMail, renderDailyMail, renderWelcomeDigest } from "@/emails/render-newsletter";
import { newsletterFormEnabled } from "./flags";
import { listUnsubscribeHeaders } from "./headers";
import {
  DEFAULT_NEWSLETTER_FROM,
  DEFAULT_NEWSLETTER_REPLY_TO,
  mockTransport,
  newsletterFrom,
  newsletterReplyTo,
  newsletterSendMode,
  resetNewsletterOutbox,
} from "./transport";

const site = "https://signalgarden.site";
const token = "abcdefghijklmnopqrstuvwxyz0123456789AB";

test("list-unsubscribe headers include the one-click POST target and a mailto", () => {
  const headers = listUnsubscribeHeaders(site, token);
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(headers["List-Unsubscribe"], new RegExp(`<${site}/api/unsubscribe\\?t=${token}>`));
  assert.match(headers["List-Unsubscribe"], /<mailto:unsubscribe@signalgarden\.site\?subject=unsub>/);
});

test("default From and Reply-To are hello@signalgarden.site and can be overridden", () => {
  const previousFrom = process.env.NEWSLETTER_FROM;
  const previousReply = process.env.NEWSLETTER_REPLY_TO;
  delete process.env.NEWSLETTER_FROM;
  delete process.env.NEWSLETTER_REPLY_TO;
  try {
    assert.equal(newsletterFrom(), DEFAULT_NEWSLETTER_FROM);
    assert.equal(newsletterReplyTo(), DEFAULT_NEWSLETTER_REPLY_TO);
    assert.equal(newsletterFrom("daily@signalgarden.site"), "Signal Garden <daily@signalgarden.site>");
    assert.equal(newsletterReplyTo("reply@signalgarden.site"), "reply@signalgarden.site");
    assert.throws(() => newsletterFrom("bad\nfrom"));
  } finally {
    if (previousFrom === undefined) delete process.env.NEWSLETTER_FROM;
    else process.env.NEWSLETTER_FROM = previousFrom;
    if (previousReply === undefined) delete process.env.NEWSLETTER_REPLY_TO;
    else process.env.NEWSLETTER_REPLY_TO = previousReply;
  }
});

test("transport stays mock unless live mode and an API key are both set", () => {
  assert.equal(newsletterSendMode({}), "mock");
  assert.equal(newsletterSendMode({ mode: "live" }), "mock");
  assert.equal(newsletterSendMode({ apiKey: "re_test" }), "mock");
  assert.equal(newsletterSendMode({ mode: "live", apiKey: "re_test" }), "live");
});

test("the signup form is hidden unless the public flag is exactly true", () => {
  assert.equal(newsletterFormEnabled(""), false);
  assert.equal(newsletterFormEnabled("false"), false);
  assert.equal(newsletterFormEnabled("1"), false);
  assert.equal(newsletterFormEnabled("true"), true);
});

test("mock transport logs one message per idempotency key and keeps From and Reply-To", async () => {
  resetNewsletterOutbox();
  const transport = mockTransport();
  const headers = listUnsubscribeHeaders(site, token);
  const mail = {
    to: "reader@example.com",
    subject: "Signal Garden Monday weekly digest",
    html: "<p>hi</p>",
    text: "hi",
    headers,
    idempotencyKey: "newsletter/2026-10-17/same",
  };
  const first = await transport.send(mail);
  const second = await transport.send(mail);
  assert.equal(first.id, second.id);
  const { newsletterOutbox } = await import("./transport");
  assert.equal(newsletterOutbox().length, 1);
  assert.equal(newsletterOutbox()[0].from, DEFAULT_NEWSLETTER_FROM);
  assert.equal(newsletterOutbox()[0].replyTo, DEFAULT_NEWSLETTER_REPLY_TO);
  assert.equal(newsletterOutbox()[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("confirm, welcome and daily letters include an unsubscribe footer in both languages", async () => {
  const shared = {
    unsubscribeUrl: `${site}/unsubscribe?t=${token}`,
    siteUrl: site,
  };
  const mails = [
    await renderConfirmMail({ ...shared, locale: "zh", confirmUrl: `${site}/subscribe/confirm?t=${token}` }),
    await renderConfirmMail({ ...shared, locale: "en", confirmUrl: `${site}/subscribe/confirm?t=${token}` }),
    await renderWelcomeDigest({ ...shared, locale: "zh", todayUrl: `${site}/today` }),
    await renderWelcomeDigest({ ...shared, locale: "en", todayUrl: `${site}/today` }),
    await renderDailyMail({
      ...shared,
      locale: "zh",
      date: "2026-10-17",
      items: [{ rank: 1, name: "Example", oneLiner: "一句话。", forks7d: 4, href: `${site}/p/example` }],
    }),
    await renderDailyMail({
      ...shared,
      locale: "en",
      date: "2026-10-17",
      items: [{ rank: 1, name: "Example", oneLiner: "One sentence.", forks7d: 4, href: `${site}/p/example` }],
    }),
  ];
  for (const mail of mails) {
    assert.match(mail.html, new RegExp(`href="${site}/unsubscribe\\?t=${token}"`));
    assert.match(mail.text, new RegExp(`${site}/unsubscribe\\?t=${token}`));
    assert.match(mail.html, /hello@signalgarden\.site/);
    assert.match(mail.text, /Signal Garden/);
  }
  assert.match(mails[0].subject, /确认/);
  assert.doesNotMatch(mails[1].html, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(mails[1].text, /[\u4e00-\u9fff]/);
  assert.match(mails[4].html, /一句话/);
  assert.match(mails[4].text, /7 日新增 fork 4/);
  assert.match(mails[5].html, /One sentence/);
  assert.match(mails[5].text, /4 new forks in 7 days/);
  assert.match(mails[5].html, /href="https:\/\/signalgarden\.site\/p\/example"/);
  assert.match(mails[0].text, /按近期 star 增长等热度信号排序/);
  assert.match(mails[1].text, /ranked by recent star growth and other momentum signals/);
  assert.doesNotMatch(mails[1].text, /star\/fork growth/);
});

test("a missing 7-day fork count is omitted from the digest", async () => {
  const mail = await renderDailyMail({
    unsubscribeUrl: `${site}/unsubscribe?t=${token}`,
    siteUrl: site,
    locale: "en",
    date: "2026-10-17",
    items: [{ rank: 1, name: "Example", oneLiner: "One sentence.", forks7d: null, href: `${site}/p/example` }],
  });
  assert.match(mail.text, /One sentence/);
  assert.doesNotMatch(mail.text, /new forks/);
  assert.doesNotMatch(mail.text, /unavailable/i);
  assert.doesNotMatch(mail.html, /暂无/);
});

test("newsletter is a manual job, not a step in the daily schedule", () => {
  const source = readFileSync(new URL("../../jobs/cli.ts", import.meta.url), "utf8");
  const steps = source.slice(source.indexOf("const DAILY_STEPS"), source.indexOf("] as const;"));
  assert.doesNotMatch(steps, /newsletter/);
  assert.match(source, /newsletter:\s*\(\)\s*=>\s*runJob\("newsletter"/);
});

test("privacy draft covers the digest and the page date moved", () => {
  for (const key of [
    "privacy.newsletterP1",
    "privacy.newsletterP2",
    "privacy.newsletterP3",
    "privacy.newsletterP4",
    "privacy.newsletterP5",
    "privacy.share5",
  ] as const) {
    assert.match(DICT[key][0], /[\u4e00-\u9fff]/);
    assert.doesNotMatch(DICT[key][1], /[\u4e00-\u9fff]/);
  }
  assert.match(DICT["privacy.newsletterP1"][0], /哈希/);
  assert.match(DICT["privacy.newsletterP1"][1], /hash of the IP address/);
  assert.match(DICT["privacy.newsletterP3"][1], /United States or Japan/);
  assert.match(DICT["privacy.newsletterP3"][1], /do not enable open tracking/);
  assert.match(DICT["privacy.newsletterP4"][1], /one click/i);
  assert.match(DICT["privacy.newsletterP5"][0], /30 天/);
  assert.match(DICT["privacy.newsletterP5"][1], /keep only a hash/);
  const page = readFileSync(new URL("../../app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(page, /updated="2026-10-17"/);
});
