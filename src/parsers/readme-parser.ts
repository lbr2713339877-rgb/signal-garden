/**
 * Extracts facts from README (and SKILL.md bodies): install commands,
 * platforms named, whether an API key / Docker / local runtime is required.
 *
 * Every fact carries the text it came from. The AI step may rephrase these
 * facts; it may never add to them.
 */

import type { InstallCommand, InstallKind } from "./types";

/* ---------------------------------------------------------------------------
   Install commands
   ------------------------------------------------------------------------ */

const INSTALL_PATTERNS: [InstallKind, RegExp][] = [
  ["claude-plugin", /^(\/plugin\s+(install|marketplace\s+add)|claude\s+plugins?\s+(install|marketplace))\b/i],
  ["claude-mcp", /^claude\s+mcp\s+add\b/i],
  ["skills-cli", /^npx\s+(-y\s+)?skills(@[\w.-]+)?\s+add\b/i],
  ["curl-pipe", /^(curl|wget)\b.*\|\s*(sudo\s+)?(ba|z)?sh\b/i],
  ["docker", /^docker\s+(run|compose\s+up|pull)\b|^docker-compose\s+up\b/i],
  ["npx", /^(npx|bunx|pnpm\s+dlx)\s+/i],
  ["npm", /^(npm|pnpm|yarn|bun)\s+(i|install|add)\s+(-g\s+|--global\s+)?[@\w]/i],
  ["uv", /^(uvx\s+|uv\s+(tool|pip)\s+install\b)/i],
  ["pipx", /^pipx\s+(install|run)\b/i],
  ["pip", /^pip3?\s+install\s+(?!-r\b)[\w-]/i],
  ["brew", /^brew\s+install\b/i],
  ["cargo", /^cargo\s+install\b/i],
  ["go", /^go\s+install\b/i],
  ["git-clone", /^git\s+clone\b/i],
  ["manual-copy", /^(cp|mv|ln)\s+.*\.claude\/skills/i],
];

