import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeTree, type TreeEntry } from "@/collectors/github/tree";
import { analyzeRepository, planFetch, type RepoContext } from "./analyze";
import { canonicalGithubUrl, canonicalId, homepageDomain } from "./dedupe";
import { deriveDifficulty } from "./category";
import { fingerprint } from "./fingerprint";

const blob = (path: string): TreeEntry => ({ path, type: "blob" });
const dir = (path: string): TreeEntry => ({ path, type: "tree" });

function repo(over: Partial<RepoContext> = {}): RepoContext {
  const base: RepoContext = {
    name: "x",
    fullName: "acme/x",
    description: null,
    topics: [],
    language: null,
    license: "MIT",
    isTemplate: false,
    stars: 50,
  };
  return { ...base, ...over };
}

function run(ctx: RepoContext, entries: TreeEntry[], files: Record<string, string>) {
  const tree = analyzeTree(entries);
  return analyzeRepository(ctx, tree, new Map(Object.entries(files)));
}

test("tree: vendored SKILL.md is ignored; plugin markers are found", () => {
  const t = analyzeTree([
    blob("README.md"),
    dir("skills"),
    blob("skills/pdf/SKILL.md"),
    blob("node_modules/foo/SKILL.md"),
    blob(".claude-plugin/plugin.json"),
  ]);
  assert.deepEqual(t.skillMdPaths, ["skills/pdf/SKILL.md"]);
  assert.equal(t.hasSkillsDir, true);
  assert.equal(t.readmePath, "README.md");
  assert.ok(t.manifestPaths.includes(".claude-plugin/plugin.json"));
  assert.deepEqual(planFetch(t), ["README.md", "skills/pdf/SKILL.md", ".claude-plugin/plugin.json"]);
});

test("a repo with valid SKILL.md files is a verified Skill with one row per file", () => {
  const a = run(
    repo({ name: "skills", fullName: "acme/skills", description: "Agent skills" }),
    [blob("README.md"), dir("skills"), blob("skills/pdf/SKILL.md"), blob("skills/docs/SKILL.md")],
    {
      "README.md": "# Skills\nInstall in Claude Code:\n```\n/plugin marketplace add acme/skills\n```\n" + "x ".repeat(400),
      "skills/pdf/SKILL.md": "---\nname: pdf\ndescription: PDF tools\n---\nbody",
      "skills/docs/SKILL.md": "---\nname: documents\ndescription: Docs\n---\nbody",
    },
  );
  assert.equal(a.classification.skillType, "skill");
  assert.ok(a.classification.skillConfidence >= 0.9);
  assert.equal(a.isVerifiedSkill, true);
  assert.deepEqual(a.skills.map((s) => s.slug).sort(), ["documents", "pdf"]);
  assert.equal(a.difficulty, "one_click");
  assert.ok(a.supportedAgents.includes("claude-code"));
});

test("'skill' in the name alone never makes a Skill", () => {
  const a = run(
    repo({ name: "skill-tree-game", description: "An AI powered skill tree for RPGs" }),
    [blob("README.md"), blob("src/main.ts"), dir("skills"), blob("skills/fire.ts")],
    { "README.md": "# Skill tree\n" + "Game code. ".repeat(60) },
  );
  assert.notEqual(a.classification.skillType, "skill");
  assert.notEqual(a.classification.skillType, "mcp");
  assert.ok(a.classification.skillConfidence < 0.5);
  assert.equal(a.skills.length, 0);
});

test("an MCP server is typed mcp, not skill", () => {
  const a = run(
    repo({ name: "weather-mcp", description: "Weather MCP server", topics: ["mcp"], language: "TypeScript" }),
    [blob("README.md"), blob("package.json"), blob("src/index.ts")],
    {
      "README.md": "# Weather MCP server\nA Model Context Protocol server.\n```json\n{\"mcpServers\":{\"weather\":{\"command\":\"npx\"}}}\n```",
      "package.json": JSON.stringify({ name: "weather-mcp", dependencies: { "@modelcontextprotocol/sdk": "1.0.0" } }),
    },
  );
  assert.equal(a.classification.skillType, "mcp");
  assert.ok(a.classification.skillConfidence >= 0.8);
  assert.ok(a.tags.includes("MCP"));
});

test("markdown-only prompt collections are prompt_pack, never skill", () => {
  const a = run(
    repo({ name: "awesome-prompts", description: "Prompt collection for ChatGPT" }),
    [blob("README.md"), blob("a.md"), blob("b.md"), blob("c.md")],
    { "README.md": "# Prompts\n" + "A prompt. ".repeat(50) },
  );
  assert.equal(a.classification.skillType, "prompt_pack");
});

test("a strong design signal puts a Skill in Design & UI", () => {
  const a = run(
    repo({ name: "frontend-design", description: "Frontend design skill", topics: ["design", "ui", "tailwind"] }),
    [blob("SKILL.md")],
    { "SKILL.md": "---\nname: frontend-design\ndescription: Build good UI\n---\nUse tailwind." },
  );
  assert.equal(a.classification.skillType, "skill");
  assert.equal(a.category, "design");
});

test("junk: no README and no SKILL.md", () => {
  const a = run(repo(), [blob("LICENSE")], {});
  assert.equal(a.junkReason, "no README and no SKILL.md");
});

test("a bulk SKILL.md corpus without traction is flagged, a real collection is not", () => {
  const bulk = [
    blob("README.md"),
    ...Array.from({ length: 1200 }, (_, i) => blob(`skills/s${i}/SKILL.md`)),
  ];
  const dumped = run(repo({ stars: 3 }), bulk, { "README.md": "Corpus dump. ".repeat(30) });
  assert.match(dumped.junkReason ?? "", /bulk SKILL\.md corpus/);
  assert.equal(dumped.isSkillCollection, true);

  // Same shape with real traction: kept, but marked as a registry.
  const popular = run(repo({ stars: 1600, description: "German law skills" }), bulk, {
    "README.md": "Experimental skill collection. ".repeat(30),
  });
  assert.equal(popular.junkReason, null);
  assert.equal(popular.isSkillCollection, true);
  assert.ok(popular.tags.includes("Skill Registry"));

  // A normal project is neither.
  const normal = run(repo({ stars: 100 }), [blob("README.md"), blob("skills/a/SKILL.md")], { "README.md": "A skill. ".repeat(40) });
  assert.equal(normal.isSkillCollection, false);
  assert.equal(normal.junkReason, null);
});

test("dedupe keys follow the brief's priority order", () => {
  assert.equal(canonicalId({ githubId: 42, domain: "x.com" }), "gh:42");
  assert.equal(canonicalId({ githubUrl: "https://GitHub.com/Foo/Bar.git" }), "url:github.com/foo/bar");
  assert.equal(canonicalGithubUrl("git@github.com:foo/bar.git"), "github.com/foo/bar");
  assert.equal(homepageDomain("https://www.Example.com/docs"), "example.com");
  assert.equal(homepageDomain("https://acme.github.io/x"), null);
});

test("difficulty: easiest install is the baseline, requirements raise it", () => {
  assert.equal(deriveDifficulty(["npx", "git-clone"], { apiKey: false, local: false, docker: false }), "one_click");
  assert.equal(deriveDifficulty(["npx"], { apiKey: true, local: false, docker: false }), "needs_api_key");
  assert.equal(deriveDifficulty([], { apiKey: false, local: false, docker: false }), null);
});

test("fingerprint ignores key order", () => {
  assert.equal(fingerprint({ a: 1, b: [1, 2] }), fingerprint({ b: [1, 2], a: 1 }));
});
