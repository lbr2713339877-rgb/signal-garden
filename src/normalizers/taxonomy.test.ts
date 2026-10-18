import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyTaxonomy, taxonomy, secondaryLabel, TAXONOMY } from "./taxonomy";

const base = {
  name: "x",
  description: null as string | null,
  topics: [] as string[],
  readme: "",
  skillMdCount: 0,
  hasMcpSdk: false,
};

test("every primary has a second level (V2 §5 requires one)", () => {
  for (const t of TAXONOMY) {
    assert.ok(t.secondary.length >= 3, `${t.key} has only ${t.secondary.length} subcategories`);
    // Keys must be unique within a primary, since they are used as URL state.
    const keys = t.secondary.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length, `${t.key} has duplicate secondary keys`);
  }
});

test("domain wins over skill-ness: a design Skill is Design, not Skill", () => {
  const r = classifyTaxonomy({
    ...base,
    name: "frontend-design",
    description: "A design system skill with Figma and Tailwind support",
    topics: ["design", "ui", "tailwind"],
    skillMdCount: 1,
  });
  assert.equal(r.primary, "design", `got ${r.primary}`);
});

test("a multi-skill collection is Skills & Agents", () => {
  const r = classifyTaxonomy({
    ...base,
    name: "awesome-agent-skills",
    description: "A big collection of agent skills",
    topics: ["agent-skills"],
    skillMdCount: 40,
  });
  assert.equal(r.primary, "skill-agent", `got ${r.primary}`);
  assert.equal(r.secondary, "collection");
});

test("an MCP server lands in Skills & Agents", () => {
  const r = classifyTaxonomy({
    ...base,
    name: "weather-mcp",
    description: "Weather MCP server for LLM agents",
    topics: ["mcp"],
    hasMcpSdk: true,
  });
  assert.equal(r.primary, "skill-agent", `got ${r.primary}`);
  assert.equal(r.secondary, "mcp-server");
});

test("a landing-page builder is Indie Web, not AI Tools", () => {
  const r = classifyTaxonomy({
    ...base,
    name: "sitecraft",
    description: "Build and deploy a landing page for your SaaS in minutes",
    topics: ["landing-page", "saas-boilerplate"],
  });
  assert.equal(r.primary, "indie-web", `got ${r.primary}`);
});

test("token compression is Productivity / cost", () => {
  const r = classifyTaxonomy({
    ...base,
    name: "headroom",
    description: "Compress tool outputs, logs, files and RAG chunks before they reach the model",
    topics: ["token-optimization"],
  });
  assert.equal(r.primary, "productivity", `got ${r.primary}`);
  assert.equal(r.secondary, "cost");
});

test("motion libraries are Design / motion", () => {
  const r = classifyTaxonomy({
    ...base,
    name: "animate-ui",
    description: "Animated components built on Framer Motion and Tailwind",
    topics: ["animation", "components"],
  });
  assert.equal(r.primary, "design", `got ${r.primary}`);
  assert.equal(r.secondary, "motion");
});

test("an unrelated repo still gets a category rather than none", () => {
  const r = classifyTaxonomy({ ...base, name: "some-tool", description: "A small utility" });
  assert.ok(TAXONOMY.some((t) => t.key === r.primary));
});

test("taxonomy lookup and secondary labels resolve", () => {
  assert.equal(taxonomy("design")?.label, "设计资源");
  assert.equal(taxonomy("nope"), null);
  assert.equal(taxonomy(null), null);
  assert.equal(secondaryLabel("design", "motion"), "动效与交互");
  assert.equal(secondaryLabel("design", "not-a-key"), null);
  assert.equal(secondaryLabel("design", null), null);
});

test("booking applications are categorized by purpose rather than their UI stack", () => {
  const r = classifyTaxonomy({ ...base, name: "cal.diy", description: "Open source scheduling and appointment booking",
    topics: ["tailwindcss", "ui", "css"], readme: "Uses a design system, animated components and Figma." });
  assert.equal(r.primary, "productivity");
  assert.equal(r.secondary, "email-calendar");
});

test("admin starters belong to project templates, not email apps", () => {
  const r = classifyTaxonomy({ ...base, name: "next-shadcn-admin-dashboard", description: "Admin dashboard starter template with email and calendar examples",
    topics: ["tailwindcss", "ui"], readme: "Includes email, calendar, notes and a design system." });
  assert.equal(r.primary, "dev-tools");
  assert.equal(r.secondary, "templates");
});

test("learning materials do not inherit an image-generation product label", () => {
  const r = classifyTaxonomy({ ...base, name: "vibe-vibe", description: "AI coding tutorial and learning roadmap",
    topics: ["ai", "vibe-coding"], readme: "Learn image generation, video and AI tools." });
  assert.equal(r.primary, "dev-tools");
  assert.equal(r.secondary, "learning");
});

test('an animation skill is classified by what it does', () => {
  const r = classifyTaxonomy({ ...base, name: 'motion-dev-animations-skill', skillMdCount: 1,
    description: 'Claude Code skill for Motion.dev -- 120fps web animations, spring physics, scroll effects, gesture interactions',
    topics: ['animation-library', 'developer-tools', 'framer-motion'] });
  assert.equal(r.primary, 'design');
  assert.equal(r.secondary, 'motion');
});

test('a shipped skill is not treated as reading material because its summary says guide', () => {
  const r = classifyTaxonomy({ ...base, name: 'frontend-design', skillMdCount: 1,
    description: 'A design system guide for your coding agent', topics: ['design', 'ui'] });
  assert.equal(r.primary, 'design');
  assert.notEqual(r.secondary, 'learning');
});
