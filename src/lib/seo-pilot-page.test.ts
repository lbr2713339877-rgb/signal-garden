import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import ProjectPage, { generateMetadata } from "@/app/p/[slug]/page";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoPilotSections } from "@/components/v3/detail/SeoPilotSections";
import { getSeoPilotSlugSet } from "@/db/queries/seo-pilot";
import { projectPageMetadata } from "@/lib/page-meta";
import { containsSeoPilotBlocked, seoPilotPlainText, type SeoPilotView } from "@/lib/seo-pilot";

const BLOCKED = [/fork/i, /fastest/i, /涨得最快/];

function walk(node: unknown, visit: (el: { type: unknown; props: Record<string, unknown> }) => void) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  const el = node as { props?: Record<string, unknown> };
  if (!el.props) return;
  visit(el as { type: unknown; props: Record<string, unknown> });
  walk(el.props.children, visit);
}

function renderSeo(node: unknown, acc: { text: string[]; hrefs: string[]; sections: string[]; polylines: string[]; detailsOpen: boolean[] }) {
  if (node == null || typeof node === "boolean") return;
  if (typeof node === "string" || typeof node === "number") {
    acc.text.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) renderSeo(child, acc);
    return;
  }
  if (typeof node !== "object" || !("props" in node)) return;
  const el = node as { type: unknown; props?: Record<string, unknown> };
  if (!el.props) return;
  if (el.type === "details") acc.detailsOpen.push(el.props.open === true);
  if (typeof el.props["data-seo-section"] === "string") acc.sections.push(el.props["data-seo-section"]);
  if (typeof el.props.points === "string") acc.polylines.push(el.props.points);
  if (typeof el.props.href === "string") {
    acc.hrefs.push(el.props.href);
    renderSeo(el.props.children, acc);
    return;
  }
  if (typeof el.type === "function") {
    renderSeo((el.type as (props: Record<string, unknown>) => unknown)(el.props), acc);
    return;
  }
  renderSeo(el.props.children, acc);
}

