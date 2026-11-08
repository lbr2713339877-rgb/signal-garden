import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { WEEKLY_ISSUE_1, WEEKLY_ISSUE_2, WEEKLY_ISSUE_3 } from "@/lib/weekly-sample";
import { renderWeeklyLockMail } from "@/emails/weekly-lock";
import {
  WEEKLY_LOCK_PREHEADER,
  classifyWeeklyRecipient,
  isConfirmedActive,
  isCuratedWeeklyIssue,
  parseWeeklyCli,
  planWeeklyAllSend,
  preferredCanary,
  publishedWeeklyMailIssue,
  splitWeeklyAudience,
  weeklyIdempotencyKey,
  weeklyLockSubject,
  weeklyPlainCopy,
  weeklySendBlocker,
  weeklyWebUrl,
} from "./weekly-lock";

const ISSUE_3_SUBJECT = "Signal Garden 周刊 #3｜本周热度最高的 10 个 GitHub 新项目（10/27–11/02）";
const ISSUE_3_EDITOR_ZH =
  "本周热度分榜上，设计/动效 skills、视频工具链、可安装 agent 技能扎堆：design-agent、impeccable、claude-skill、reanimate、EAC-design-world、brand-identity-skill、awesome-gamedev-agent-skills 都在给助手加「设计判断 / 动画克隆 / 成片」能力；榜首 DeepSeekBot 是带长期记忆的桌面 Bot 团队，中间还插进了一个清理安卓电视的 cleanyourtv，提醒日榜并不只围着 coding agent 转。";

test("issue 3 subject, preheader, and editor note match the sent lock", () => {
  assert.equal(weeklyLockSubject(WEEKLY_ISSUE_3), ISSUE_3_SUBJECT);
  assert.equal(weeklyLockSubject(WEEKLY_ISSUE_3).includes("\u2013"), true);
  assert.equal(weeklyLockSubject(WEEKLY_ISSUE_3).includes("\uFF5C"), true);
  assert.equal(
    weeklyLockSubject(WEEKLY_ISSUE_2),
    "Signal Garden 周刊 #2｜本周热度最高的 10 个 GitHub 新项目（10/20–10/26）",
  );
  assert.equal(WEEKLY_LOCK_PREHEADER, "每周一 1 封：本周热度最高的 10 个 GitHub 新项目。免费，随时退订。");
  assert.equal(weeklyPlainCopy(WEEKLY_ISSUE_3.editorNote?.zh ?? ""), ISSUE_3_EDITOR_ZH);
  assert.equal(weeklyPlainCopy(WEEKLY_ISSUE_3.editorNote?.zh ?? "").includes("**"), false);
  assert.equal(WEEKLY_ISSUE_3.to, "2026-11-02");
  assert.equal(weeklyIdempotencyKey(3, WEEKLY_ISSUE_3.to, "subscriber-1"), "newsletter-weekly-3/2026-11-02/subscriber-1");
  assert.equal(
    weeklyWebUrl("https://signalgarden.site", 3),
    "https://signalgarden.site/weekly/3?utm_source=email&utm_medium=weekly&utm_campaign=weekly-3",
  );
});

test("the mailer uses the latest curated lock and refuses the daily-rank issue", () => {
  assert.equal(isCuratedWeeklyIssue(WEEKLY_ISSUE_1), false);
  assert.equal(isCuratedWeeklyIssue(WEEKLY_ISSUE_2), true);
  assert.equal(isCuratedWeeklyIssue(WEEKLY_ISSUE_3), true);
  const latest = publishedWeeklyMailIssue();
  assert.ok(latest);
  assert.equal(latest.issue, WEEKLY_ISSUE_3.issue);
  assert.equal(latest.items[0]?.name, "DeepSeekBot");
  assert.equal(latest.items[9]?.name, "impeccable");
  assert.equal(latest.editorPick?.name, "chaojifeng-video-design");
  assert.equal(latest.items.some((item) => item.labelZh.includes("榜首")), false);
});

