import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { projectPageMetadata } from "./page-meta";
import {
  SEO_PILOT_COPY,
  SEO_PILOT_MIN_POINTS,
  SEO_PILOT_PINNED,
  SEO_PILOT_SIZE,
  buildAudienceSection,
  buildMomentumSection,
  buildPeerSection,
  containsSeoPilotBlocked,
  isSeoPilot,
  momentumShapeFromPoints,
  selectSeoPilotSlugs,
  seoPilotMetaDescription,
  seoPilotPlainText,
  type MomentumSection,
  type SeoPeerCandidate,
} from "./seo-pilot";

const BLOCKED = [/fork/i, /fastest/i, /涨得最快/, /最快/, /\bbest\b/i, /\btop\b/i];

function assertClear(text: string) {
  for (const pattern of BLOCKED) assert.doesNotMatch(text, pattern);
}

function scenarioSentences(text: string): string[] {
  return text.split(/[。！？.!?]+/).map((part) => part.trim()).filter(Boolean);
}

function assertTwoScenarios(section: { zh: string; en: string; draft: boolean } | null) {
  assert.ok(section);
  assert.ok(scenarioSentences(section.zh).length >= 2, section.zh);
  assert.ok(scenarioSentences(section.en).length >= 2, section.en);
  assert.equal(typeof section.draft, "boolean");
  assert.doesNotMatch(`${section.zh}\n${section.en}`, /适合开发者|很好用/);
  assertClear(`${section.zh}\n${section.en}`);
}

function day(offset: number): string {
  return new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
}

function series(count: number, heatAt: (index: number) => number = (index) => index + 1, rankAt: (index: number) => number = () => 4) {
  return Array.from({ length: count }, (_, index) => ({
    date: day(index),
    rank: rankAt(index),
    heatScore: heatAt(index),
    published: true,
  }));
}

test("pilot membership is the longest tracked histories, then published days, then slug", () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({
    slug: `p${String(index + 1).padStart(2, "0")}`,
    tracked: index + 1,
    published: index % 3,
  }));
  const picked = selectSeoPilotSlugs(rows);
  assert.equal(picked.length, SEO_PILOT_SIZE);
  assert.equal(picked[0], "p60");
  assert.equal(picked[49], "p11");
  assert.equal(picked.includes("p10"), false);
  assert.equal(isSeoPilot("p60", picked), true);
  assert.equal(isSeoPilot("p11", new Set(picked)), true);
  assert.equal(isSeoPilot("p10", new Set(picked)), false);
  assert.equal(isSeoPilot("p03", picked), false);
  assert.equal(isSeoPilot("", picked), false);

  assert.deepEqual(selectSeoPilotSlugs([
    { slug: "c", tracked: 5, published: 1 },
    { slug: "a", tracked: "5", published: "4" },
    { slug: "b", tracked: 5, published: 4 },
    { slug: "e", tracked: 9, published: 0 },
    { slug: "d", tracked: SEO_PILOT_MIN_POINTS - 1, published: 2 },
  ], 10), ["e", "a", "b", "c"]);
});

