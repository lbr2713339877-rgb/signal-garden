import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { weeklyIssueMetadata } from "./page-meta";
import { WEEKLY_ISSUE_1, WEEKLY_ISSUE_2, publicWeeklyIssues, weeklyIssueByNumber } from "./weekly-sample";

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
  assert.equal(weeklyIssueByNumber(2)?.issue, WEEKLY_ISSUE_2.issue);
  assert.equal(weeklyIssueByNumber(3), null);
  assert.deepEqual(
    publicWeeklyIssues().map((row) => [row.number, row.publishedOn]),
    [
      [1, WEEKLY_ISSUE_1.to],
      [2, WEEKLY_ISSUE_2.to],
    ],
  );
  const entries = readdirSync(new URL("../app/(site)/weekly", import.meta.url), { withFileTypes: true });
  assert.equal(entries.some((entry) => entry.name === "1"), false);
  assert.equal(entries.some((entry) => entry.name === "[issue]"), true);
  assert.match(page, /NewsletterSignup/);
  assert.match(page, /location="weekly"/);
  assert.match(page, /href="#subscribe"/);
  assert.match(page, /editorPick/);
  assert.match(page, /weekly\.heat/);
  assert.match(page, /SubscribeHash/);
});

test("issue 2 is the frozen max-heat Top 10 plus doop", () => {
  assert.equal(WEEKLY_ISSUE_2.issue, 2);
  assert.equal(WEEKLY_ISSUE_2.from, "2026-10-20");
  assert.equal(WEEKLY_ISSUE_2.to, "2026-10-26");
  assert.equal(WEEKLY_ISSUE_2.items.length, 10);
  assert.equal(WEEKLY_ISSUE_2.sponsor, true);
  assert.deepEqual(
    WEEKLY_ISSUE_2.items.map((item) => `${item.rank} ${item.slug} ${item.heat} ${item.starsLine}`),
    [
      "1 jetbrains-thinkrail 89 504 → 1.0k stars（+102.4%）",
      "2 cosmictaserdev-creator-convx 88 539 → 921 stars（+70.9%）",
      "3 juliobsz-skills 86 187 → 913 stars（+388.2%）",
      "4 lucasmarkes-hairline 86 317 → 2.7k stars（+761.5%）",
      "5 insane0777-awwwards-mcp 82 94 → 308 stars（+227.7%）",
      "6 leonxlnx-cinetic 82 78 → 813 stars（+942.3%）",
      "7 imskyleen-animate-ui 80 4.4k → 4.6k stars（+5.5%）",
      "8 axiomcodeai-axiomcodegraph 77 61 → 270 stars（+342.6%）",
      "9 el4cteo-blender-skills 76 11 → 450 stars（+3990.9%）",
      "10 activeing123-mcptoon 75 207 → 380 stars（+83.6%）",
    ],
  );
  assert.equal(WEEKLY_ISSUE_2.items[0]?.zh, "一个能根据你的工作习惯自动调整的轻量级IDE，专为AI编程助手设计。");
  assert.equal(
    WEEKLY_ISSUE_2.items[0]?.en,
    "ThinkRail is a lightweight IDE that adapts to your workflow and helps you code with AI through natural conversation, designed for Cursor users.",
  );
  assert.match(WEEKLY_ISSUE_2.editorNote?.zh ?? "", /AI coding skills \/ MCP \/ 动效与创意视频技能/);
  assert.match(WEEKLY_ISSUE_2.editorNote?.en ?? "", /motion\/creative-video skills/);
  assert.match(WEEKLY_ISSUE_2.editorNote?.zh ?? "", /Convx/);
  const pick = WEEKLY_ISSUE_2.editorPick;
  assert.ok(pick);
  assert.equal(pick.slug, "kgoedecke-doop");
  assert.equal(pick.name, "doop");
  assert.equal(pick.heat, 73);
  assert.equal(pick.peakDate, "2026-10-22");
  assert.equal(pick.starsLine, "792 → 957 stars（+20.8%）");
  assert.equal(pick.zh, "开源的多人在线设计画布，人类和AI代理能一起实时编辑。");
  assert.match(pick.reasonZh, /人机共创画布/);
  assert.equal(WEEKLY_ISSUE_2.items.some((item) => item.slug === "kgoedecke-doop"), false);
  for (const item of [...WEEKLY_ISSUE_2.items, pick]) {
    assert.equal(
      item.href,
      `/p/${item.slug}?utm_source=email&utm_medium=weekly&utm_campaign=weekly-2`,
    );
    assert.ok(item.zh.length > 0);
    assert.ok(item.en.length > 0);
  }
  assert.doesNotMatch(JSON.stringify(WEEKLY_ISSUE_2), BANNED);

  const meta = weeklyIssueMetadata(WEEKLY_ISSUE_2, "https://signalgarden.site");
  assert.equal(meta.alternates?.canonical, "https://signalgarden.site/weekly/2");
  assert.match(String(meta.description), /第 2 期/);
  assert.match(String(meta.description), /2026-10-20 – 2026-10-26/);
  const ogImage = Array.isArray(meta.openGraph?.images) ? meta.openGraph.images[0] : meta.openGraph?.images;
  const ogUrl = typeof ogImage === "string" ? ogImage : ogImage && typeof ogImage === "object" && "url" in ogImage ? String(ogImage.url) : "";
  assert.equal(ogUrl, "https://signalgarden.site/weekly/2/opengraph-image");
  assert.equal(meta.twitter && "card" in meta.twitter ? meta.twitter.card : undefined, "summary_large_image");
});
