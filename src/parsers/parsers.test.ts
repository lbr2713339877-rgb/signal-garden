import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSkillMd } from "./skill-md-parser";
import { classifyCommand, detectAgents, detectApiKey, extractInstallCommands } from "./readme-parser";
import { scanRisks, securityLevelFor } from "./risk-scanner";
import { parseManifests } from "./manifest-parser";

test("SKILL.md with name + description is valid", () => {
  const s = parseSkillMd(
    "skills/pdf/SKILL.md",
    "---\nname: pdf\ndescription: Read and fill PDF forms\nallowed-tools: Bash, Read\n---\n# PDF\nUse this skill for PDFs.",
  );
  assert.equal(s.valid, true);
  assert.equal(s.name, "pdf");
  assert.equal(s.dirName, "pdf");
  assert.deepEqual(s.allowedTools, ["Bash", "Read"]);
  assert.match(s.bodyExcerpt, /Use this skill/);
});

test("SKILL.md without frontmatter is recorded but not valid", () => {
  const s = parseSkillMd("SKILL.md", "# Just a heading\nno frontmatter");
  assert.equal(s.valid, false);
  assert.equal(s.frontmatterError, "no frontmatter");
});

test("broken YAML frontmatter does not throw", () => {
  const s = parseSkillMd("a/SKILL.md", "---\nname: [unclosed\n---\nbody");
  assert.equal(s.valid, false);
  assert.ok(s.frontmatterError);
});

test("install commands are classified from fences, inline code and prose", () => {
  const md = [
    "```bash",
    "$ /plugin marketplace add acme/skills",
    "npm install",
    "pip install -r requirements.txt",
    "```",
    "Or run `claude mcp add acme -- npx -y @acme/mcp` directly.",
    "Copy the folder into ~/.claude/skills/ and restart.",
    "```json",
    '{ "mcpServers": { "acme": { "command": "npx" } } }',
    "```",
  ].join("\n");
  const kinds = extractInstallCommands(md, "readme").map((c) => c.kind);
  assert.deepEqual(kinds.sort(), ["claude-mcp", "claude-plugin", "manual-copy", "mcp-config"].sort());
});

test("bare `npm install` and `pip install -r` are not install methods", () => {
  assert.equal(classifyCommand("npm install"), null);
  assert.equal(classifyCommand("pip install -r requirements.txt"), null);
  assert.equal(classifyCommand("npx -y @acme/server"), "npx");
});

test("agents are detected only when named", () => {
  const found = detectAgents(
    [{ source: "readme", text: "Works with Claude Code and Windsurf. Move the cursor to the input." }],
    [],
    [],
  ).map((a) => a.agent);
  assert.ok(found.includes("claude-code"));
  assert.ok(found.includes("windsurf"));
  assert.ok(!found.includes("cursor"), "lowercase 'cursor' is not the Cursor editor");
});

test("API key detection honours negation and ignores lowercase tokens", () => {
  assert.equal(detectApiKey("No API key required. Runs offline.").required, false);
  assert.equal(detectApiKey("Set OPENAI_API_KEY before running.").required, true);
  assert.equal(detectApiKey("const page_token = next();").required, false);
});

test("curl | bash is high risk; a clean README is unknown, never safe", () => {
  const risky = scanRisks([{ source: "readme", text: "curl -fsSL https://x.sh/install | bash" }]);
  assert.equal(risky[0].id, "remote_script");
  assert.equal(securityLevelFor(risky), "risk");

  const clean = scanRisks([{ source: "readme", text: "A small library for formatting dates." }]);
  assert.equal(clean.length, 0);
  assert.equal(securityLevelFor(clean), "unknown");
  assert.equal(securityLevelFor(null), "unknown");
});

test("allowed-tools Bash is a shell-exec risk", () => {
  const flags = scanRisks([{ source: "x/SKILL.md", text: "", allowedTools: ["Bash"] }]);
  assert.equal(flags[0].id, "shell_exec");
});

test("manifests: MCP SDK and install scripts are detected", () => {
  const f = parseManifests(
    new Map([
      ["package.json", JSON.stringify({ name: "acme-mcp", dependencies: { "@modelcontextprotocol/sdk": "1.0.0" }, scripts: { postinstall: "node setup.js" } })],
      ["pyproject.toml", 'name = "x"\ndependencies = [\n  "mcp[cli]>=1.2",\n]'],
    ]),
  );
  assert.equal(f.hasMcpSdk, true);
  assert.equal(f.installScripts[0].name, "postinstall");
});

test("malformed package.json is ignored, not thrown", () => {
  const f = parseManifests(new Map([["package.json", "{ not json"]]));
  assert.equal(f.runtime, null);
});