test("a pinned slug that would rank 51 is swapped into the pilot set of 50", () => {
  assert.equal(SEO_PILOT_SIZE, 50);
  assert.deepEqual([...SEO_PILOT_PINNED], ["docusealco-docuseal"]);
  const pin = SEO_PILOT_PINNED[0];

  const tied = Array.from({ length: SEO_PILOT_SIZE }, (_, index) => ({
    slug: `a${String(index).padStart(2, "0")}`,
    tracked: 7,
    published: 1,
  }));
  const tiedRows = [
    { slug: "zzzz-after", tracked: 7, published: 1 },
    { slug: pin, tracked: 7, published: 1 },
    ...tied,
  ];
  const tiedRank = [...tiedRows].sort((a, b) => (
    b.tracked - a.tracked || b.published - a.published || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  ));
  assert.equal(tiedRank[49]?.slug, "a49");
  assert.equal(tiedRank[50]?.slug, pin);
  const tiedPicked = selectSeoPilotSlugs(tiedRows);
  assert.equal(tiedPicked.length, 50);
  assert.equal(tiedPicked.at(-1), pin);
  assert.equal(tiedPicked.includes("a48"), true);
  assert.equal(tiedPicked.includes("a49"), false);
  assert.equal(tiedPicked.includes("zzzz-after"), false);
  assert.equal(isSeoPilot(pin, new Set(tiedPicked)), true);

  const scored = Array.from({ length: SEO_PILOT_SIZE }, (_, index) => ({
    slug: `b${String(index).padStart(2, "0")}`,
    tracked: 8,
    published: 1,
  }));
  const scoredPicked = selectSeoPilotSlugs([
    ...scored,
    { slug: pin, tracked: SEO_PILOT_MIN_POINTS, published: 0 },
  ]);
  assert.equal(scoredPicked.length, 50);
  assert.equal(scoredPicked.at(-1), pin);
  assert.equal(scoredPicked.includes("b48"), true);
  assert.equal(scoredPicked.includes("b49"), false);

  const already = selectSeoPilotSlugs([
    { slug: pin, tracked: 12, published: 4 },
    ...Array.from({ length: 55 }, (_, index) => ({
      slug: `d${String(index).padStart(2, "0")}`,
      tracked: 9,
      published: 1,
    })),
  ]);
  assert.equal(already.length, 50);
  assert.equal(already[0], pin);
  assert.equal(already.includes("d48"), true);
  assert.equal(already.includes("d49"), false);
});

test("a pinned slug under the tracked minimum is not forced into the pilot", () => {
  const pin = SEO_PILOT_PINNED[0];
  const ahead = Array.from({ length: SEO_PILOT_SIZE }, (_, index) => ({
    slug: `c${String(index).padStart(2, "0")}`,
    tracked: 7,
    published: 1,
  }));
  const picked = selectSeoPilotSlugs([
    ...ahead,
    { slug: pin, tracked: SEO_PILOT_MIN_POINTS - 1, published: 9 },
  ]);
  assert.equal(picked.length, SEO_PILOT_SIZE);
  assert.equal(picked.includes(pin), false);
  assert.deepEqual(picked, ahead.map((row) => row.slug));

  const absent = selectSeoPilotSlugs(ahead);
  assert.equal(absent.length, SEO_PILOT_SIZE);
  assert.equal(absent.includes(pin), false);
});

