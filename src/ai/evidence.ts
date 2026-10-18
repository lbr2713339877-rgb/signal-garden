/**
 * Evidence bundle: everything the AI step is allowed to know about a project.
 *
 * The model never sees the database and never gets to look anything up. It
 * receives this object and nothing else, which is what makes the guard in
 * guard.ts able to check every claim against a closed set of facts.
 */

import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { externalMention, project, skill } from "@/db/schema";

export interface Evidence {
  fullName: string;
  name: string;
  url: string;
  description: string | null;
  topics: string[];
  license: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  commits7d: number;
  createdAt: string | null;
  pushedAt: string | null;
  skillType: string;
  supportedAgents: string[];
  installCommands: { kind: string; command: string }[];
  requiresApiKey: boolean;
  requiresLocalRuntime: boolean;
  requiresDocker: boolean;
  difficulty: string | null;
  securityLevel: string;
  /** The static scan's findings, including the matched text. */
  riskFlags: { id: string; label: string; severity: string; snippet: string }[];
  /** Names + descriptions of the skills inside this repo. */
  skills: { name: string; description: string | null }[];
  /** README, trimmed to the parts that carry facts. */
  readme: string;
  /** External discussion, if any has been collected. */
  mentions: { source: string; title: string | null; points: number; comments: number }[];
  docSignals: Record<string, unknown>;
  projectKind?: string;
}

/** Sections of a README that actually carry install/usage facts. */
const WANTED = /install|setup|set up|getting started|quick ?start|usage|requirement|prerequisit|配置|安装|使用|依赖/i;

/**
 * Keeps the README under a token budget without dropping the parts that matter:
 * headings, fenced code blocks, and any section whose heading looks like
 * install/usage. Prose padding is removed first.
 */
export function trimReadme(markdown: string, budget = 6000): string {
  if (markdown.length <= budget) return markdown;

  const lines = markdown.split("\n");
  const kept: string[] = [];
  let inWanted = false;
  let inFence = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      kept.push(line);
      continue;
    }
    if (inFence) {
      kept.push(line);
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      inWanted = WANTED.test(line);
      kept.push(line);
      continue;
    }
    // Outside a wanted section, keep only headings and code — not prose.
    if (inWanted) kept.push(line);
  }

  const joined = kept.join("\n").replace(/\n{3,}/g, "\n\n");
  return joined.length <= budget ? joined : `${joined.slice(0, budget)}\n…[truncated]`;
}

export async function buildEvidence(projectId: string): Promise<Evidence | null> {
  const d = await db();
  const [p] = await d.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (!p) return null;

  const rows = await d
    .select({ name: skill.name, description: skill.description })
    .from(skill)
    .where(eq(skill.projectId, p.id))
    .orderBy(desc(skill.isVerifiedSkill), skill.name)
    .limit(40);

  const mentions = await d
    .select({
      source: externalMention.source,
      title: externalMention.title,
      points: externalMention.points,
      comments: externalMention.comments,
    })
    .from(externalMention)
    .where(eq(externalMention.projectId, p.id))
    .orderBy(desc(externalMention.points))
    .limit(8);

  return {
    projectKind: p.projectKind,
    fullName: p.fullName ?? p.name,
    name: p.name,
    url: p.primaryUrl,
    description: p.description,
    topics: p.topics ?? [],
    license: p.license,
    language: p.language,
    stars: p.stars,
    forks: p.forks,
    openIssues: p.openIssues,
    commits7d: p.commits7d,
    createdAt: p.upstreamCreatedAt ? new Date(p.upstreamCreatedAt).toISOString().slice(0, 10) : null,
    pushedAt: p.upstreamPushedAt ? new Date(p.upstreamPushedAt).toISOString().slice(0, 10) : null,
    skillType: p.skillType,
    supportedAgents: p.supportedAgents ?? [],
    installCommands: (p.installCommands ?? []).map((c: any) => ({ kind: c.kind, command: c.command })),
    requiresApiKey: p.requiresApiKey,
    requiresLocalRuntime: p.requiresLocalRuntime,
    requiresDocker: p.requiresDocker,
    difficulty: p.difficulty,
    securityLevel: p.securityLevel,
    riskFlags: ((p.riskFlags ?? []) as any[]).map((f) => ({
      id: f.id,
      label: f.label,
      severity: f.severity,
      snippet: f.snippet,
    })),
    skills: rows as any,
    readme: trimReadme(p.readmeText ?? ""),
    mentions: mentions as any,
    docSignals: (p.docSignals ?? {}) as Record<string, unknown>,
  };
}

/** Human-readable evidence block for the prompt. */
export function renderEvidence(e: Evidence): string {
  const lines: string[] = [
    `项目：${e.fullName}`,
    `来源类型：${e.projectKind === "product" || e.projectKind === "story_derived" ? "托管网站（没有 GitHub 星数，未进行源码安全扫描）" : "开源仓库"}`,
    `地址：${e.url}`,
    `描述：${e.description ?? "（无）"}`,
    `主题标签：${e.topics.join(", ") || "（无）"}`,
    `语言：${e.language ?? "未知"} · 许可证：${e.license ?? "未知"}`,
    `数据：${e.stars} stars · ${e.forks} forks · ${e.openIssues} open issues · 近 7 天 ${e.commits7d} 次提交`,
    `创建：${e.createdAt ?? "未知"} · 最近提交：${e.pushedAt ?? "未知"}`,
    `类型判定：${e.skillType} · 支持平台：${e.supportedAgents.join(", ") || "未知"}`,
    `难度：${e.difficulty ?? "未识别"} · 需要 API Key：${e.requiresApiKey ? "是" : "否"} · 需要本地环境：${e.requiresLocalRuntime ? "是" : "否"}`,
    `安全等级：${e.securityLevel}`,
  ];

  if (e.docSignals.hasOfficialPage) {
    lines.push("", `官方产品资料：${e.docSignals.websiteEvidenceUrl}`, `体验入口：${JSON.stringify(e.docSignals.usageLinks ?? [])}`);
  }
  if (e.installCommands.length) {
    lines.push("", "安装命令（来自文档）：");
    for (const c of e.installCommands.slice(0, 6)) lines.push(`  [${c.kind}] ${c.command}`);
  }

  if (e.riskFlags.length) {
    lines.push("", "静态扫描命中的风险（文档中出现的原文）：");
    for (const f of e.riskFlags) lines.push(`  [${f.severity}] ${f.label} — 出自 ${f.snippet}`);
  } else if (!e.docSignals.hasOfficialPage) {
    lines.push("", "静态扫描：文档中未命中已知风险模式（不代表安全）。");
  }

  if (e.skills.length) {
    lines.push("", `包含的 Skill（共 ${e.skills.length} 个，展示前 20）：`);
    for (const s of e.skills.slice(0, 20)) {
      lines.push(`  - ${s.name}${s.description ? `：${s.description.slice(0, 120)}` : ""}`);
    }
  }

  if (e.mentions.length) {
    lines.push("", "外部讨论：");
    for (const m of e.mentions) lines.push(`  [${m.source}] ${m.title ?? ""} (${m.points} points, ${m.comments} comments)`);
  }

  lines.push("", "README（已按段落裁剪）：", e.readme || "（未获取到 README）");
  return lines.join("\n");
}
