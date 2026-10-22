import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { projectPageMetadata } from "./page-meta";
import {
  SEO_PILOT_COPY,
  SEO_PILOT_MIN_POINTS,
  SEO_PILOT_SIZE,
  buildAudienceSection,
  buildMomentumSection,
  buildPeerSection,
  containsSeoPilotBlocked,
  isSeoPilot,
  selectSeoPilotSlugs,
  seoPilotMetaDescription,
  seoPilotPlainText,
  type MomentumSection,
  type SeoPeerCandidate,
} from "./seo-pilot";

const BLOCKED = [/fork/i, /fastest/i, /涨得最快/, /最快/, /\bbest\b/i, /\bhighest\b/i, /\btop\b/i];

function assertClear(text: string) {
  for (const pattern of BLOCKED) assert.doesNotMatch(text, pattern);
}

function day(offset: number): string {
  return new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
}

function series(count: number, heatAt: (index: number) => number = (index) => index + 1, rankAt: (index: number) => number = () => 4) {
  return Array.from({ length: count }, (_, index) => ({
    date: day(index),
    rank: rankAt(index),
    heatScore: heatAt(index),
  }));
}

test("pilot membership is the longest published histories, capped and tied by slug", () => {
  const rows = Array.from({ length: 60 }, (_, index) => ({
    slug: `p${String(index + 1).padStart(2, "0")}`,
    points: index + 1,
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
    { slug: "c", points: 5 },
    { slug: "a", points: "5" },
    { slug: "b", points: 4 },
    { slug: "d", points: SEO_PILOT_MIN_POINTS - 1 },
  ], 10), ["a", "c", "b"]);
});

test("momentum section needs three ranking days and states the record without a ranking claim", () => {
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
      { date: "2026-01-03", rank: 7, heatScore: 11 },
      { date: "2026-01-01", rank: 8, heatScore: 10 },
      { date: "2026-01-05", rank: 4, heatScore: 14 },
      { date: "2026-01-02", rank: 6, heatScore: 12.5 },
      { date: "2026-01-04", rank: 2, heatScore: 15 },
    ],
  });
  assert.ok(section);
  assert.equal(section!.firstTracked, "2025-12-01");
  assert.equal(section!.appearances, 5);
  assert.equal(section!.bestRank, 2);
  assert.equal(section!.bestHeat, "15");
  assert.equal(section!.rows[0]?.date, "2026-01-05");
  assert.match(section!.rows[0]!.lineZh, /热度分 14/);
  assert.match(section!.rows[0]!.lineZh, /较上次出现 −1/);
  assert.match(section!.rows[0]!.lineEn, /momentum 14/);
  assert.match(section!.rows[0]!.lineEn, /−1 vs the previous appearance/);
  assert.match(section!.rows.at(-1)!.lineZh, /首次出现/);
  assert.match(section!.summaryZh, /2025-12-01/);
  assert.match(section!.summaryZh, /第 2 名/);
  assert.match(section!.summaryEn, /momentum/i);
  assert.equal(section!.sparkline.length, 5);
  assert.ok(section!.sparkline[3]!.y < section!.sparkline[0]!.y);
  assert.equal(section!.noteZh, null);
  assertClear(seoPilotPlainText({ momentum: section, peers: null, audience: null, metaDescription: null }));

  const flat = buildMomentumSection({ points: series(3, () => 8) });
  assert.ok(flat);
  assert.ok(flat!.sparkline.every((point) => point.y === flat!.sparkline[0]!.y));
  assert.match(flat!.rows[0]!.lineZh, /较上次出现持平/);

  const long = buildMomentumSection({
    points: series(30, (index) => 5 + index, (index) => (index === 0 ? 1 : 9)),
  });
  assert.ok(long);
  assert.equal(long!.appearances, 30);
  assert.equal(long!.rows.length, 24);
  assert.equal(long!.bestRank, 1);
  assert.equal(long!.rows.some((row) => row.rank === 1), false);
  assert.match(long!.summaryZh, new RegExp(day(0)));
  assert.match(long!.noteZh ?? "", /最近 24 次/);
  assert.equal(long!.sparkline.length, 30);
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

test("audience copy is omitted when the fields are thin and differs when they are not", () => {
  assert.equal(buildAudienceSection({}), null);
  assert.equal(buildAudienceSection({ language: "Python" }), null);
  assert.equal(buildAudienceSection({ license: "MIT" }), null);
  assert.equal(buildAudienceSection({ requiresDocker: true }), null);
  assert.equal(buildAudienceSection({ description: "A command-line tool" }), null);
  assert.equal(buildAudienceSection({ topics: ["tools", "hacktoberfest"], license: "MIT" }), null);
  assert.equal(buildAudienceSection({ language: "Go", license: "NOASSERTION" }), null);
  assert.equal(buildAudienceSection({ language: "Go", license: "Other" }), null);

  const rust = buildAudienceSection({
    language: "Rust",
    topics: ["cli"],
    license: "MIT",
    description: "A command-line helper for logs",
    skillType: "library",
    requiresLocalRuntime: true,
  });
  const typed = buildAudienceSection({
    language: "TypeScript",
    topics: ["mcp"],
    license: "Apache-2.0",
    description: "An MCP server for notes",
    skillType: "mcp",
    requiresApiKey: true,
    projectKind: "repo",
  });
  assert.ok(rust && typed);
  assert.notEqual(rust!.zh, typed!.zh);
  assert.match(rust!.zh, /Rust/);
  assert.match(rust!.zh, /cli/);
  assert.match(rust!.zh, /MIT/);
  assert.match(rust!.zh, /命令行/);
  assert.match(rust!.zh, /本机运行/);
  assert.match(rust!.en, /using Rust/);
  assert.match(typed!.zh, /TypeScript/);
  assert.match(typed!.zh, /Apache-2.0/);
  assert.match(typed!.en, /API key/);
  assert.equal((typed!.zh.match(/接入 MCP 服务/g) ?? []).length, 1);
  assertClear(`${rust!.zh}\n${rust!.en}\n${typed!.zh}\n${typed!.en}`);

  const licensed = buildAudienceSection({ requiresDocker: true, license: "GPL-3.0" });
  assert.match(licensed?.zh ?? "", /Docker/);
  assert.match(licensed?.zh ?? "", /GPL-3.0/);
});

test("pilot meta description is the ranking record, and blocked or huge leads are left out", () => {
  const momentum = buildMomentumSection({
    firstTrackedAt: "2025-12-01",
    points: series(3, (index) => 10 + index),
  }) as MomentumSection;
  const rich = seoPilotMetaDescription({ name: "Widget", oneLiner: "一句介绍。", momentum });
  assert.match(rich ?? "", /一句介绍。/);
  assert.match(rich ?? "", /Widget 的热度分记录/);
  assert.match(rich ?? "", /2025-12-01/);
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
  assert.match(page, /export const revalidate = 3600/);
  assert.match(page, /isSeoPilot\(/);
  assert.doesNotMatch(page, /cookies\(|headers\(|getCurrentUser/);
  assert.doesNotMatch(classic, /isSeoPilot|SeoPilot/);
  assert.doesNotMatch(sitemap, /isSeoPilot|SeoPilot/);
});