test("momentum section needs three scored days and labels published days apart from tracked ones", () => {
  assert.equal(buildMomentumSection({ points: [] }), null);
  assert.equal(buildMomentumSection({ points: series(2) }), null);
  assert.equal(buildMomentumSection({
    points: [
      { date: "not-a-date", rank: 1, heatScore: 10 },
      { date: "2026-01-02", rank: 1, heatScore: 10 },
      { date: "2026-01-03", rank: 1, heatScore: 10 },
    ],
  }), null);

  const section = buildMomentumSection({
    firstTrackedAt: "2025-12-01T00:00:00.000Z",
    points: [
      { date: "2026-01-03", rank: 7, heatScore: 11, published: true },
      { date: "2026-01-01", rank: 8, heatScore: 10, published: true },
      { date: "2026-01-05", rank: 4, heatScore: 14, published: true },
      { date: "2026-01-02", rank: 6, heatScore: 12.5, published: true },
      { date: "2026-01-04", rank: 2, heatScore: 15, published: true },
    ],
  });
  assert.ok(section);
  assert.equal(section!.firstTracked, "2026-01-01");
  assert.equal(section!.trackedDays, 5);
  assert.equal(section!.publishedDays, 5);
  assert.equal(section!.bestRank, 2);
  assert.equal(section!.bestHeat, "15");
  assert.equal(section!.rows[0]?.date, "2026-01-05");
  assert.match(section!.rows[0]!.lineZh, /上榜/);
  assert.match(section!.rows[0]!.lineZh, /名次 4/);
  assert.match(section!.rows[0]!.lineZh, /热度分 14/);
  assert.match(section!.rows[0]!.lineZh, /较上次记录 −1/);
  assert.match(section!.rows[0]!.lineEn, /Ranked/);
  assert.doesNotMatch(section!.rows[0]!.lineEn, /on the ranking/);
  assert.match(section!.rows[0]!.lineEn, /momentum 14/);
  assert.match(section!.rows[0]!.lineEn, /−1 vs the previous tracked day/);
  assert.equal(section!.dataNoteZh, "数据说明：走势来自 Signal Garden 每日追踪的热度分；只有标注「上榜」的日期出现在公开每日榜单上。");
  assert.equal(section!.dataNoteEn, "Data note: the trend uses Signal Garden\u2019s daily tracked momentum scores; only dates marked \u201cRanked\u201d appeared on the public daily list.");
  assert.match(section!.rows.at(-1)!.lineZh, /首次记录/);
  assert.doesNotMatch(section!.summaryZh, /2025-12-01/);
  assert.match(section!.summaryZh, /自 2026-01-01 起追踪 5 天/);
  assert.match(section!.summaryZh, /热度分从 10 到 14，净变化 \+4/);
  assert.match(section!.summaryZh, /峰值 15，出现在 2026-01-04/);
  assert.doesNotMatch(section!.summaryZh, /最高水平/);
  assert.match(section!.summaryZh, /上榜 5 天，记录里排到过第 2 名/);
  assert.match(section!.summaryEn, /Tracked 5 days since/);
  assert.match(section!.summaryEn, /On the published ranking 5 days/);
  assert.doesNotMatch(section!.summaryEn, /\b1 days\b/);
  assert.match(section!.summaryEn, /The peak was 15 on 2026-01-04/);
  assert.doesNotMatch(section!.summaryEn, /highest tracked level/);
  assert.equal(section!.sparkline.length, 5);
  assert.ok(section!.sparkline[3]!.y < section!.sparkline[0]!.y);
  assert.equal(section!.noteZh, null);
  assertClear(seoPilotPlainText({ momentum: section, peers: null, audience: null, metaDescription: null }));

  const flat = buildMomentumSection({ points: series(3, () => 8) });
  assert.ok(flat);
  assert.ok(flat!.sparkline.every((point) => point.y === flat!.sparkline[0]!.y));
  assert.match(flat!.rows[0]!.lineZh, /较上次记录持平/);
  assert.match(flat!.summaryZh, /净变化 0/);
  assert.match(flat!.summaryZh, /目前处于追踪以来的最高水平/);
  assert.doesNotMatch(flat!.summaryZh, /峰值/);
  assert.match(flat!.summaryEn, /currently at its highest tracked level/);

  const long = buildMomentumSection({
    points: series(30, (index) => 5 + index, (index) => (index === 0 ? 1 : 9)),
  });
  assert.ok(long);
  assert.equal(long!.trackedDays, 30);
  assert.equal(long!.rows.length, 24);
  assert.equal(long!.bestRank, 1);
  assert.equal(long!.rows.some((row) => row.rank === 1), false);
  assert.match(long!.summaryZh, new RegExp(day(0)));
  assert.match(long!.noteZh ?? "", /最近 24 天/);
  assert.match(long!.noteEn ?? "", /30 tracked days; the latest 24 days are listed/);
  assert.doesNotMatch(long!.noteEn ?? "", /\b1 days\b/);
  assert.equal(long!.sparkline.length, 30);

  assert.equal(buildMomentumSection({
    points: [
      { date: "2026-01-01", rank: 1, heatScore: null, published: true },
      { date: "2026-01-02", rank: 1, heatScore: 10, published: true },
      { date: "2026-01-03", rank: 1, heatScore: 11, published: false },
    ],
  }), null);

  const mixed = buildMomentumSection({
    firstTrackedAt: "2025-11-01",
    points: [
      { date: "2026-01-01", rank: 1, heatScore: 10, published: false },
      { date: "2026-01-02", rank: 4, heatScore: 12, published: true },
      { date: "2026-01-03", rank: 0, heatScore: 9, published: false },
      { date: "2026-01-04", rank: null, heatScore: Number.NaN, published: true },
    ],
  });
  assert.ok(mixed);
  assert.equal(mixed!.trackedDays, 3);
  assert.equal(mixed!.publishedDays, 1);
  assert.equal(mixed!.bestRank, 4);
  assert.equal(mixed!.bestHeat, "12");
  assert.match(mixed!.rows[0]!.lineZh, /2026-01-03/);
  assert.doesNotMatch(mixed!.rows[0]!.lineZh, /上榜|名次/);
  assert.match(mixed!.rows[1]!.lineZh, /上榜/);
  assert.match(mixed!.rows[1]!.lineZh, /名次 4/);
  assert.match(mixed!.rows[2]!.lineZh, /首次记录/);
  assert.doesNotMatch(mixed!.rows[2]!.lineZh, /上榜|名次/);
  assert.equal(mixed!.firstTracked, "2026-01-01");
  assert.doesNotMatch(mixed!.summaryZh, /2025-11-01/);
  assert.match(mixed!.summaryZh, /自 2026-01-01 起追踪 3 天/);
  assert.match(mixed!.summaryZh, /热度分从 10 到 9，净变化 −1/);
  assert.match(mixed!.summaryZh, /峰值 12，出现在 2026-01-02/);
  assert.match(mixed!.summaryZh, /上榜 1 天，记录里排到过第 4 名/);
  assert.match(mixed!.summaryEn, /Tracked 3 days since/);
  assert.match(mixed!.summaryEn, /On the published ranking 1 day,/);
  assert.doesNotMatch(mixed!.summaryEn, /\b1 days\b/);
  assertClear(seoPilotPlainText({ momentum: mixed, peers: null, audience: null, metaDescription: null }));

  const quiet = buildMomentumSection({
    points: series(3).map((point) => ({ ...point, published: false, rank: 1 })),
  });
  assert.ok(quiet);
  assert.equal(quiet!.bestRank, null);
  assert.equal(quiet!.publishedDays, 0);
  assert.doesNotMatch(quiet!.summaryZh, /上榜/);
  assert.doesNotMatch(quiet!.summaryEn, /published ranking|1 days/);
  assert.doesNotMatch(quiet!.summaryZh, /名次|峰值/);
  assert.match(quiet!.summaryEn, /highest tracked level/);
  assert.match(quiet!.summaryEn, /Tracked 3 days since/);
  assert.equal(quiet!.dataNoteZh, "数据说明：走势来自 Signal Garden 每日追踪的热度分；该项目尚未出现在公开每日榜单上。");
  assert.equal(quiet!.dataNoteEn, section!.dataNoteEn);
  assert.doesNotMatch(quiet!.dataNoteZh, /上榜/);
  const quietMeta = seoPilotMetaDescription({ name: "Quiet", momentum: quiet });
  assert.doesNotMatch(quietMeta ?? "", /上榜/);
  assert.doesNotMatch(seoPilotPlainText({ momentum: quiet, peers: null, audience: null, metaDescription: quietMeta }), /名次|上榜/);

  const dated = buildMomentumSection({
    firstTrackedAt: "2010-05-05T00:00:00.000Z",
    points: [
      { date: "2024-06-01", rank: null, heatScore: null, published: false },
      { date: "2026-03-01", rank: 3, heatScore: 4, published: true },
      { date: "2026-03-02", rank: 2, heatScore: 5, published: true },
      { date: "2026-03-03", rank: 2, heatScore: 5, published: true },
    ],
  });
  assert.equal(dated?.firstTracked, "2024-06-01");
  assert.match(dated?.summaryZh ?? "", /自 2024-06-01 起追踪 3 天/);
  assert.doesNotMatch(dated?.summaryZh ?? "", /2010-05-05/);
  assert.match(dated?.summaryZh ?? "", /热度分从 4 到 5/);
});