test("rendered issue 3 mail carries the lock, campaign, and unsubscribe link", async () => {
  const unsub = "https://signalgarden.site/unsubscribe?t=preview-token";
  const mail = await renderWeeklyLockMail(WEEKLY_ISSUE_3, "https://signalgarden.site", unsub);
  assert.equal(mail.subject, ISSUE_3_SUBJECT);
  assert.match(mail.html, /DeepSeekBot/);
  assert.match(mail.html, /impeccable/);
  assert.match(mail.html, /chaojifeng-video-design/);
  assert.match(mail.html, /utm_campaign=weekly-3/);
  assert.match(mail.html, /preview-token/);
  assert.match(mail.text, /DeepSeekBot/);
  assert.match(mail.text, /chaojifeng-video-design/);
  assert.match(mail.text, /选它的理由：贴本周 video \/ design-skill 主题/);
  assert.doesNotMatch(`${mail.html}\n${mail.text}`, /mcptoon|\*\*|第 \d+ 名|\d+\/\d+ 榜首/);
  assert.equal(mail.text.includes(ISSUE_3_EDITOR_ZH), true);
});

test("audience split keeps the grokbot canary and drops test rows", () => {
  assert.equal(classifyWeeklyRecipient({ email: "RaynLee@mail.grokbot.com", source: null, utmSource: null }), "canary");
  assert.equal(classifyWeeklyRecipient({ email: "lin@foxmail.com", source: "footer", utmSource: null }), "real");
  assert.equal(classifyWeeklyRecipient({ email: "lbr2713339877@gmail.com", source: null, utmSource: null }), "excluded");
  assert.equal(classifyWeeklyRecipient({ email: "a@resend.dev", source: null, utmSource: null }), "excluded");
  assert.equal(classifyWeeklyRecipient({ email: "a@example.com", source: "manual-test", utmSource: null }), "excluded");
  assert.equal(classifyWeeklyRecipient({ email: "a@example.com", source: "footer", utmSource: "team-test" }), "excluded");
  assert.equal(isConfirmedActive("active", new Date(), "a@example.com"), true);
  assert.equal(isConfirmedActive("pending", new Date(), "a@example.com"), false);
  assert.equal(isConfirmedActive("active", null, "a@example.com"), false);
  assert.equal(isConfirmedActive("active", new Date(), null), false);

  const split = splitWeeklyAudience([
    { id: "other", email: "ops@mail.grokbot.com", source: null, utmSource: null },
    { id: "ray", email: "raynlee@mail.grokbot.com", source: null, utmSource: null },
    { id: "real", email: "lin@foxmail.com", source: "footer", utmSource: null },
    { id: "drop", email: "a@resend.dev", source: null, utmSource: null },
  ]);
  assert.deepEqual(split.canaries.map((row) => row.id), ["ray", "other"]);
  assert.deepEqual(split.reals.map((row) => row.id), ["real"]);
  assert.equal(preferredCanary(split.canaries)?.id, "ray");
  assert.equal(split.excluded.length, 1);
});

test("cron --all no-ops when the edition is not due or already mailed", () => {
  const eligible = ["canary", "real"];
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-02",
      eligibleIds: eligible,
      rows: [],
    }),
    { action: "send", subscriberIds: eligible },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-02",
      eligibleIds: eligible,
      rows: [
        { subscriberId: "canary", status: "sent", resendMessageId: "canary-id" },
        { subscriberId: "real", status: "sent", resendMessageId: "real-id" },
      ],
    }),
    { action: "noop", reason: "already-mailed" },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-02",
      eligibleIds: eligible,
      rows: [
        { subscriberId: "canary", status: "sent", resendMessageId: "canary-id" },
        { subscriberId: "real", status: "failed" },
      ],
    }),
    { action: "send", subscriberIds: ["real"] },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-02",
      eligibleIds: eligible,
      rows: [
        { subscriberId: "canary", status: "sent", resendMessageId: "canary-id" },
        { subscriberId: "real", status: "failed", resendMessageId: "real-id" },
      ],
    }),
    { action: "noop", reason: "already-mailed" },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-09",
      eligibleIds: eligible,
      rows: [],
    }),
    { action: "noop", reason: "edition-not-due" },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-09",
      eligibleIds: [...eligible, "new"],
      rows: [
        { subscriberId: "canary", status: "sent", resendMessageId: "canary-id" },
        { subscriberId: "real", status: "bounced" },
      ],
    }),
    { action: "noop", reason: "already-mailed" },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-09",
      eligibleIds: eligible,
      rows: [
        { subscriberId: "canary", status: "sent", resendMessageId: "canary-id" },
        { subscriberId: "real", status: "queued" },
      ],
    }),
    { action: "send", subscriberIds: ["real"] },
  );
  assert.deepEqual(
    planWeeklyAllSend({ editionDate: "2026-11-02", today: "2026-11-02", eligibleIds: [], rows: [] }),
    { action: "noop", reason: "no-recipients" },
  );
  assert.deepEqual(
    planWeeklyAllSend({
      editionDate: "2026-11-02",
      today: "2026-11-02",
      eligibleIds: eligible,
      rows: [
        { subscriberId: "canary", status: "sent", resendMessageId: null },
        { subscriberId: "real", status: "sent", resendMessageId: "real-id" },
      ],
    }),
    { action: "noop", reason: "reconciliation-held" },
  );
});

