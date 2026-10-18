import assert from "node:assert/strict";
import { test } from "node:test";
import { projectOgStat, todayOgForkCell } from "./metric";

test("project cards omit an unmeasured fork count and fall back to 24-hour stars", () => {
  assert.equal(projectOgStat({ forks7d: null, stars24h: null, missing: true }), null);
  assert.equal(projectOgStat({ forks7d: null, stars24h: null }), null);
  assert.deepEqual(projectOgStat({ forks7d: 8, stars24h: 3 }), {
    value: "8",
    label: "7-day new forks · 7 日新增 fork",
  });
  assert.deepEqual(projectOgStat({ forks7d: null, stars24h: 3 }), {
    value: "+3",
    label: "stars / 24h",
  });
  assert.equal(todayOgForkCell(null), "");
  assert.equal(todayOgForkCell(4.8), "4");
  assert.doesNotMatch(todayOgForkCell(null), /—|-/);
});