test("pilot pages gain factual sections and every other project page stays as it is", async () => {
  const raw = new PGlite();
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };

  async function add(slug: string, over: Partial<typeof schema.project.$inferInsert> = {}) {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: `gh:${slug}`,
      slug,
      name: slug,
      owner: "acme",
      fullName: `acme/${slug}`,
      primaryUrl: `https://github.com/acme/${slug}`,
      description: null,
      parseState: "parsed",
      ...over,
    }).returning();
    await d.insert(schema.aiContent).values({
      projectId: row.id,
      locale: "zh",
      oneLiner: `${slug} 的一句介绍。`,
      passedGuard: true,
    });
    return row;
  }

  async function publish(projectId: string, rows: { date: string; rank: number; heat: number }[], published = true) {
    for (const row of rows) {
      await d.insert(schema.dailySignal).values({
        projectId,
        signalDate: row.date,
        rank: row.rank,
        heatScore: row.heat,
        breakdown: {},
        isPublished: published,
      });
    }
  }

  try {
    const pilot = await add("pilot", {
      language: "Rust",
      topics: ["cli"],
      license: "MIT",
      description: "A command-line helper for logs",
      skillType: "library",
      requiresLocalRuntime: true,
      primaryCategory: "dev-tools",
      firstTrackedAt: new Date("2025-12-01T00:00:00.000Z"),
    });
    await publish(pilot.id, [
      { date: "2025-12-20", rank: 20, heat: 8 },
      { date: "2025-12-21", rank: 11, heat: 9 },
    ], false);
    await publish(pilot.id, [
      { date: "2026-01-01", rank: 8, heat: 10 },
      { date: "2026-01-02", rank: 6, heat: 12.5 },
      { date: "2026-01-03", rank: 7, heat: 11 },
      { date: "2026-01-04", rank: 2, heat: 15 },
      { date: "2026-01-05", rank: 4, heat: 14 },
    ]);

    const listed = await add("listed");
    await publish(listed.id, [
      { date: "2026-05-01", rank: 3, heat: 4 },
      { date: "2026-05-02", rank: 2, heat: 5 },
    ]);
    await publish(listed.id, [
      { date: "2026-05-03", rank: 8, heat: 4 },
      { date: "2026-05-04", rank: 8, heat: 4 },
      { date: "2026-05-05", rank: 8, heat: 4 },
      { date: "2026-05-06", rank: 8, heat: 4 },
    ], false);

    const shadow = await add("shadow");
    await publish(shadow.id, Array.from({ length: 6 }, (_, index) => ({
      date: `2026-06-${String(index + 1).padStart(2, "0")}`,
      rank: index + 1,
      heat: index + 2,
    })), false);

    const bare = await add("bare");
    await publish(bare.id, [
      { date: "2026-02-01", rank: 5, heat: 3 },
      { date: "2026-02-02", rank: 5, heat: 3 },
      { date: "2026-02-03", rank: 5, heat: 3 },
      { date: "2026-02-04", rank: 3, heat: 4 },
    ]);

    const thin = await add("thin", {
      language: "TypeScript",
      license: "MIT",
      description: "A command-line tool",
      skillType: "library",
      requiresLocalRuntime: true,
    });
    await publish(thin.id, [
      { date: "2026-01-01", rank: 3, heat: 20 },
      { date: "2026-01-02", rank: 2, heat: 21 },
    ]);

    const hidden = await add("hidden-hot", { hidden: true, language: "Rust", primaryCategory: "dev-tools" });
    await publish(hidden.id, Array.from({ length: 8 }, (_, index) => ({
      date: `2026-03-${String(index + 1).padStart(2, "0")}`,
      rank: 1,
      heat: 30,
    })));

    for (const slug of ["rust-a", "rust-b", "rust-c", "rust-d"]) {
      const row = await add(slug, { language: "Rust", primaryCategory: "dev-tools" });
      await publish(row.id, [{ date: "2026-04-01", rank: 6, heat: 9 }]);
    }
    const topic = await add("topic-peer", { language: "Python", topics: ["cli"] });
    await publish(topic.id, [{ date: "2026-04-02", rank: 7, heat: 6 }]);
    const draft = await add("draft-peer", { language: "Rust", primaryCategory: "dev-tools" });
    await publish(draft.id, [{ date: "2026-04-03", rank: 1, heat: 99 }], false);

    assert.deepEqual([...(await getSeoPilotSlugSet())], ["pilot", "listed", "shadow", "bare"]);

    const thinMeta = await generateMetadata({ params: Promise.resolve({ slug: "thin" }) });
    assert.equal(thinMeta.description, projectPageMetadata({
      slug: "thin",
      name: "thin",
      oneLinerZh: "thin 的一句介绍。",
      oneLinerEn: "A command-line tool",
    }).description);
    assert.equal(String(thinMeta.description).includes("热度分记录"), false);
    assert.equal(thinMeta.alternates?.canonical, projectPageMetadata({ slug: "thin", name: "thin" }).alternates?.canonical);

    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    const thinPage = await ProjectPage({ params: Promise.resolve({ slug: "thin" }) });
    const thinPilot: unknown[] = [];
    const thinJson: unknown[] = [];
    walk(thinPage, (el) => {
      if (el.type === SeoPilotSections) thinPilot.push(el);
      if (el.type === JsonLd) thinJson.push(el.props.data);
    });
    assert.equal(thinPilot.length, 0);
    assert.equal(thinJson.length, 1);
    const thinGraph = (thinJson[0] as { "@graph": Record<string, unknown>[] })["@graph"];
    assert.equal(thinGraph[0]?.["@type"], "SoftwareSourceCode");
    assert.equal(thinGraph[0]?.description, "thin 的一句介绍。");

    const pilotMeta = await generateMetadata({ params: Promise.resolve({ slug: "pilot" }) });
    assert.match(String(pilotMeta.description), /pilot 的一句介绍。/);
    assert.match(String(pilotMeta.description), /热度分记录/);
    assert.match(String(pilotMeta.description), /2025-12-20/);
    assert.doesNotMatch(String(pilotMeta.description), /2025-12-01/);
    assert.match(String(pilotMeta.description), /第 2 名/);
    assert.match(String(pilotMeta.description), /峰值 15/);
    for (const pattern of BLOCKED) assert.doesNotMatch(String(pilotMeta.description), pattern);
    assert.match(String(pilotMeta.alternates?.canonical), /\/p\/pilot$/);

    const pilotPage = await ProjectPage({ params: Promise.resolve({ slug: "pilot" }) });
    let pilotView: SeoPilotView | null = null;
    const pilotJson: unknown[] = [];
    walk(pilotPage, (el) => {
      if (el.type === SeoPilotSections) pilotView = el.props.view as SeoPilotView;
      if (el.type === JsonLd) pilotJson.push(el.props.data);
    });
    assert.ok(pilotView);
    const view = pilotView as SeoPilotView;
    assert.equal(view.momentum?.bestRank, 2);
    assert.equal(view.momentum?.bestHeat, "15");
    assert.equal(view.momentum?.firstTracked, "2025-12-20");
    assert.match(view.momentum?.summaryZh ?? "", /自 2025-12-20 起追踪 7 天/);
    assert.match(view.momentum?.summaryZh ?? "", /峰值 15，出现在 2026-01-04/);
    assert.equal(view.momentum?.trackedDays, 7);
    assert.equal(view.momentum?.publishedDays, 5);
    assert.equal(view.momentum?.rows.length, 7);
    assert.match(view.momentum?.rows[0]?.lineZh ?? "", /上榜/);
    assert.match(view.momentum?.rows[0]?.lineZh ?? "", /较上次记录 −1/);
    assert.match(view.momentum?.rows.at(-1)?.lineZh ?? "", /2025-12-20/);
    assert.doesNotMatch(view.momentum?.rows.at(-1)?.lineZh ?? "", /上榜|名次/);
    assert.deepEqual(view.peers?.peers.map((peer) => peer.slug), ["rust-a", "rust-b", "rust-c", "rust-d", "topic-peer"]);
    assert.equal(view.audience?.zh, "适合使用 Rust、并且关注 cli 的人。仓库许可为 MIT。");
    assert.equal(view.audience?.en, "For people using Rust and following cli. The repository license is MIT.");
    assert.match(view.momentum?.summaryEn ?? "", /Tracked 7 days since/);
    assert.match(view.momentum?.summaryEn ?? "", /On the published ranking 5 days/);
    assert.doesNotMatch(view.momentum?.summaryEn ?? "", /\b1 days\b/);
    assert.doesNotMatch(`${view.audience?.zh ?? ""}\n${view.audience?.en ?? ""}`, /命令行|local runtime|API key|SKILL\.md|技能包|代码库|skill package|library/i);
    for (const pattern of BLOCKED) assert.doesNotMatch(seoPilotPlainText(view), pattern);

    const rendered = { text: [] as string[], hrefs: [] as string[], sections: [] as string[], polylines: [] as string[], detailsOpen: [] as boolean[] };
    renderSeo(SeoPilotSections({ view }), rendered);
    const renderedText = rendered.text.join("\n");
    assert.deepEqual(rendered.sections, ["momentum", "peers", "audience"]);
    assert.match(renderedText, /追踪记录/);
    assert.match(renderedText, /Tracked record/);
    assert.match(renderedText, /MOMENTUM/);
    assert.match(renderedText, /同类项目对比/);
    assert.match(renderedText, /适合谁用/);
    assert.deepEqual(rendered.detailsOpen, [false]);
    assert.match(renderedText, /每日记录/);
    assert.match(renderedText, /Daily record/);
    assert.match(renderedText, /数据说明：走势来自 Signal Garden 每日追踪的热度分；只有标注「上榜」的日期出现在公开每日榜单上。/);
    assert.match(renderedText, /Data note: the trend uses Signal Garden\u2019s daily tracked momentum scores; only dates marked \u201cRanked\u201d appeared on the public daily list\./);
    assert.ok(rendered.polylines.some((points) => points.includes(" ")));
    for (const href of ["/p/rust-a", "/p/rust-b", "/p/rust-c", "/p/rust-d", "/p/topic-peer"]) {
      assert.ok(rendered.hrefs.includes(href), href);
    }
    assert.equal(rendered.hrefs.includes("/p/draft-peer"), false);
    assert.equal(rendered.hrefs.includes("/p/thin"), false);
    for (const pattern of BLOCKED) assert.doesNotMatch(renderedText, pattern);

    assert.equal(pilotJson.length, 1);
    const pilotGraph = (pilotJson[0] as { "@graph": Record<string, unknown>[] })["@graph"];
    assert.equal(pilotGraph[0]?.["@type"], "SoftwareSourceCode");
    assert.equal(pilotGraph[0]?.description, pilotMeta.description);

    const barePage = await ProjectPage({ params: Promise.resolve({ slug: "bare" }) });
    let bareView: SeoPilotView | null = null;
    walk(barePage, (el) => {
      if (el.type === SeoPilotSections) bareView = el.props.view as SeoPilotView;
    });
    assert.ok(bareView);
    const bareSeo = bareView as SeoPilotView;
    assert.ok(bareSeo.momentum);
    assert.equal(bareSeo.peers, null);
    assert.equal(bareSeo.audience, null);
    assert.equal(bareSeo.momentum?.firstTracked, "2026-02-01");
    assert.notEqual(bareSeo.momentum?.summaryZh, view.momentum?.summaryZh);

    const shadowPage = await ProjectPage({ params: Promise.resolve({ slug: "shadow" }) });
    let shadowView: SeoPilotView | null = null;
    walk(shadowPage, (el) => {
      if (el.type === SeoPilotSections) shadowView = el.props.view as SeoPilotView;
    });
    assert.ok(shadowView);
    const shadowSeo = shadowView as SeoPilotView;
    assert.ok(shadowSeo.momentum);
    assert.equal(shadowSeo.momentum?.bestRank, null);
    assert.equal(shadowSeo.momentum?.publishedDays, 0);
    assert.equal(shadowSeo.peers, null);
    assert.equal(shadowSeo.audience, null);
    const shadowText = seoPilotPlainText(shadowSeo);
    assert.match(shadowText, /追踪记录/);
    assert.match(shadowText, /该项目尚未出现在公开每日榜单上/);
    assert.doesNotMatch(shadowText, /只有标注「上榜」/);
    assert.match(shadowText, /最高水平/);
    assert.match(shadowText, /Tracked 6 days since/);
    assert.doesNotMatch(shadowText, /上榜|名次|峰值|published ranking|\b1 days\b/);
    for (const pattern of BLOCKED) assert.doesNotMatch(shadowText, pattern);
    const bareRendered = { text: [] as string[], hrefs: [] as string[], sections: [] as string[], polylines: [] as string[], detailsOpen: [] as boolean[] };
    renderSeo(SeoPilotSections({ view: bareSeo }), bareRendered);
    assert.deepEqual(bareRendered.sections, ["momentum"]);
    assert.equal(bareRendered.text.join("\n").includes("适合谁用"), false);
    assert.equal(bareRendered.text.join("\n").includes("同类项目对比"), false);
    for (const pattern of BLOCKED) assert.doesNotMatch(bareRendered.text.join("\n"), pattern);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
