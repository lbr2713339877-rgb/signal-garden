import assert from "node:assert/strict";
import test from "node:test";
import { SCORING_SHORTLIST, TODAY_LIMIT, siteOrigin } from "./edition";
import { FEED_CONTENT_TYPE, renderRss, toFeedChannel } from "./feed";

const publishedAt = new Date("2026-10-16T00:00:00Z");

test("the public daily edition is 10 items", () => {
  assert.equal(TODAY_LIMIT, 10);
  assert.equal(SCORING_SHORTLIST, 30);
});

test("site origin uses NEXT_PUBLIC_SITE_URL and drops a trailing slash", () => {
  assert.equal(siteOrigin("https://signalgarden.site/"), "https://signalgarden.site");
  assert.equal(siteOrigin("  "), "http://localhost:3000");
});

test("rss lists the edition lead first with absolute project links and the edition time", () => {
  const xml = renderRss(toFeedChannel({
    origin: "https://signalgarden.site/",
    date: "2026-10-16",
    publishedAt,
    cards: [
      { name: "Alpha & Beta", slug: "alpha", oneLiner: "打开 <工具>", hook: null, description: null },
      { name: "Gamma", slug: "gamma", oneLiner: null, hook: "hook line", description: "longer description" },
    ],
  }));

  assert.match(xml, /<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /application\/rss\+xml/);
  assert.match(xml, /Alpha &amp; Beta/);
  assert.match(xml, /打开 &lt;工具&gt;/);
  assert.match(xml, /<link>https:\/\/signalgarden\.site\/p\/alpha\?utm_source=rss<\/link>/);
  assert.match(xml, /<guid isPermaLink="false">https:\/\/signalgarden\.site\/p\/alpha#2026-10-16<\/guid>/);
  assert.match(xml, /<link>https:\/\/signalgarden\.site\/\?utm_source=rss<\/link>/);
  assert.match(xml, /href="https:\/\/signalgarden\.site\/feed\.xml"/);
  assert.match(xml, /Fri, 16 Oct 2026 00:00:00 GMT/);
  assert.match(xml, /hook line/);
  assert.ok(xml.indexOf("/p/alpha") < xml.indexOf("/p/gamma"));
  assert.equal(FEED_CONTENT_TYPE, "application/rss+xml; charset=utf-8");
});

test("rss keeps at most one edition", () => {
  const cards = Array.from({ length: TODAY_LIMIT + 2 }, (_, index) => ({
    name: `Item ${index + 1}`,
    slug: `item-${index + 1}`,
    oneLiner: `summary ${index + 1}`,
  }));
  const xml = renderRss(toFeedChannel({
    origin: "https://signalgarden.site",
    date: "2026-10-16",
    publishedAt,
    cards,
  }));
  assert.equal(xml.match(/<item>/g)?.length, TODAY_LIMIT);
  assert.doesNotMatch(xml, /item-11/);
  assert.doesNotMatch(xml, /item-12/);
});

test("an unpublished day is an empty channel", () => {
  const xml = renderRss(toFeedChannel({
    origin: "https://signalgarden.site",
    date: null,
    publishedAt: null,
    now: publishedAt,
    cards: [],
  }));
  assert.match(xml, /<channel>/);
  assert.doesNotMatch(xml, /<item>/);
  assert.match(xml, /Fri, 16 Oct 2026 00:00:00 GMT/);
});
