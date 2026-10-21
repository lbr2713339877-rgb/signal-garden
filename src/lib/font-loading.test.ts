import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("font CSS is self-hosted, swap, and limited to used weights", () => {
  const layout = read("../app/layout.tsx");
  const fonts = read("../app/fonts.ts");
  const tokens = read("../app/v3/tokens.css");
  const combined = `${layout}\n${fonts}\n${tokens}`;

  assert.match(layout, /fontVariableClassName/);
  assert.match(fonts, /next\/font\/local/);
  assert.match(fonts, /next\/font\/google/);
  assert.equal(fonts.match(/display:\s*"swap"/g)?.length, 8);
  assert.match(fonts, /preload:\s*true/);
  assert.match(fonts, /Noto_Sans_SC\(\{[\s\S]*weight:\s*\["400", "500"\]/);
  assert.match(fonts, /Noto_Serif_SC\(\{[\s\S]*weight:\s*"400"/);
  assert.match(fonts, /weight:\s*"300 600"/);
  assert.doesNotMatch(fonts, /instrument-serif-italic/);
  assert.doesNotMatch(fonts, /weight:\s*"600"|wght@600|Noto Serif SC:wght@400;600/);
  assert.doesNotMatch(combined, /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|href=["'][^"']*fonts\.css/);
  assert.doesNotMatch(combined, /lxgwwenkai|wenkai-webfont|font-family:\s*['"]LXGW WenKai/i);
  assert.doesNotMatch(layout, /rel="stylesheet"/);
});

test("hero headline is visible on first paint and has no per-character fade", () => {
  const hero = read("../components/v3/Section01Hero.tsx");
  assert.match(hero, /<h1 className="display-xl hero-headline mt-10">/);
  assert.match(hero, /Something new/);
  assert.match(hero, /is taking shape\./);
  assert.doesNotMatch(hero, /hero-char|color:\s*transparent|sr-only|Array\.from\(line\)/);

  const rule = hero.match(/\.hero-headline \{[\s\S]*?\}/)?.[0] ?? "";
  assert.match(rule, /color:\s*var\(--ink-1\)/);
  assert.match(rule, /hero-headline-in/);
  assert.doesNotMatch(rule, /opacity/);

  const keyframes = hero.match(/@keyframes hero-headline-in \{[\s\S]*?\n        \}/)?.[0] ?? "";
  assert.match(keyframes, /transform:\s*translateY\(12px\)/);
  assert.match(keyframes, /transform:\s*translateY\(0\)/);
  assert.doesNotMatch(keyframes, /opacity/);

  const reduced = hero.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n        \}/)?.[0] ?? "";
  assert.match(reduced, /\.hero-headline \{[\s\S]*animation:\s*none/);
});
