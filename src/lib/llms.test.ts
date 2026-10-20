import assert from "node:assert/strict";
import { test } from "node:test";
import { llmsTxt } from "./llms";

test("llms.txt names the site, the daily URLs, momentum ranking, languages, and contact", () => {
  const text = llmsTxt("https://signalgarden.site");
  assert.match(text, /Signal Garden/);
  assert.match(text, /https:\/\/signalgarden\.site\//);
  assert.match(text, /https:\/\/signalgarden\.site\/today/);
  assert.match(text, /https:\/\/signalgarden\.site\/feed\.xml/);
  assert.match(text, /https:\/\/signalgarden\.site\/api\/today\.json/);
  assert.match(text, /utm_source/);
  assert.match(text, /https:\/\/signalgarden\.site\/p\/\{slug\}/);
  assert.match(text, /ranked by recent star growth and other momentum signals/);
  assert.doesNotMatch(text, /7-day fork delta/);
  assert.doesNotMatch(text, /star\/fork growth/);
  assert.match(text, /not a lifetime star count|Do not treat a lifetime star count/);
  assert.match(text, /中文 \/ English/);
  assert.match(text, /Monday weekly digest/);
  assert.match(text, /每周一周刊/);
  assert.match(text, /daily discovery site/);
  assert.match(text, /hello@signalgarden\.site/);
  assert.match(text, /robots\.txt allows \//);
});

test("links the sample weekly issue", () => {
  assert.ok(llmsTxt("https://signalgarden.site").includes("https://signalgarden.site/weekly/1"));
});
