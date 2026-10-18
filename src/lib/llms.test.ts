import assert from "node:assert/strict";
import { test } from "node:test";
import { llmsTxt } from "./llms";

test("llms.txt names the site, the daily URLs, fork deltas, languages, and contact", () => {
  const text = llmsTxt("https://signalgarden.site");
  assert.match(text, /Signal Garden/);
  assert.match(text, /https:\/\/signalgarden\.site\//);
  assert.match(text, /https:\/\/signalgarden\.site\/today/);
  assert.match(text, /https:\/\/signalgarden\.site\/feed\.xml/);
  assert.match(text, /https:\/\/signalgarden\.site\/p\/\{slug\}/);
  assert.match(text, /7-day fork delta/);
  assert.match(text, /not a lifetime star count|Do not treat a lifetime star count/);
  assert.match(text, /中文 \/ English/);
  assert.match(text, /hello@signalgarden\.site/);
  assert.match(text, /robots\.txt allows \//);
});
