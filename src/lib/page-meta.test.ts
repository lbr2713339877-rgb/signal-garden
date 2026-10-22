import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  EN_SHARE_DESCRIPTION,
  EN_SHARE_TITLE,
  TODAY_DESCRIPTION,
  enShareMetadata,
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

test("home metadata stays Chinese and /en share metadata is English", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/(site)/page.tsx", import.meta.url), "utf8");
  const enPage = readFileSync(new URL("../app/en/page.tsx", import.meta.url), "utf8");
  const image = readFileSync(new URL("../app/en/opengraph-image.tsx", import.meta.url), "utf8");
  const twitter = readFileSync(new URL("../app/en/twitter-image.tsx", import.meta.url), "utf8");

  assert.match(layout, /default: "Signal Garden — 今日信号"/);
  assert.match(layout, /canonical: "\/"/);
  assert.match(layout, /en: "\/"/);
  assert.match(layout, /locale: "zh_CN"/);
  assert.match(layout, /title: "Signal Garden — 今日信号"/);
  assert.match(layout, /每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。\$\{RANKING_ZH_SHORT\}/);
  assert.match(layout, /card: "summary_large_image"/);
  assert.doesNotMatch(layout, /Today's signals|Five minutes a day/);
  assert.match(layout, /alternateLocale: \["en_US"\]/);
  assert.doesNotMatch(home, /export const metadata/);

  const meta = enShareMetadata(ORIGIN);
  assert.deepEqual(meta.title, { absolute: EN_SHARE_TITLE });
  assert.equal(meta.description, EN_SHARE_DESCRIPTION);
  assert.equal(meta.alternates?.canonical, "https://signalgarden.site/en");
  assert.equal(meta.openGraph?.locale, "en_US");
  assert.equal(meta.openGraph?.url, "https://signalgarden.site/en");
  assert.equal(meta.openGraph?.title, EN_SHARE_TITLE);
  assert.equal(meta.openGraph?.description, EN_SHARE_DESCRIPTION);
  assert.equal(meta.twitter && "card" in meta.twitter ? meta.twitter.card : undefined, "summary_large_image");
  assert.equal(meta.twitter?.title, EN_SHARE_TITLE);
  assert.equal(meta.twitter?.description, EN_SHARE_DESCRIPTION);
  for (const value of [
    EN_SHARE_TITLE,
    EN_SHARE_DESCRIPTION,
    String(meta.openGraph?.title),
    String(meta.openGraph?.description),
    String(meta.twitter?.title),
    String(meta.twitter?.description),
  ]) {
    assert.equal(/[\u4e00-\u9fff]/.test(value), false);
  }
  assert.match(EN_SHARE_DESCRIPTION, /Ranked by recent star growth and other momentum signals/);

  const today = todayPageMetadata(ORIGIN);
  assert.equal(today.openGraph?.locale, "zh_CN");
  assert.match(String(today.openGraph?.title), /今日/);
  assert.match(String(today.description), /按近期 star 增长等热度信号排序/);
  const project = projectPageMetadata({ slug: "oil-ui", name: "oil-ui", origin: ORIGIN });
  assert.equal(project.openGraph?.locale, "zh_CN");

  assert.match(enPage, /enShareMetadata\(\)/);
  assert.match(enPage, /export const revalidate = 0/);
  assert.match(enPage, /export \{ default \} from "\.\.\/\(site\)\/today\/page"/);
  assert.doesNotMatch(enPage, /redirect\(/);

  assert.match(image, /ImageResponse/);
  assert.match(image, /width: 1200, height: 630/);
  assert.match(image, /background: "#030303"/);
  assert.match(image, /SIGNAL GARDEN/);
  assert.match(image, /Five minutes a day, the developer projects worth opening\./);
  assert.match(image, /Developer discovery, daily\./);
  assert.doesNotMatch(image, /[\u4e00-\u9fff]/);
  assert.match(twitter, /export \{ default \} from "\.\/opengraph-image"/);
  assert.match(twitter, /width: 1200, height: 630/);
});

test("today has its own description, canonical, and og:url", () => {
  const meta = todayPageMetadata(ORIGIN);
  assert.equal(meta.description, TODAY_DESCRIPTION);
  assert.equal(meta.alternates?.canonical, "https://signalgarden.site/today");
  assert.equal(meta.openGraph?.url, "https://signalgarden.site/today");
  assert.equal(String(meta.description).includes("按近期 star 增长等热度信号排序"), true);
  assert.equal(String(meta.description).includes("7 天 fork"), false);
  assert.equal(String(meta.description).includes(SITE_BLURB), false);
  assert.equal(String(meta.description).includes("面向开发者的每日项目发现站"), false);
});