const FENCE = /```([\w+-]*)[^\n]*\n([\s\S]*?)```/g;
const INLINE = /`([^`\n]{6,200})`/g;

export function classifyCommand(line: string): InstallKind | null {
  const cmd = line.replace(/^\s*(\$|>|#\s|PS>)\s*/, "").trim();
  for (const [kind, re] of INSTALL_PATTERNS) if (re.test(cmd)) return kind;
  return null;
}

export function extractInstallCommands(markdown: string, source: string): InstallCommand[] {
  const out: InstallCommand[] = [];
  const seen = new Set<string>();
  const push = (kind: InstallKind, command: string) => {
    const c = command.trim().slice(0, 300);
    if (!c || seen.has(c)) return;
    seen.add(c);
    out.push({ kind, command: c, source });
  };

  for (const m of markdown.matchAll(FENCE)) {
    const [, lang, body] = m;
    // An MCP client config block is itself the install instruction.
    if (/json|jsonc|^$/i.test(lang) && /"mcpServers"\s*:/.test(body)) {
      push("mcp-config", body.trim().slice(0, 600));
      continue;
    }
    for (const raw of body.split("\n")) {
      const line = raw.replace(/^\s*(\$|>|PS>)\s*/, "").trim();
      const kind = classifyCommand(line);
      if (kind) push(kind, line);
    }
  }

  // READMEs often put the one-liner inline: "Run `npx foo` to start".
  const prose = markdown.replace(FENCE, "");
  for (const m of prose.matchAll(INLINE)) {
    const kind = classifyCommand(m[1]);
    if (kind) push(kind, m[1]);
  }

  // "Copy this folder into ~/.claude/skills/" — an install method, stated in prose.
  if (!out.some((c) => c.kind === "manual-copy")) {
    const copy = prose.match(/[^\n]*(copy|clone|place|put|move|drop)[^\n]*~?\/?\.claude\/skills[^\n]*/i);
    if (copy) push("manual-copy", copy[0].trim());
  }

  return out.slice(0, 12);
}

/* ---------------------------------------------------------------------------
   Supported agents — only platforms the text actually names
   ------------------------------------------------------------------------ */

const AGENT_PATTERNS: [string, RegExp][] = [
  ["claude-code", /\bclaude[\s-]code\b/i],
  ["claude-desktop", /\bclaude[\s-]desktop\b|claude_desktop_config\.json/i],
  ["claude-ai", /\bclaude\.ai\b/i],
  ["codex", /\bopenai[\s/-]codex\b|\bcodex\s+cli\b|\bcodex\s+(skill|agent)s?\b/i],
  // "cursor" alone is too common a word; require the product's own framing.
  ["cursor", /\bCursor\s+(IDE|editor|agent|rules?|skills?|settings|mcp)\b|\bin\s+Cursor\b|\.cursorrules|\.cursor\/(rules|mcp\.json)/],
  ["windsurf", /\bwindsurf\b/i],
  ["cline", /\bcline\b/i],
  ["gemini-cli", /\bgemini[\s-]cli\b/i],
  ["vscode", /\bvs\s?code\b|\bvisual studio code\b/i],
  ["opencode", /\bopencode\b/i],
  ["copilot", /\bgithub copilot\b|\bcopilot\s+(agent|chat)\b/i],
  ["zed", /\bzed\s+(editor|ide)\b/i],
];

const MARKER_AGENTS: Record<string, string> = {
  ".claude": "claude-code",
  ".claude-plugin": "claude-code",
  ".cursor": "cursor",
  ".cursorrules": "cursor",
  ".codex": "codex",
  ".gemini": "gemini-cli",
  ".windsurf": "windsurf",
  ".clinerules": "cline",
};

export interface AgentEvidence {
  agent: string;
  evidence: string;
}

export function detectAgents(
  texts: { source: string; text: string }[],
  markers: string[],
  installKinds: InstallKind[],
): AgentEvidence[] {
  const found = new Map<string, string>();

  for (const m of markers) {
    const a = MARKER_AGENTS[m];
    if (a && !found.has(a)) found.set(a, `tree: ${m}/`);
  }
  if (installKinds.some((k) => k === "claude-plugin" || k === "claude-mcp")) {
    if (!found.has("claude-code")) found.set("claude-code", "install: claude CLI command");
  }

  for (const { source, text } of texts) {
    for (const [agent, re] of AGENT_PATTERNS) {
      if (found.has(agent)) continue;
      const m = text.match(re);
      if (!m || m.index === undefined) continue;
      const start = Math.max(0, m.index - 30);
      found.set(agent, `${source}: …${text.slice(start, m.index + m[0].length + 30).replace(/\s+/g, " ").trim()}…`);
    }
  }

  return [...found].map(([agent, evidence]) => ({ agent, evidence }));
}

/* ---------------------------------------------------------------------------
   Requirements
   ------------------------------------------------------------------------ */

const NEGATION = /\b(no|without|not|don'?t|doesn'?t|never|zero)\b[^.\n]{0,24}$|无需|不需要|免/i;

function firstUnnegated(text: string, re: RegExp): string | null {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  for (const m of text.matchAll(g)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
    if (NEGATION.test(before)) continue;
    const start = Math.max(0, (m.index ?? 0) - 30);
    return text.slice(start, (m.index ?? 0) + m[0].length + 40).replace(/\s+/g, " ").trim();
  }
  return null;
}

// Env-var form is case-sensitive on purpose: OPENAI_API_KEY is a requirement,
// a lowercase page_token in sample code is not.
const ENV_KEY_RE = /\b[A-Z][A-Z0-9_]*_(API_KEY|TOKEN|SECRET|ACCESS_KEY)\b/;
const KEY_PHRASE_RE = /\bapi[\s_-]?keys?\b|\baccess[\s_-]token\b|API\s*密钥/i;
const LOCAL_RE = /\bollama\b|\bllama\.cpp\b|\bvllm\b|\bLM Studio\b|\bCUDA\b|\bGPU\b|runs?\s+(entirely\s+)?locally|本地(运行|部署)/i;

export interface Requirement {
  required: boolean;
  evidence: string | null;
}

export function detectApiKey(text: string): Requirement {
  const ev = firstUnnegated(text, ENV_KEY_RE) ?? firstUnnegated(text, KEY_PHRASE_RE);
  return { required: !!ev, evidence: ev };
}

export function detectLocalRuntime(text: string, installKinds: InstallKind[]): Requirement {
  const ev = firstUnnegated(text, LOCAL_RE);
  if (ev) return { required: true, evidence: ev };
  // Nothing but a toolchain install documented: user needs that toolchain.
  const easy = installKinds.some((k) => ["claude-plugin", "claude-mcp", "skills-cli", "manual-copy", "npx", "mcp-config"].includes(k));
  if (!easy && installKinds.some((k) => ["cargo", "go", "git-clone"].includes(k))) {
    return { required: true, evidence: `install: ${installKinds.join(", ")}` };
  }
  return { required: false, evidence: null };
}

export function detectDocker(installKinds: InstallKind[]): Requirement {
  const onlyDocker = installKinds.length > 0 && installKinds.every((k) => k === "docker");
  return { required: onlyDocker, evidence: onlyDocker ? "install: docker only" : null };
}

/* ---------------------------------------------------------------------------
   README structure
   ------------------------------------------------------------------------ */

export interface ReadmeFacts {
  length: number;
  headings: string[];
  hasInstallSection: boolean;
  hasExamplesSection: boolean;
  mentionsClaudeSkill: boolean;
  mentionsMcp: boolean;
  hasMcpServersBlock: boolean;
  installCommands: InstallCommand[];
}

const CLAUDE_SKILL_RE = /\b(claude|agent|codex)\s+skills?\b|\bSKILL\.md\b|\bAgent Skills\b/i;
const MCP_RE = /\bmodel context protocol\b|\bMCP\s+(server|client|tool)s?\b/i;

export function parseReadme(markdown: string): ReadmeFacts {
  const headings = [...markdown.matchAll(/^#{1,4}\s+(.+?)\s*#*\s*$/gm)].map((m) => m[1].trim()).slice(0, 60);
  return {
    length: markdown.length,
    headings,
    hasInstallSection: headings.some((h) => /install|setup|set up|getting started|quick\s*start|安装|快速开始|使用方法/i.test(h)),
    hasExamplesSection: headings.some((h) => /example|demo|showcase|usage example|示例|演示/i.test(h)),
    mentionsClaudeSkill: CLAUDE_SKILL_RE.test(markdown),
    mentionsMcp: MCP_RE.test(markdown),
    hasMcpServersBlock: /"mcpServers"\s*:/.test(markdown),
    installCommands: extractInstallCommands(markdown, "readme"),
  };
}