test("peer section needs three real overlaps and does not sort by the score", () => {
  const self = { slug: "self", language: "Rust", category: null, primaryCategory: null, topics: ["cli"] };
  const peer = (slug: string, over: Partial<SeoPeerCandidate> = {}): SeoPeerCandidate => ({
    slug,
    name: slug,
    language: "Rust",
    category: null,
    primaryCategory: null,
    topics: [],
    heatScore: 10,
    signalDate: "2026-04-01",
    ...over,
  });

  assert.equal(buildPeerSection(self, [peer("a"), peer("b")]), null);
  assert.equal(buildPeerSection(
    { slug: "self", language: null, category: null, primaryCategory: null, topics: [] },
    [peer("a", { language: null }), peer("b", { language: null }), peer("c", { language: null }), peer("d", { language: null })],
  ), null);

  const many = Array.from({ length: 8 }, (_, index) => peer(`p${index}`, { heatScore: index }));
  const capped = buildPeerSection({ ...self, topics: [] }, many);
  assert.deepEqual(capped?.peers.map((item) => item.slug), ["p0", "p1", "p2", "p3", "p4", "p5"]);
  assert.equal(capped?.peers.some((item) => item.slug === "p7"), false);
  assert.match(capped!.peers[0]!.detailZh, /热度分 0/);
  assert.equal(capped!.peers[0]!.href, "/p/p0");

  const pool = [
    peer("rust-topic", { topics: ["cli"], heatScore: 1, name: "Rust Topic" }),
    peer("rust-plain", { heatScore: 9, name: "Rust Plain" }),
    peer("go-topic", { language: "Go", topics: ["cli"], heatScore: 50, name: "Go Topic" }),
    peer("go-plain", { language: "Go", heatScore: 80, name: "Go Plain" }),
    peer("go-extra", { language: "Go", heatScore: 4, name: "Go Extra" }),
    peer("self", { heatScore: 100, name: "Self" }),
  ];
  const rust = buildPeerSection(self, pool);
  const go = buildPeerSection({ slug: "other", language: "Go", category: null, primaryCategory: null, topics: [] }, pool);
  assert.ok(rust && go);
  assert.deepEqual(rust!.peers.map((item) => item.slug), ["rust-topic", "rust-plain", "go-topic"]);
  assert.equal(rust!.peers.some((item) => item.slug === "go-plain"), false);
  assert.equal(rust!.peers.some((item) => item.slug === "self"), false);
  assert.notDeepEqual(rust!.peers.map((item) => item.slug), go!.peers.map((item) => item.slug));
  assert.match(rust!.peers[0]!.detailZh, /相同主题 cli/);
  assert.match(go!.introEn, /[Mm]omentum/);
  assertClear(seoPilotPlainText({ momentum: null, peers: rust, audience: null, metaDescription: null }));
});

