import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFocus, FOCUS_MIN } from "./focus";

const f = (over: Partial<Parameters<typeof scoreFocus>[0]>) =>
  scoreFocus({ name: "x", description: null, topics: [], ...over });

test("token saving is recognised from the description", () => {
  const r = f({ description: "🪨 why use many token when few token do trick. Viral skill + proxy" });
  assert.ok(r.themes.includes("token"), `expected token theme, got ${r.themes}`);

  const rtk = f({ description: "CLI proxy that reduces LLM token consumption by 60-90% on common dev commands" });
  assert.ok(rtk.themes.includes("token"));

  const room = f({ description: "Compress tool outputs, logs, files, and RAG chunks before they reach the model" });
  assert.ok(room.themes.includes("token"), `got ${room.themes}`);
});

test("a single weak signal alone does not make a theme; two signals do", () => {
  // One pattern in the description = 2 points, under the threshold on its own.
  const weak = f({ description: "Ships a CLI for prompt compression" });
  assert.equal(weak.scores.token, 2);
  assert.ok(weak.scores.token < FOCUS_MIN);
  assert.equal(weak.themes.length, 0);

  // A README mention is worth less than a description mention, but the two
  // together clear the bar.
  const both = f({
    description: "Ships a CLI for prompt compression",
    readme: "It works by compressing the context before it reaches the model.",
  });
  assert.ok(both.themes.includes("token"), `got ${JSON.stringify(both.scores)}`);
});

test("a bare 'token' is not the token theme — auth tokens are not cost saving", () => {
  for (const description of [
    "A JWT access token library for Node",
    "Handles GITHUB_TOKEN and OAuth credentials",
    "Design tokens for the Acme design system",
  ]) {
    const r = f({ description, topics: [] });
    assert.ok(!r.themes.includes("token"), `false positive on: ${description}`);
  }
});

test("design tokens alone are design, not token saving", () => {
  const r = f({ name: "tokens", description: "Design tokens packaged for Tailwind" });
  assert.ok(r.themes.includes("design"));
  assert.ok(!r.themes.includes("token"));
});

test("motion libraries are in focus", () => {
  const r = f({ name: "motion", description: "A modern animation library for React and JavaScript" });
  assert.ok(r.themes.includes("motion"), `got ${r.themes}`);

  const gsap = f({ name: "gsap-skills", topics: ["gsap", "animation"] });
  assert.ok(gsap.themes.includes("motion"));
});

test("indie site building is in focus; a generic SaaS list is not", () => {
  const builder = f({ name: "sitecraft", description: "Build and deploy a landing page for your SaaS in minutes" });
  assert.ok(builder.themes.includes("web"), `got ${builder.themes}`);

  const list = f({ name: "free-for-dev", description: "A list of SaaS, PaaS and IaaS offerings with free tiers" });
  assert.equal(list.themes.length, 0, `false positive: ${list.themes}`);
});

test("unrelated repos are out of focus", () => {
  const paths = [
    { name: "crawl4ai", description: "Open-source web crawler and scraper for LLMs" },
    { name: "angular", description: "Deliver web apps with confidence" },
    { name: "system_prompts_leaks", description: "Documented system prompts from Anthropic" },
  ];
  for (const p of paths) {
    const r = f({ ...p, topics: [] });
    assert.ok(r.score < FOCUS_MIN, `${p.name} should be out of focus, scored ${r.score}`);
  }
});

test("a focus query is evidence on its own", () => {
  const r = f({ name: "acme-tool", queries: ["focus:motion:code:animation"] });
  assert.ok(r.themes.includes("motion"));
  assert.ok(r.score >= FOCUS_MIN);
});

test("themes and score are consistent", () => {
  const r = f({ name: "design-system", description: "A UI/UX design system skill with Figma support" });
  assert.ok(r.themes.includes("design"));
  assert.equal(r.score, Math.max(...Object.values(r.scores)));
  for (const t of r.themes) assert.ok(r.scores[t] >= FOCUS_MIN);
});
