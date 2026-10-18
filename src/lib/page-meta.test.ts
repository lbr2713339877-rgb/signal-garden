import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TODAY_DESCRIPTION,
  pageUrl,
  projectBodySummary,
  projectPageMetadata,
  todayPageMetadata,
} from "./page-meta";

const ORIGIN = "https://signalgarden.site";
const SITE_BLURB = "每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。";

test("project description uses the Chinese body summary", () => {
  const meta = projectPageMetadata({
    slug: "oil-ui",
    name: "oil-ui",
    oneLinerZh: "把几种界面方案摆到一起，先选方向，再继续打磨。",
    oneLinerEn: "Lay out interface options, then refine one.",
    origin: ORIGIN,
  });
  assert.equal(meta.title, "oil-ui");
  assert.equal(meta.description, "把几种界面方案摆到一起，先选方向，再继续打磨。");
  assert.equal(meta.alternates?.canonical, "https://signalgarden.site/p/oil-ui");
  assert.equal(meta.openGraph?.url, "https://signalgarden.site/p/oil-ui");
  assert.equal(meta.openGraph?.description, meta.description);
  assert.equal(meta.twitter?.description, meta.description);
  assert.equal(String(meta.description).includes(SITE_BLURB), false);
});

test("project description falls back to the English body line, then the name", () => {
  assert.equal(
    projectBodySummary({ name: "Widget", oneLinerZh: "  ", oneLinerEn: "Indexes functions before reading whole files." }),
    "Indexes functions before reading whole files.",
  );
  assert.equal(projectBodySummary({ name: "Widget" }), "Widget，Signal Garden 项目页。");
  assert.equal(projectBodySummary({ name: "Widget" }).includes(SITE_BLURB), false);
});

test("project canonical encodes the slug and is not the site root", () => {
  const meta = projectPageMetadata({ slug: "a b", name: "A B", origin: ORIGIN });
  assert.equal(meta.alternates?.canonical, pageUrl("/p/a%20b", ORIGIN));
  assert.notEqual(meta.openGraph?.url, `${ORIGIN}/`);
  assert.notEqual(meta.openGraph?.url, ORIGIN);
});

test("today has its own description, canonical, and og:url", () => {
  const meta = todayPageMetadata(ORIGIN);
  assert.equal(meta.description, TODAY_DESCRIPTION);
  assert.equal(meta.alternates?.canonical, "https://signalgarden.site/today");
  assert.equal(meta.openGraph?.url, "https://signalgarden.site/today");
  assert.equal(String(meta.description).includes("7 天 fork"), true);
  assert.equal(String(meta.description).includes(SITE_BLURB), false);
  assert.equal(String(meta.description).includes("面向开发者的每日项目发现站"), false);
});