test("momentum shape is rising, peak-then-fade, or flat from the tracked series", () => {
  assert.equal(momentumShapeFromPoints(series(2, (index) => index + 1)), null);
  assert.equal(momentumShapeFromPoints(series(3, () => 8)), "flat");
  assert.equal(momentumShapeFromPoints(series(4, (index) => 3 + index * 2)), "rising");
  assert.equal(momentumShapeFromPoints(series(4, (index) => [4, 9, 8, 5][index]!)), "peak-then-fade");
});

test("audience copy always has two scenario sentences and marks thin inputs as draft", () => {
  const thinCases = [
    {},
    { language: "Python" },
    { license: "MIT" },
    { language: "Go", license: "MIT" },
    { requiresDocker: true },
    { description: "A command-line tool" },
    { topics: ["tools", "hacktoberfest"], license: "MIT" },
    { language: "Go", license: "NOASSERTION" },
    { language: "Go", license: "Other" },
    { language: "JavaScript", hasSkillMd: true, requiresApiKey: true },
    { language: "TypeScript", skillType: "skill" },
    { skillType: "library", license: "MIT" },
    { requiresDocker: true, license: "GPL-3.0", requiresLocalRuntime: true },
  ];
  for (const input of thinCases) {
    const section = buildAudienceSection(input);
    assert.equal(section.draft, true, JSON.stringify(input));
    assertTwoScenarios(section);
    assert.doesNotMatch(`${section.zh}\n${section.en}`, /API key|SKILL\.md|Docker|local runtime|技能包|skill package|\blibrary\b/i);
  }

  const empty = buildAudienceSection({});
  assert.doesNotMatch(`${empty.zh}\n${empty.en}`, /MIT|Rust|Python/);

  const rust = buildAudienceSection({
    language: "Rust",
    topics: ["cli"],
    license: "MIT",
    description: "A command-line helper for logs",
    skillType: "library",
    requiresLocalRuntime: true,
    hasSkillMd: true,
    requiresApiKey: true,
    momentumShape: "peak-then-fade",
    peers: [{ name: "Go Topic", language: "Go", topics: ["cli"] }],
  });
  const typed = buildAudienceSection({
    language: "TypeScript",
    topics: ["mcp"],
    license: "Apache-2.0",
    description: "An MCP server for notes",
    skillType: "mcp",
    requiresApiKey: true,
    hasSkillMd: true,
    projectKind: "repo",
  });
  assert.equal(rust.draft, false);
  assert.equal(typed.draft, true);
  assert.notEqual(rust.zh, typed.zh);
  assertTwoScenarios(rust);
  assertTwoScenarios(typed);
  assert.match(rust.zh, /Rust/);
  assert.match(rust.zh, /命令行/);
  assert.match(rust.zh, /MIT/);
  assert.match(rust.zh, /Go Topic/);
  assert.match(rust.zh, /峰值回落/);
  assert.match(rust.zh, /A command-line helper for logs/);
  assert.match(rust.zh, /优先/);
  assert.match(rust.en, /Prefer it over the in-site peer Go Topic/);
  assert.match(rust.en, /peak-then-fade/);
  assert.match(typed.zh, /TypeScript/);
  assert.match(typed.zh, /MCP/);
  assert.match(typed.zh, /Apache-2\.0/);
  assert.match(typed.zh, /An MCP server for notes/);
  assert.match(typed.en, /Prefer it over in-site peers/);
  assert.doesNotMatch(`${rust.zh}\n${rust.en}\n${typed.zh}\n${typed.en}`, /API key|SKILL\.md|本机运行|Docker|技能包|代码库|skill package|\blibrary\b/i);

  const fromReadme = buildAudienceSection({
    language: "Go",
    license: "MIT",
    description: "Short vendor line that should lose.",
    readmeText: "# Title\n\n![badge](https://img.example/badge.svg)\n\nKeeps subtitle files in sync for editors.\n\nSecond paragraph ignored.",
  });
  assert.equal(fromReadme.draft, true);
  assert.match(fromReadme.zh, /Keeps subtitle files in sync for editors/);
  assert.match(fromReadme.en, /Keeps subtitle files in sync for editors/);
  assert.doesNotMatch(`${fromReadme.zh}\n${fromReadme.en}`, /Short vendor line|Second paragraph|Title/);

  const dirty = buildAudienceSection({
    language: "Rust",
    topics: ["cli"],
    license: "MIT",
    description: "a fork and the fastest helper that 涨得最快 for logs",
    peers: [{ name: "fork-tool", language: "Go" }, { name: "Go Topic", language: "Go" }],
  });
  assert.equal(dirty.draft, true);
  assert.match(dirty.zh, /Go Topic/);
  assert.doesNotMatch(`${dirty.zh}\n${dirty.en}`, /fork|fastest|涨得最快/i);
  assertTwoScenarios(dirty);

  const shaped = buildAudienceSection({
    description: "Parses subtitle cues into a timeline for editors.",
    momentumShape: "rising",
  });
  assert.equal(shaped.draft, true);
  assert.match(shaped.zh, /上升/);
  assert.match(shaped.en, /momentum shape is rising/);
  assert.doesNotMatch(`${shaped.zh}\n${shaped.en}`, /名次|\brank\b/i);
  assertTwoScenarios(shaped);

  const topicPeerOnly = buildAudienceSection({
    language: "Ruby",
    topics: ["pdf"],
    license: "AGPL-3.0",
    description: "Open source document filling and signing for teams.",
    momentumShape: "flat",
    peers: [{ name: "Same Stack", language: "Ruby", topics: ["vue"] }],
  });
  assert.equal(topicPeerOnly.draft, true);
  assert.match(topicPeerOnly.zh, /Same Stack/);
  assert.match(topicPeerOnly.zh, /vue/);
  assert.match(topicPeerOnly.zh, /AGPL-3\.0/);
  assert.match(topicPeerOnly.zh, /平稳/);
  assertTwoScenarios(topicPeerOnly);

  const languagePeer = buildAudienceSection({
    language: "Ruby",
    description: "Open source document filling and signing for teams.",
    license: "MIT",
    momentumShape: "rising",
    peers: [{ name: "Vue Kit", language: "TypeScript", topics: ["vue"] }],
  });
  assert.equal(languagePeer.draft, false);
  assert.match(languagePeer.zh, /Vue Kit/);
  assert.match(languagePeer.zh, /TypeScript/);
  assert.match(languagePeer.zh, /Open source document filling and signing for teams/);
  assertTwoScenarios(languagePeer);

  const htmlReadme = buildAudienceSection({
    language: "Ruby",
    license: "AGPL-3.0",
    momentumShape: "flat",
    readmeText: [
      '<h1 align="center"><a href="https://example.com/docs"><img alt="Widget" src="https://example.com/a.png"></a> Widget</h1>',
      '<h3 align="center">Open source document filling and signing</h3>',
      '<p align="center"><a href="https://example.com/hub"><img alt="Container releases" src="https://example.com/b.png"></a></p>',
      "<p>Keeps signed documents in one place for editors.</p>",
    ].join("\n"),
    peers: [{ name: "Same Stack", language: "Ruby", topics: ["pdf"] }],
  });
  assert.equal(htmlReadme.draft, true);
  assert.match(htmlReadme.zh, /Keeps signed documents in one place for editors|Open source document filling and signing/);
  assert.doesNotMatch(`${htmlReadme.zh}\n${htmlReadme.en}`, /<a|href=|src=/);
  assertTwoScenarios(htmlReadme);
});

