/**
 * Skill identification: skill_type + skill_confidence, with the evidence that
 * produced them.
 *
 * Confidence is the MAX of the evidence weights, not the sum. Summing lets a
 * pile of weak hints ("skill" in the name + "AI" in the description) add up
 * to a Skill — exactly the name-based guess the brief rules out.
 *
 * Only skill_type "skill" / "mcp" is gated on confidence >= 0.5. Everything
 * below that falls through to the non-skill types, never to "skill".
 */

import type { SkillType } from "@/db/schema";
import type { TreeFacts } from "@/collectors/github/tree";
import type { ManifestFacts } from "@/parsers/manifest-parser";
import type { ReadmeFacts } from "@/parsers/readme-parser";

export interface ClassifyInput {
  name: string;
  description: string | null;
  topics: string[];
  isTemplate: boolean;
  tree: TreeFacts;
  readme: ReadmeFacts | null;
  manifest: ManifestFacts;
  validSkillMdCount: number;
}

export interface Classification {
  skillType: SkillType;
  skillConfidence: number;
  evidence: { signal: string; weight: number }[];
}

const has = (list: string[], re: RegExp) => list.some((t) => re.test(t));

export function classifyRepository(input: ClassifyInput): Classification {
  const { tree, readme, manifest, topics } = input;
  const nameDesc = `${input.name} ${input.description ?? ""}`;
  const skillEv: { signal: string; weight: number }[] = [];
  const mcpEv: { signal: string; weight: number }[] = [];

  /* --- Skill evidence ---------------------------------------------------- */
  if (input.validSkillMdCount > 0) {
    skillEv.push({ signal: `${input.validSkillMdCount} SKILL.md with name + description`, weight: 0.95 });
  } else if (tree.skillMdPaths.length > 0) {
    skillEv.push({ signal: "SKILL.md present, frontmatter incomplete", weight: 0.85 });
  }
  if (tree.hasSkillsDir && tree.skillsDirMarkdown > 0) {
    skillEv.push({ signal: `skills/ directory with ${tree.skillsDirMarkdown} markdown files`, weight: 0.75 });
  }
  if (readme?.mentionsClaudeSkill && (tree.hasSkillsDir || tree.skillMdPaths.length > 0 || manifest.hasClaudePlugin)) {
    skillEv.push({ signal: "README describes a Claude / Agent Skill", weight: 0.7 });
  }
  if (manifest.hasClaudePlugin || manifest.hasClaudeMarketplace) {
    skillEv.push({ signal: "Claude Code plugin manifest", weight: 0.7 });
  }
  // Weak hints — recorded, but can never reach the 0.5 gate on their own.
  if (/skill/i.test(input.name)) skillEv.push({ signal: "name contains 'skill'", weight: 0.4 });
  if (/\b(AI|LLM|GPT|Claude|agent)\b/i.test(input.description ?? "")) {
    skillEv.push({ signal: "description mentions AI", weight: 0.2 });
  }

  /* --- MCP evidence ------------------------------------------------------ */
  if (manifest.hasMcpServerManifest) mcpEv.push({ signal: manifest.evidence.find((e) => /server\.json|smithery/.test(e)) ?? "MCP server manifest", weight: 0.85 });
  const mcpTopic = has(topics, /^(mcp|mcp-server|model-context-protocol|mcp-servers)$/i);
  if (manifest.hasMcpSdk && (mcpTopic || readme?.mentionsMcp || /\bmcp\b/i.test(nameDesc))) {
    mcpEv.push({ signal: `${manifest.evidence.find((e) => /depend/.test(e)) ?? "MCP SDK dependency"} + MCP framing`, weight: 0.8 });
  } else if (manifest.hasMcpSdk) {
    mcpEv.push({ signal: "MCP SDK dependency", weight: 0.6 });
  }
  if (readme?.hasMcpServersBlock && (mcpTopic || /\bmcp\b/i.test(nameDesc))) {
    mcpEv.push({ signal: "README ships an mcpServers config for this server", weight: 0.7 });
  }
  if (mcpTopic && readme?.mentionsMcp) mcpEv.push({ signal: "MCP topic + README", weight: 0.6 });
  if (manifest.hasMcpClientConfig) mcpEv.push({ signal: ".mcp.json (configures servers it uses)", weight: 0.3 });

  const skillMax = Math.max(0, ...skillEv.map((e) => e.weight));
  const mcpMax = Math.max(0, ...mcpEv.map((e) => e.weight));
  const evidence = [...skillEv, ...mcpEv].sort((a, b) => b.weight - a.weight);
  const confidence = Math.max(skillMax, mcpMax);

  const result = (skillType: SkillType): Classification => ({
    skillType,
    skillConfidence: Math.round(confidence * 100) / 100,
    evidence,
  });

  // A SKILL.md wins over MCP evidence: the brief ranks it highest.
  if (tree.skillMdPaths.length > 0 && skillMax >= 0.5) return result("skill");
  if (mcpMax >= 0.5 && mcpMax >= skillMax) return result("mcp");
  if (skillMax >= 0.5) return result("skill");

  /* --- Non-skill types: never gated into "skill" ------------------------- */
  const promptish = /\bprompts?\b|提示词|prompt[\s-]?(pack|library|collection)/i;
  if (tree.codeFileCount === 0 && tree.markdownCount >= 3 && (promptish.test(nameDesc) || has(topics, /prompt/i))) {
    return result("prompt_pack");
  }
  if (has(topics, /^(n8n|workflow|workflows|zapier|make-com)$/i) || (/\bworkflows?\b/i.test(nameDesc) && tree.jsonCount >= 5)) {
    return result("workflow");
  }
  if (input.isTemplate || /\b(starter|boilerplate|template)\b/i.test(nameDesc)) return result("template");
  if (has(topics, /^(ai-agents?|agents?|multi-agent|agentic(-ai)?|autonomous-agents?)$/i) || /\b(autonomous|coding|ai|multi-)\s?agents?\b|\bagent (framework|runtime|harness)\b/i.test(nameDesc)) {
    return result("agent");
  }
  if (/\bframework\b/i.test(nameDesc) || has(topics, /^framework$/i)) return result("framework");
  if (/\b(library|sdk)\b/i.test(nameDesc) || (manifest.packageName && tree.codeFileCount > 0)) return result("library");
  return result("unknown");
}