test("live sends stay behind the weekly switch, and dry-run does not", () => {
  assert.equal(weeklySendBlocker({ dryRun: true, weeklyEnabled: false, sendMode: "mock" }), null);
  assert.match(
    weeklySendBlocker({ dryRun: false, weeklyEnabled: false, sendMode: "live", unsubSecret: "secret" }) ?? "",
    /NEWSLETTER_WEEKLY_ENABLED/,
  );
  assert.match(
    weeklySendBlocker({ dryRun: false, weeklyEnabled: true, sendMode: "mock", unsubSecret: "secret" }) ?? "",
    /NEWSLETTER_SEND_MODE/,
  );
  assert.match(
    weeklySendBlocker({ dryRun: false, weeklyEnabled: true, sendMode: "live" }) ?? "",
    /NEWSLETTER_UNSUB_SECRET/,
  );
  assert.equal(
    weeklySendBlocker({ dryRun: false, weeklyEnabled: true, sendMode: "live", unsubSecret: "secret" }),
    null,
  );
});

test("cli accepts one mode and documents dry-run, canary, real, and all", () => {
  assert.deepEqual(parseWeeklyCli(["--dry-run"]), { ok: true, mode: "dry-run", dryRun: true });
  assert.deepEqual(parseWeeklyCli(["--canary"]), { ok: true, mode: "canary", dryRun: false });
  assert.deepEqual(parseWeeklyCli(["--real", "--dry-run"]), { ok: true, mode: "real", dryRun: true });
  assert.deepEqual(parseWeeklyCli(["--all"]), { ok: true, mode: "all", dryRun: false });
  assert.equal(parseWeeklyCli(["--canary", "--real"]).ok, false);
  assert.equal(parseWeeklyCli(["--sample", "a@example.com"]).ok, false);
  assert.equal(parseWeeklyCli([]).ok, false);

  const script = readFileSync(new URL("../../../scripts/newsletter-weekly.tsx", import.meta.url), "utf8");
  const helper = readFileSync(new URL("./weekly-lock.ts", import.meta.url), "utf8");
  const claim = readFileSync(new URL("./edition-claim.ts", import.meta.url), "utf8");
  const legacy = readFileSync(new URL("../../emails/newsletter-weekly.tsx", import.meta.url), "utf8");
  assert.match(script, /--dry-run/);
  assert.match(script, /--canary/);
  assert.match(script, /--real/);
  assert.match(script, /--all/);
  assert.match(script, /sg-newsletter-weekly/);
  assert.match(script, /publishedWeeklyMailIssue/);
  assert.match(script, /listUnsubscribeHeaders/);
  assert.match(script, /unsubTokenFor/);
  assert.match(script, /claimAndSend/);
  assert.match(claim, /ON CONFLICT \(edition_date, subscriber_id\) DO NOTHING/);
  assert.match(script, /WEEKLY_LIVE_SEND_GAP_MS/);
  assert.match(helper, /latestPublishedWeeklyIssue/);
  assert.match(helper, /weeklyIssueByNumber/);
  assert.doesNotMatch(`${script}\n${helper}`, /weeklyHeatRanking|selectWeeklyEditions|pickWeeklySample|getFeedEdition/);
  assert.match(legacy, /weeklyHeatRanking/);
  assert.doesNotMatch(legacy, /tsx scripts\/newsletter-weekly\.tsx/);
});
