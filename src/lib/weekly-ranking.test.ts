import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { WEEKLY_ISSUE_1 } from "./weekly-sample";
import {
  editionDay,
  selectWeeklyEditions,
  weeklyHeatRanking,
  WEEKLY_HEAT_TOP,
} from "./weekly-ranking";

test("edition days stay calendar dates", () => {
  assert.equal(editionDay("2026-10-24"), "2026-10-24");
  assert.equal(editionDay("2026-10-24T16:05:00.000Z"), "2026-10-24");
  assert.equal(editionDay(new Date("2026-10-24T00:00:00.000Z")), "2026-10-24");
  assert.equal(editionDay(null), "");
});

test("the week window is seven published editions and does not count yesterday twice", () => {
  const archive = [23, 22, 21, 20, 19, 18, 17].map((day) => ({
    date: `2026-10-${day}`,
    cards: [day],
  }));
  const withToday = selectWeeklyEditions({
    today: { date: "2026-10-24", isPrevious: false, cards: [24] },
    archive,
  });
  assert.deepEqual(
    withToday.map((edition) => edition.date),
    ["2026-10-24", "2026-10-23", "2026-10-22", "2026-10-21", "2026-10-20", "2026-10-19", "2026-10-18"],
  );

  const previous = selectWeeklyEditions({
    today: { date: "2026-10-23", isPrevious: true, cards: [23] },
    archive,
  });
  assert.equal(previous.filter((edition) => edition.date === "2026-10-23").length, 1);
  assert.equal(previous.length, 7);
  assert.equal(previous[0]?.date, "2026-10-23");
});

test("heat top 10 follows each day's published rank, the same order as issue 1", () => {
  const editions = [
    {
      date: "2026-10-19",
      cards: [
        { name: "A", slug: "a", zh: "甲", en: "A line" },
        { name: "B", slug: "b", zh: "乙", en: "B line" },
      ],
    },
    {
      date: "2026-10-18",
      cards: [{ name: "C", slug: "c", zh: "丙", en: "C line" }],
    },
    {
      date: "2026-10-17",
      cards: [
        { name: "D", slug: "d", zh: "丁", en: "D line" },
        { name: "A", slug: "a", zh: "甲重复", en: "A again" },
      ],
    },
  ];
  const ranked = weeklyHeatRanking(editions);
  assert.equal(ranked.from, "2026-10-17");
  assert.equal(ranked.to, "2026-10-19");
  assert.equal(ranked.editionCount, 3);
  assert.deepEqual(
    ranked.items.map((item) => `${item.labelZh} ${item.name}`),
    ["10/19 榜首 A", "10/19 第 2 名 B", "10/18 榜首 C", "10/17 榜首 D"],
  );
  assert.equal(ranked.items.some((item) => item.slug === "a" && item.date === "2026-10-17"), false);

  assert.equal(WEEKLY_ISSUE_1.items.length, WEEKLY_HEAT_TOP);
  assert.equal(WEEKLY_ISSUE_1.from, "2026-10-13");
  assert.equal(WEEKLY_ISSUE_1.to, "2026-10-19");
});

test("homepage and the monday mailer share this ranking", () => {
  const home = readFileSync(new URL("../app/(site)/page.tsx", import.meta.url), "utf8");
  const heat = readFileSync(new URL("../components/v3/WeeklyHeat.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../db/queries/weekly-heat.ts", import.meta.url), "utf8");
  const mailer = readFileSync(new URL("../emails/newsletter-weekly.tsx", import.meta.url), "utf8");

  assert.match(home, /WeeklyHeatTop/);
  assert.match(home, /location="home"/);
  assert.doesNotMatch(home, /Section01Hero|TodaySignals|NoiseToSignal/);
  assert.match(heat, /getThisWeekHeatTop/);
  assert.match(heat, /SubscribeLink/);
  assert.match(heat, /pd\.subscribe\.cta/);
  assert.match(loader, /selectWeeklyEditions/);
  assert.match(loader, /weeklyHeatRanking/);
  assert.doesNotMatch(`${loader}\n${heat}`, /computeHeat|new scoring|heatScore \*/);
  assert.match(mailer, /selectWeeklyEditions/);
  assert.match(mailer, /weeklyHeatRanking/);
  assert.doesNotMatch(mailer, /function dayLabel|function weeklyRanking\(\) \{\n  const editions/);
});
