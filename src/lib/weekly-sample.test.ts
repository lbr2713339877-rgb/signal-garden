import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { WEEKLY_ISSUE_1, publicWeeklyIssues, weeklyIssueByNumber } from "./weekly-sample";

const BANNED = /unsubscribe|resend|subscriber|email_hash|@|List-Unsubscribe|\?t=/i;

test("issue 1 is a public 10-item week with no subscriber data", () => {
  assert.equal(WEEKLY_ISSUE_1.issue, 1);
  assert.equal(WEEKLY_ISSUE_1.from, "2026-10-13");
  assert.equal(WEEKLY_ISSUE_1.to, "2026-10-19");
  assert.equal(WEEKLY_ISSUE_1.items.length, 10);
  assert.deepEqual(
    WEEKLY_ISSUE_1.items.map((item) => `${item.labelZh} ${item.name}`),
    [
      "10/19 榜首 ascii",
      "10/19 第 2 名 animate",
      "10/18 榜首 herk-edit-kit",
      "10/18 第 2 名 dsh-ops",
      "10/17 榜首 filmcraft",
      "10/17 第 2 名 OpenCreator",
      "10/16 榜首 tegaki",
      "10/15 榜首 awesome-ai-motion",
      "10/14 榜首 replica-skill",
      "10/13 榜首 gstack",
    ],
  );
  for (const item of WEEKLY_ISSUE_1.items) {
    assert.match(item.href, /^\/p\/[a-z0-9-]+$/);
    assert.equal(item.href, `/p/${item.slug}`);
    assert.doesNotMatch(`${item.zh} ${item.en} ${item.href}`, BANNED);
  }
  const page = readFileSync(new URL("../app/(site)/weekly/[issue]/page.tsx", import.meta.url), "utf8");
  const sample = readFileSync(new URL("./weekly-sample.ts", import.meta.url), "utf8");
  assert.match(page, /weeklyIssueByNumber/);
  assert.match(page, /weeklyIssueMetadata/);
  assert.doesNotMatch(page, /newsletterSubscriber|resend|unsubscribe|getFeedEdition|@\/db/);
  assert.doesNotMatch(sample, /newsletterSubscriber|resend|unsubscribe|process\.env/);
  assert.doesNotMatch(JSON.stringify(WEEKLY_ISSUE_1), BANNED);
});

test("every public issue is one /weekly/[issue] route", () => {
  const page = readFileSync(new URL("../app/(site)/weekly/[issue]/page.tsx", import.meta.url), "utf8");
  const image = readFileSync(new URL("../app/weekly/[issue]/opengraph-image.tsx", import.meta.url), "utf8");
  assert.match(page, /generateStaticParams/);
  assert.match(page, /publicWeeklyIssues/);
  assert.match(image, /weeklyIssueByNumber/);
  assert.match(image, /renderWeeklyOg/);
  assert.equal(weeklyIssueByNumber(1)?.issue, WEEKLY_ISSUE_1.issue);
  assert.equal(weeklyIssueByNumber(2), null);
  assert.equal(publicWeeklyIssues()[0]?.publishedOn, WEEKLY_ISSUE_1.to);
  const entries = readdirSync(new URL("../app/(site)/weekly", import.meta.url), { withFileTypes: true });
  assert.equal(entries.some((entry) => entry.name === "1"), false);
  assert.equal(entries.some((entry) => entry.name === "[issue]"), true);
});