test("pilot meta description is the ranking record, and blocked or huge leads are left out", () => {
  const momentum = buildMomentumSection({
    firstTrackedAt: "2025-12-01",
    points: series(3, (index) => 10 + index),
  }) as MomentumSection;
  assert.equal(momentum.firstTracked, "2026-01-01");
  const rich = seoPilotMetaDescription({ name: "Widget", oneLiner: "一句介绍。", momentum });
  assert.match(rich ?? "", /一句介绍。/);
  assert.match(rich ?? "", /Widget 的热度分记录/);
  assert.match(rich ?? "", /2026-01-01/);
  assert.doesNotMatch(rich ?? "", /2025-12-01/);
  assertClear(rich ?? "");

  const dirty = seoPilotMetaDescription({ name: "Widget", oneLiner: "a fork and the fastest 涨得最快", momentum });
  assert.doesNotMatch(dirty ?? "", /fork|fastest|涨得最快/i);
  assert.match(dirty ?? "", /热度分/);

  const huge = seoPilotMetaDescription({ name: "Widget", oneLiner: "很长".repeat(180), momentum });
  assert.equal(huge?.includes("很长"), false);
  assert.match(huge ?? "", /热度分记录/);
  assert.equal(seoPilotMetaDescription({ name: "Widget", momentum: null }), null);
});

