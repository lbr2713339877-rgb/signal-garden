import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import nextConfig from "../../next.config";
import { weeklyIssueMetadata } from "./page-meta";
import {
  WEEKLY_ISSUE_1,
  WEEKLY_ISSUE_2,
  WEEKLY_ISSUE_3,
  latestPublishedWeeklyIssue,
  publicWeeklyIssues,
  weeklyIssueByNumber,
} from "./weekly-sample";

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
  assert.equal(weeklyIssueByNumber(3)?.issue, WEEKLY_ISSUE_3.issue);
  assert.equal(weeklyIssueByNumber(4), null);
  assert.deepEqual(
    publicWeeklyIssues().map((row) => [row.number, row.publishedOn]),
    [
      [1, WEEKLY_ISSUE_1.to],
      [2, WEEKLY_ISSUE_2.to],
      [3, WEEKLY_ISSUE_3.to],
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

test("/weekly 301s to the latest published issue", async () => {
  const numbers = publicWeeklyIssues().map((issue) => issue.number);
  const latest = latestPublishedWeeklyIssue();
  assert.equal(latest, Math.max(...numbers));
  assert.equal(latest, WEEKLY_ISSUE_3.issue);
  assert.equal(latest, 3);
  assert.equal(weeklyIssueByNumber(latest)?.issue, latest);

  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /latestPublishedWeeklyIssue\(\)/);
  assert.doesNotMatch(config, /destination:\s*["']\/weekly\/\d+["']/);

  const rules = await nextConfig.redirects!();
  const rule = rules.find((item) => item.source === "/weekly");
  assert.ok(rule);
  assert.equal(rule.destination, `/weekly/${latest}`);
  assert.equal("statusCode" in rule ? rule.statusCode : undefined, 301);
  assert.equal("permanent" in rule ? rule.permanent : undefined, undefined);
  assert.equal(
    rules.some((item) => /^\/weekly\/\d+/.test(item.source) || item.source.startsWith("/weekly/:")),
    false,
  );
});

test("issue 2 is the locked max-heat Top 10 plus doop", () => {
  assert.equal(WEEKLY_ISSUE_2.issue, 2);
  assert.equal(WEEKLY_ISSUE_2.from, "2026-10-20");
  assert.equal(WEEKLY_ISSUE_2.to, "2026-10-26");
  assert.equal(WEEKLY_ISSUE_2.items.length, 10);
  assert.equal(WEEKLY_ISSUE_2.sponsor, true);
  assert.deepEqual(
    WEEKLY_ISSUE_2.items.map((item) => `${item.rank} ${item.slug} ${item.heat} ${item.peakDate} ${item.starsLine}`),
    [
      "1 jetbrains-thinkrail 89 2026-10-21 504 → 1.0k stars（+102.4%）",
      "2 cosmictaserdev-creator-convx 88 2026-10-22 539 → 921 stars（+70.9%）",
      "3 zipengwu365-tomc 88 2026-10-25 20 → 229 stars（+1045.0%）",
      "4 juliobsz-skills 86 2026-10-23 187 → 913 stars（+388.2%）",
      "5 lucasmarkes-hairline 86 2026-10-21 317 → 2.7k stars（+761.5%）",
      "6 insane0777-awwwards-mcp 82 2026-10-21 94 → 308 stars（+227.7%）",
      "7 leonxlnx-cinetic 82 2026-10-21 78 → 813 stars（+942.3%）",
      "8 imskyleen-animate-ui 80 2026-10-21 4.4k → 4.6k stars（+5.5%）",
      "9 axiomcodeai-axiomcodegraph 77 2026-10-21 61 → 270 stars（+342.6%）",
      "10 el4cteo-blender-skills 76 2026-10-23 11 → 450 stars（+3990.9%）",
    ],
  );
  assert.equal(WEEKLY_ISSUE_2.items.some((item) => item.slug === "activeing123-mcptoon"), false);
  assert.equal(WEEKLY_ISSUE_2.items[0]?.zh, "一个能根据你的工作习惯自动调整的轻量级IDE，专为AI编程助手设计。");
  assert.equal(
    WEEKLY_ISSUE_2.items[0]?.en,
    "ThinkRail is a lightweight IDE that adapts to your workflow and helps you code with AI through natural conversation, designed for Cursor users.",
  );
  assert.equal(WEEKLY_ISSUE_2.items[2]?.name, "TOMC");
  assert.equal(WEEKLY_ISSUE_2.items[2]?.zh, "在本地压缩上下文，为编码助手保留任务记忆，跨会话保持项目状态。");
  assert.equal(
    WEEKLY_ISSUE_2.items[2]?.en,
    "CPU context compression that keeps your project memory intact when switching AI coding assistants.",
  );
  assert.match(WEEKLY_ISSUE_2.editorNote?.zh ?? "", /AI coding skills \/ MCP \/ 上下文与动效技能/);
  assert.match(WEEKLY_ISSUE_2.editorNote?.en ?? "", /context compression, and motion skills/);
  assert.match(WEEKLY_ISSUE_2.editorNote?.zh ?? "", /TOMC/);
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

test("issue 3 is the locked max-heat Top 10 plus chaojifeng-video-design", () => {
  assert.equal(WEEKLY_ISSUE_3.issue, 3);
  assert.equal(WEEKLY_ISSUE_3.from, "2026-10-27");
  assert.equal(WEEKLY_ISSUE_3.to, "2026-11-02");
  assert.equal(WEEKLY_ISSUE_3.items.length, 10);
  assert.equal(WEEKLY_ISSUE_3.sponsor, true);
  assert.deepEqual(
    WEEKLY_ISSUE_3.items.map((item) => `${item.rank} ${item.name} ${item.slug} ${item.heat} ${item.peakDate} ${item.starsLine}`),
    [
      "1 DeepSeekBot botharness-deepseekbot 90 2026-11-01 21 → 460 stars（+2090.5%）",
      "2 cleanyourtv gathin23-cleanyourtv 83 2026-10-27 1.8k → 48k stars（+2593.0%）",
      "3 design-agent langchain-ai-design-agent 78 2026-10-30 2 → 530 stars（+26400.0%）",
      "4 reanimate niazmorshed2007-reanimate 78 2026-11-01 116 → 434 stars（+274.1%）",
      "5 EAC-design-world ebony-vinyl-eac-design-world 76 2026-10-27 22 → 353 stars（+1504.5%）",
      "6 house-plan-designer zwd11-house-plan-designer 74 2026-11-01 50 → 265 stars（+430.0%）",
      "7 claude-skill motionsites-ai-claude-skill 71 2026-10-28 120 → 1.3k stars（+965.0%）",
      "8 brand-identity-skill fatihaydost-brand-identity-skill 70 2026-11-01 65 → 276 stars（+324.6%）",
      "9 awesome-gamedev-agent-skills gamedev-skills-awesome-gamedev-agent-skills 70 2026-10-28 4.8k → 6.3k stars（+31.3%）",
      "10 impeccable pbakaus-impeccable 70 2026-10-30 92k → 98k stars（+6.2%）",
    ],
  );
  assert.deepEqual(
    WEEKLY_ISSUE_3.items.map((item) => item.zh),
    [
      "在桌面端组建有长期记忆的AI Bot团队，协作完成任务。",
      "用编码助手通过Wi-Fi清理安卓电视的垃圾软件，换上Apple TV风格主屏。",
      "在Slack聊天里生成品牌一致的设计，从一张图到整份简报。",
      "给 Claude Code 装上这个技能，就能从录屏或网站里逐帧拆解动画，自动生成匹配的代码组件。",
      "一个本地视频剪辑和设计插件，让 DeepSeek Harness 用户能多轨剪辑、套模板并导出视频。",
      "上传户型图，一句话让它变成可编辑的2D/3D装修设计网页。",
      "免费的Claude技能，让Claude做出电影感落地页而不是普通AI页面。",
      "给Claude装个品牌设计师技能，一句话出Logo、字体和配色。",
      "给AI编程助手装上游戏开发技能，它会按你用的引擎自动挑选对应做法。",
      "给编程助手装上设计判断力，让它在出代码前先挑出丑和乱。",
    ],
  );
  assert.deepEqual(
    WEEKLY_ISSUE_3.items.map((item) => item.en),
    [
      "An open-source alternative to GrokBot that lets you run a team of personal AI bots with memory, identities, and permissions.",
      "Android and Google TV owners can use CleanYourTV to remove bloatware over Wi-Fi and get a cleaner home screen.",
      "A design agent that turns Slack conversations into on-brand visuals, from stills to motion graphics.",
      "Clone any animation from a website, recording, or video file into editable components with Claude Code.",
      "A local-first video production plugin for DeepSeek Harness with multi-track editing, design templates, and native preview.",
      "Hand your AI assistant a floor plan photo and it builds a living 2D/3D interior designer page—single HTML file, works offline.",
      "Free Claude skill: make Claude build award-level, cinematic landing pages. By MotionSites.",
      "Create a complete brand identity system from one brief: logo, typography, color palette, and guidelines PDF.",
      "Game developers using AI coding assistants get engine-specific guidance for Godot, Unity, Unreal, and more.",
      "A design vocabulary that lets your coding agent review, critique, and polish UI before shipping.",
    ],
  );
  assert.equal(
    WEEKLY_ISSUE_3.editorNote?.zh,
    "本周热度分榜上，**设计/动效 skills、视频工具链、可安装 agent 技能**扎堆：design-agent、impeccable、claude-skill、reanimate、EAC-design-world、brand-identity-skill、awesome-gamedev-agent-skills 都在给助手加「设计判断 / 动画克隆 / 成片」能力；榜首 DeepSeekBot 是带长期记忆的桌面 Bot 团队，中间还插进了一个清理安卓电视的 cleanyourtv，提醒日榜并不只围着 coding agent 转。",
  );
  assert.equal(
    WEEKLY_ISSUE_3.editorNote?.en,
    "This week's momentum board clustered around **design/motion skills, video toolchains, and installable agent skills**—design-agent, impeccable, claude-skill, reanimate, EAC-design-world, brand-identity-skill, and awesome-gamedev-agent-skills all extend assistants with design taste, animation cloning, or shipping video. Chart-topper DeepSeekBot is a desktop Bot team with long-term memory, and cleanyourtv (Android TV cleanup) still broke into the Top 10—a reminder the board is not only coding agents.",
  );
  const pick = WEEKLY_ISSUE_3.editorPick;
  assert.ok(pick);
  assert.equal(pick.slug, "mileson-chaojifeng-video-design");
  assert.equal(pick.name, "chaojifeng-video-design");
  assert.equal(pick.heat, 69);
  assert.equal(pick.peakDate, "2026-10-29");
  assert.equal(pick.starsLine, "116 → 489 stars（+321.6%）");
  assert.equal(pick.zh, "给AI助手用的视频设计技能包：用户说需求，它做分镜、配乐、改局部，直到出片。");
  assert.equal(
    pick.en,
    "A video design methodology that lets AI turn a one-sentence description into a complete video with storyboard, music, and effects.",
  );
  assert.equal(
    pick.reasonZh,
    "选它的理由：贴本周 video / design-skill 主题，但是「视频设计方法论技能包」而不是又一个单机动效库。",
  );
  assert.equal(
    pick.reasonEn,
    "Why this pick: it fits this week's video / design-skill theme, but as a video-design methodology skill pack, not another solo motion library.",
  );
  assert.equal(WEEKLY_ISSUE_3.items.some((item) => item.slug === pick.slug), false);
  for (const item of WEEKLY_ISSUE_3.items) {
    assert.equal(item.labelZh, `热度分 ${item.heat}`);
    assert.equal(item.labelEn, `Heat ${item.heat}`);
  }
  for (const item of [...WEEKLY_ISSUE_3.items, pick]) {
    assert.equal(
      item.href,
      `/p/${item.slug}?utm_source=email&utm_medium=weekly&utm_campaign=weekly-3`,
    );
    assert.ok(item.zh.length > 0);
    assert.ok(item.en.length > 0);
  }
  assert.doesNotMatch(JSON.stringify(WEEKLY_ISSUE_3), BANNED);

  const meta = weeklyIssueMetadata(WEEKLY_ISSUE_3, "https://signalgarden.site");
  assert.equal(meta.alternates?.canonical, "https://signalgarden.site/weekly/3");
  assert.match(String(meta.description), /第 3 期/);
  assert.match(String(meta.description), /2026-10-27 – 2026-11-02/);
  const ogImage = Array.isArray(meta.openGraph?.images) ? meta.openGraph.images[0] : meta.openGraph?.images;
  const ogUrl = typeof ogImage === "string" ? ogImage : ogImage && typeof ogImage === "object" && "url" in ogImage ? String(ogImage.url) : "";
  assert.equal(ogUrl, "https://signalgarden.site/weekly/3/opengraph-image");
  assert.equal(meta.twitter && "card" in meta.twitter ? meta.twitter.card : undefined, "summary_large_image");
});
