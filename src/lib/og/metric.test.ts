import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { snapshotStarGrowth } from "@/lib/star-growth";
import { projectOgStat, todayOgForkCell } from "./metric";

const FORBIDDEN = [/fork/i, /涨得最快/, /ranked by forks/i];

test("project cards show the page star range and a heat-score label", () => {
  assert.equal(projectOgStat({ missing: true, starsFrom: 592, starsTo: 924, heatScore: 80 }), null);
  assert.equal(projectOgStat({}), null);
  assert.equal(projectOgStat({ heatScore: 0, starsRecent: 0 }), null);

  const growth = snapshotStarGrowth([{ stars: 592 }, { stars: 700 }, { stars: 924 }]);
  const ranged = projectOgStat({
    starsFrom: growth?.from,
    starsTo: growth?.to,
    starsRecent: 332,
    heatScore: 84,
  });
  assert.deepEqual(ranged, { value: "592 → 924 stars", label: "热度分 84" });

  assert.deepEqual(projectOgStat({ starsRecent: 332, heatScore: 70.4 }), {
    value: "近期 +332",
    label: "热度分 70.4",
  });
  assert.deepEqual(projectOgStat({ starsRecent: -12 }), {
    value: "近期 −12",
    label: "按热度分",
  });
  assert.deepEqual(projectOgStat({ heatScore: 86.2 }), {
    value: "86.2",
    label: "热度分",
  });

  for (const stat of [ranged, projectOgStat({ starsRecent: 332, heatScore: 70.4 }), projectOgStat({ heatScore: 86.2 })]) {
    const line = `${stat?.value ?? ""} ${stat?.label ?? ""}`;
    for (const pattern of FORBIDDEN) assert.doesNotMatch(line, pattern);
  }

  const render = readFileSync(new URL("./render.tsx", import.meta.url), "utf8");
  const projectFn = render.slice(render.indexOf("export function renderProjectOg"), render.indexOf("export function renderTodayOg"));
  for (const pattern of FORBIDDEN) assert.doesNotMatch(projectFn, pattern);
  assert.equal(todayOgForkCell(null), "");
  assert.equal(todayOgForkCell(4.8), "4");
  assert.doesNotMatch(todayOgForkCell(null), /—|-/);
});
