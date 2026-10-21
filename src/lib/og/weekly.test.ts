import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { weeklyOgContent } from "./render";
import { WEEKLY_ISSUE_1 } from "../weekly-sample";

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

  const image = readFileSync(new URL("../../app/weekly/1/opengraph-image.tsx", import.meta.url), "utf8");
  const twitter = readFileSync(new URL("../../app/weekly/1/twitter-image.tsx", import.meta.url), "utf8");
  assert.match(image, /renderWeeklyOg/);
  assert.match(image, /WEEKLY_ISSUE_1/);
  assert.match(image, /contentType = "image\/png"/);
  assert.match(twitter, /export \{ default \} from "\.\/opengraph-image"/);
  assert.doesNotMatch(`${image}\n${twitter}`, /newsletterSubscriber|unsubscribe|getFeedEdition|@\/db/);
});
