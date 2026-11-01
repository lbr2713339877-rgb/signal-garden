import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderWeeklyOg, weeklyOgContent } from "./render";
import { WEEKLY_ISSUE_1, WEEKLY_ISSUE_2, WEEKLY_ISSUE_3 } from "../weekly-sample";

test("weekly issue 1 share card uses the public sample and the site card style", () => {
  const content = weeklyOgContent({
    issue: WEEKLY_ISSUE_1.issue,
    from: WEEKLY_ISSUE_1.from,
    to: WEEKLY_ISSUE_1.to,
    names: WEEKLY_ISSUE_1.items.map((item) => item.name),
  });
  assert.equal(content.title, "第 1 期");
  assert.equal(content.range, "2026-10-13 – 2026-10-19");
  assert.equal(content.footer, "每周精选");
  assert.deepEqual(content.names, ["ascii", "animate", "herk-edit-kit", "dsh-ops", "filmcraft"]);
  assert.equal(JSON.stringify(content).includes("unsubscribe"), false);

  const image = readFileSync(new URL("../../app/weekly/[issue]/opengraph-image.tsx", import.meta.url), "utf8");
  const twitter = readFileSync(new URL("../../app/weekly/[issue]/twitter-image.tsx", import.meta.url), "utf8");
  assert.match(image, /renderWeeklyOg/);
  assert.match(image, /weeklyIssueByNumber/);
  assert.match(image, /contentType = "image\/png"/);
  assert.match(twitter, /export \{ default \} from "\.\/opengraph-image"/);
  assert.doesNotMatch(`${image}\n${twitter}`, /newsletterSubscriber|unsubscribe|getFeedEdition|@\/db/);

  const issue2 = weeklyOgContent({
    issue: WEEKLY_ISSUE_2.issue,
    from: WEEKLY_ISSUE_2.from,
    to: WEEKLY_ISSUE_2.to,
    names: WEEKLY_ISSUE_2.items.map((item) => item.name),
  });
  assert.equal(issue2.title, "第 2 期");
  assert.equal(issue2.range, "2026-10-20 – 2026-10-26");
  assert.deepEqual(issue2.names, ["thinkrail", "Convx", "TOMC", "skills", "hairline"]);

  const issue3 = weeklyOgContent({
    issue: WEEKLY_ISSUE_3.issue,
    from: WEEKLY_ISSUE_3.from,
    to: WEEKLY_ISSUE_3.to,
    names: WEEKLY_ISSUE_3.items.map((item) => item.name),
  });
  assert.equal(issue3.title, "第 3 期");
  assert.equal(issue3.range, "2026-10-27 – 2026-11-02");
  assert.deepEqual(issue3.names, ["DeepSeekBot", "cleanyourtv", "design-agent", "reanimate", "EAC-design-world"]);
  assert.equal(JSON.stringify(issue3).includes("unsubscribe"), false);
});

test("weekly issue 3 open graph image renders a png", async () => {
  const image = await renderWeeklyOg({
    issue: WEEKLY_ISSUE_3.issue,
    from: WEEKLY_ISSUE_3.from,
    to: WEEKLY_ISSUE_3.to,
    names: WEEKLY_ISSUE_3.items.map((item) => item.name),
  });
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type") ?? "", /image\/png/);
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(bytes.length > 1000);
});
