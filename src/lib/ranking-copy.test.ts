import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DICT } from "./dict";
import {
  FORK_CARD_NOTE_EN,
  FORK_CARD_NOTE_ZH,
  RANKING_EN_LONG,
  RANKING_EN_SHORT,
  RANKING_ZH_LONG,
  RANKING_ZH_SHORT,
} from "./site";

const FORBIDDEN = [/新增 fork 排序/, /Ranked by forks/, /不再提供 star/, /star\/fork growth/, /ranked by 7-day new forks/i];

test("public ranking copy uses the heat score and does not say the board is ranked by forks", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const joined = Object.values(DICT).flat().join("\n") + "\n" + readme;
  for (const pattern of FORBIDDEN) assert.doesNotMatch(joined, pattern);
  assert.match(readme, new RegExp(RANKING_ZH_LONG));
  assert.match(readme, new RegExp(RANKING_EN_LONG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(DICT["home.editionNote"][0], new RegExp(RANKING_ZH_LONG));
  assert.match(DICT["home.editionNote"][1], new RegExp(RANKING_EN_LONG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(DICT["sponsor.intro"][0], new RegExp(RANKING_ZH_LONG));
  assert.match(DICT["sponsor.audienceBody"][1], /momentum score/);
  assert.match(DICT["footer.tagline"][0], new RegExp(RANKING_ZH_SHORT));
  assert.match(DICT["footer.tagline"][1], new RegExp(RANKING_EN_SHORT));
  assert.match(DICT["pg.trend.methodBody"][0], new RegExp(RANKING_ZH_LONG));
  assert.match(DICT["pg.trend.methodBody"][0], new RegExp(FORK_CARD_NOTE_ZH));
  assert.match(DICT["pg.trend.methodBody"][1], new RegExp(FORK_CARD_NOTE_EN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(DICT["pg.trend.growthTitle"][0], "7 日新增 fork");
  assert.equal(DICT["pg.trend.growthTitle"][1], "7-day new forks");
  assert.doesNotMatch(DICT["pg.trend.methodBody"][0], /排序。GitHub/);
  assert.doesNotMatch(DICT["pg.trend.growthTitle"].join(" "), /排名|Ranked by/i);
});