test("generated pilot wording and the new files stay clear of blocked ranking claims", () => {
  const momentum = buildMomentumSection({ points: series(4, (index) => 3 + index * 2) })!;
  const peers = buildPeerSection(
    { slug: "self", language: "Rust", category: null, primaryCategory: "dev-tools", topics: ["cli"] },
    [
      { slug: "a", name: "Alpha", language: "Rust", category: null, primaryCategory: "dev-tools", topics: ["cli"], heatScore: 12, signalDate: "2026-03-02" },
      { slug: "b", name: "Beta", language: "Rust", category: null, primaryCategory: null, topics: [], heatScore: 9, signalDate: "2026-03-01" },
      { slug: "c", name: "Gamma", language: "Go", category: null, primaryCategory: "dev-tools", topics: [], heatScore: 8, signalDate: "2026-02-11" },
    ],
  );
  const audience = buildAudienceSection({ language: "Rust", topics: ["cli"], license: "MIT", description: "command-line", requiresLocalRuntime: true });
  const metaDescription = seoPilotMetaDescription({ name: "Alpha", oneLiner: "一句。", momentum });
  const text = [
    seoPilotPlainText({ momentum, peers, audience, metaDescription }),
    Object.values(SEO_PILOT_COPY).flatMap((item) => [item.zh, item.en]).join("\n"),
  ].join("\n");
  assert.match(text, /热度分/);
  assert.match(text, /momentum/i);
  assertClear(text);

  for (const file of [
    "src/lib/seo-pilot.ts",
    "src/db/queries/seo-pilot.ts",
    "src/components/v3/detail/SeoPilotSections.tsx",
    "scripts/seo-pilot-slugs.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /fork/i);
    assert.doesNotMatch(source, /fastest/i);
    assert.doesNotMatch(source, /涨得最快/);
    assert.doesNotMatch(source, /最快/);
  }
});

test("non-pilot metadata stays the body summary, and sitemap plus classic stay out of the pilot", () => {
  const base = projectPageMetadata({
    slug: "oil",
    name: "oil",
    oneLinerZh: "一句。",
    oneLinerEn: "A line.",
    origin: "https://signalgarden.site",
  });
  assert.equal(base.description, "一句。");
  const blank = projectPageMetadata({
    slug: "oil",
    name: "oil",
    oneLinerZh: "一句。",
    description: "   ",
    origin: "https://signalgarden.site",
  });
  assert.equal(blank.description, base.description);

  const richer = projectPageMetadata({
    slug: "oil",
    name: "oil",
    oneLinerZh: "一句。",
    description: "一句。 oil 的热度分记录：首次记录 2026-01-01，上榜 3 次。",
    origin: "https://signalgarden.site",
  });
  assert.match(String(richer.description), /热度分/);
  assert.equal(richer.alternates?.canonical, base.alternates?.canonical);

  const page = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  const classic = readFileSync("src/app/p/[slug]/classic/page.tsx", "utf8");
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  const query = readFileSync("src/db/queries/seo-pilot.ts", "utf8");
  assert.match(page, /export const revalidate = 3600/);
  assert.match(page, /isSeoPilot\(/);
  assert.doesNotMatch(page, /cookies\(|headers\(|getCurrentUser/);
  assert.doesNotMatch(classic, /isSeoPilot|SeoPilot/);
  assert.doesNotMatch(sitemap, /isSeoPilot|SeoPilot/);
  assert.match(query, /unstable_cache\(/);
  assert.match(query, /revalidate:\s*3600/);
  assert.match(query, /count\(DISTINCT s\.signal_date\)/);
  assert.doesNotMatch(query, /WHERE s\.is_published = true AND p\.hidden/);
});
