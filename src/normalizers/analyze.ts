/**
 * Turns one repository's tree + files into everything the pipeline persists.
 * Pure: no network, no database. That is what makes it unit-testable against
 * fixtures and safe to re-run whenever a repository changes.
 */

import type { Category, Difficulty, SecurityLevel, SkillType } from "@/db/schema";
import type { TreeFacts } from "@/collectors/github/tree";
import { parseManifests, type ManifestFacts } from "@/parsers/manifest-parser";
import {
  detectAgents,
  detectApiKey,
  detectDocker,
  detectLocalRuntime,
  parseReadme,
} from "@/parsers/readme-parser";
import { scanRisks, securityLevelFor } from "@/parsers/risk-scanner";
import { parseSkillMd, type ParsedSkillMd } from "@/parsers/skill-md-parser";
import type { InstallCommand, RiskFlag } from "@/parsers/types";
import { sha256 } from "./fingerprint";
import { classifyRepository, type Classification } from "./classify";
import { categorize, deriveDifficulty, deriveTags } from "./category";
import { classifyTaxonomy, type Primary } from "./taxonomy";
import { scoreFocus, type FocusTheme } from "./focus";
import { toSlug } from "@/lib/utils";

/** Most SKILL.md files fetched per repository; the true count is still recorded. */
export const MAX_SKILL_FILES = 60;

/**
 * A repository carrying hundreds of SKILL.md files is not a project, it is a
 * corpus. Two thresholds:
 *
 *   > 250  it is a skill collection / registry — real projects sit under 20
 *          (anthropics/skills has 20, firecrawl 5, browser-use 7)
 *   > 1000 and under 100 stars  it is a bulk dump with no traction. The first
 *          live run found repos with 25,766 SKILL.md files, 0 stars, no
 *          description — a dump of the whole corpus into one repository.
 *
 * Neither is a Skill you install today, and a 25,766-skill "project" beside a
 * 5-skill one would make the ranking meaningless.
 */
export const SKILL_COLLECTION_THRESHOLD = 250;
export const SKILL_DUMP_THRESHOLD = 1000;
export const SKILL_DUMP_MAX_STARS = 100;

export interface RepoContext {
  name: string;
  fullName: string;
  description: string | null;
  topics: string[];
  language: string | null;
  license: string | null;
  isTemplate: boolean;
  stars: number;
  /** Discovery query ids, so a focus query that found the repo counts as evidence. */
  discoveryQueries?: string[];
}

/** Paths to fetch for a repository, derived from its tree. */
export function planFetch(tree: TreeFacts): string[] {
  const paths = [
    ...(tree.readmePath ? [tree.readmePath] : []),
    ...tree.skillMdPaths.slice(0, MAX_SKILL_FILES),
    ...tree.manifestPaths,
  ];
  return [...new Set(paths)];
}

export interface SkillRow {
  slug: string;
  name: string;
  description: string | null;
  sourcePath: string;
  skillType: SkillType;
  skillConfidence: number;
  isVerifiedSkill: boolean;
  hasSkillMd: true;
  hasInstallation: boolean;
  supportedAgents: string[];
  frontmatter: Record<string, unknown> | null;
  bodyExcerpt: string;
  installMethod: string | null;
  contentHash: string;
  riskFlags: RiskFlag[];
  focusThemes: FocusTheme[];
}

export interface Analysis {
  readmeText: string | null;
  readmeHash: string | null;
  contentHash: string;
  classification: Classification;
  category: Category;
  /** V2 taxonomy: six primaries with a second level. */
  primaryCategory: Primary;
  secondaryCategory: string | null;
  taxonomyScores: Record<string, number>;
  tags: string[];
  difficulty: Difficulty | null;
  installCommands: InstallCommand[];
  supportedAgents: string[];
  requiresApiKey: boolean;
  requiresLocalRuntime: boolean;
  requiresDocker: boolean;
  riskFlags: RiskFlag[] | null;
  securityLevel: SecurityLevel;
  isVerifiedSkill: boolean;
  hasSkillMd: boolean;
  skillCount: number;
  /** True when the repo is a corpus of Skills rather than one project. */
  isSkillCollection: boolean;
  focusThemes: FocusTheme[];
  focusScore: number;
  focusEvidence: Record<string, string[]>;
  skills: SkillRow[];
  docSignals: Record<string, unknown>;
  parseEvidence: Record<string, unknown>;
  junkReason: string | null;
  manifest: ManifestFacts;
}

const stripNul = (s: string) => s.replace(/\u0000/g, "");

export function analyzeRepository(
  repo: RepoContext,
  tree: TreeFacts,
  files: Map<string, string | null>,
): Analysis {
  const readmeText = tree.readmePath ? stripNul(files.get(tree.readmePath) ?? "") || null : null;
  const readme = readmeText ? parseReadme(readmeText) : null;

  const skillFiles: ParsedSkillMd[] = tree.skillMdPaths
    .slice(0, MAX_SKILL_FILES)
    .map((p) => [p, files.get(p)] as const)
    .filter((e): e is readonly [string, string] => typeof e[1] === "string")
    .map(([p, t]) => parseSkillMd(p, stripNul(t)));
  const validSkills = skillFiles.filter((s) => s.valid);

  const manifest = parseManifests(files);

  // Install commands: README first (it is the project's own instructions),
  // then any extra ones individual skills document.
  const seen = new Set<string>();
  const installCommands = [...(readme?.installCommands ?? []), ...skillFiles.flatMap((s) => s.installCommands)]
    .filter((c) => (seen.has(c.command) ? false : (seen.add(c.command), true)))
    .slice(0, 12);
  const kinds = [...new Set(installCommands.map((c) => c.kind))];

  const texts = [
    ...(readmeText ? [{ source: "readme", text: readmeText }] : []),
    ...skillFiles.map((s) => ({ source: s.path, text: s.body })),
  ];
  const allText = texts.map((t) => t.text).join("\n\n");

  const agents = detectAgents(texts, tree.platformMarkers, kinds);
  const apiKey = detectApiKey(allText);
  const local = detectLocalRuntime(allText, kinds);
  const docker = detectDocker(kinds);

  const classification = classifyRepository({
    name: repo.name,
    description: repo.description,
    topics: repo.topics,
    isTemplate: repo.isTemplate,
    tree,
    readme,
    manifest,
    validSkillMdCount: validSkills.length,
  });

  const { category, scores } = categorize({
    name: repo.name,
    description: repo.description,
    topics: repo.topics,
    readme: readmeText ?? skillFiles.map((s) => s.body).join("\n"),
    skillType: classification.skillType,
  });

  // V2 taxonomy runs alongside the v1 category: the old value stays for
  // compatibility, the new pair drives navigation.
  const tax = classifyTaxonomy({
    name: repo.name,
    description: repo.description,
    topics: repo.topics,
    readme: readmeText ?? skillFiles.map((s) => s.body).join("\n"),
    skillMdCount: tree.skillMdPaths.length,
    hasMcpSdk: manifest.hasMcpSdk,
  });

  const difficulty = deriveDifficulty(kinds, { apiKey: apiKey.required, local: local.required, docker: docker.required });

  const scanned = [
    ...(readmeText ? [{ source: "readme", text: readmeText }] : []),
    ...skillFiles.map((s) => ({ source: s.path, text: s.body, allowedTools: s.allowedTools })),
  ];
  const riskFlags = scanned.length || manifest.installScripts.length ? scanRisks(scanned, manifest.installScripts) : null;

  const docSignals = {
    hasReadme: !!readmeText,
    readmeLength: readmeText?.length ?? 0,
    hasInstallSection: !!readme?.hasInstallSection,
    hasInstallCommand: installCommands.length > 0,
    hasExamples: !!readme?.hasExamplesSection || tree.hasExamplesDir,
    hasLicense: !!repo.license,
    skillMdCount: tree.skillMdPaths.length,
    validSkillMdCount: validSkills.length,
    runtime: manifest.runtime,
    dependencies: manifest.dependencies.slice(0, 30),
  };
  const docsOk = (readmeText?.length ?? 0) >= 800 && installCommands.length > 0;

  const supportedAgents = agents.map((a) => a.agent);
  const tags = deriveTags({
    agents: supportedAgents,
    skillType: classification.skillType,
    category,
    language: repo.language,
    topics: repo.topics,
    dependencies: manifest.dependencies,
    readme: readmeText ?? "",
    license: repo.license,
    difficulty,
    docsOk,
  });

  let junkReason: string | null = null;
  if (tree.fileCount === 0) junkReason = "empty repository";
  else if (!readmeText && skillFiles.length === 0) junkReason = "no README and no SKILL.md";
  // A resource repo (component library, design collection) may have a sparse
  // README and no SKILL.md but still be worth listing. Only call it junk when
  // there is also nothing else to go on — no description and no traction.
  else if (
    (readmeText?.trim().length ?? 0) < 200 &&
    skillFiles.length === 0 &&
    !repo.description &&
    repo.stars < 100
  ) {
    junkReason = "no README, no SKILL.md, no description, under 100 stars";
  } else if (tree.skillMdPaths.length > SKILL_DUMP_THRESHOLD && repo.stars < SKILL_DUMP_MAX_STARS) {
    junkReason = `bulk SKILL.md corpus without traction (${tree.skillMdPaths.length} files, ${repo.stars} stars)`;
  }

  const isSkillCollection = tree.skillMdPaths.length > SKILL_COLLECTION_THRESHOLD;
  if (isSkillCollection && !tags.includes("Skill Registry")) tags.push("Skill Registry");

  const contentHash = sha256(
    [...files.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([p, t]) => `${p}\n${t ?? ""}`).join("\n\u0001\n"),
  );
  const readmeHash = readmeText ? sha256(readmeText.trim()) : null;

  // Editorial focus. Skill names and descriptions are passed in because a
  // repo called "acme/toolkit" may only reveal itself as a design system in
  // its SKILL.md.
  const focus = scoreFocus({
    name: repo.name,
    description: repo.description,
    topics: repo.topics,
    readme: readmeText,
    skillTexts: skillFiles.map((s) => `${s.name ?? s.dirName} ${s.description ?? ""}`),
    queries: repo.discoveryQueries,
  });
  // A per-skill theme list drives the "which theme does this skill serve" filter.
  const skillFocus = new Map<string, FocusTheme[]>();
  for (const s of skillFiles) {
    skillFocus.set(
      s.path,
      scoreFocus({
        name: s.name ?? s.dirName ?? repo.name,
        description: s.description,
        topics: repo.topics,
        readme: s.body,
      }).themes,
    );
  }

  // One SKILL.md = one Skill row. Slugs are unique within the project.
  const used = new Set<string>();
  const primaryInstall = installCommands[0]?.command ?? null;
  const skills: SkillRow[] = skillFiles.map((s) => {
    const baseName = s.name ?? (s.dirName || repo.name);
    let slug = toSlug(baseName) || toSlug(s.dirName) || `skill-${sha256(s.path).slice(0, 8)}`;
    for (let i = 2; used.has(slug); i++) slug = `${toSlug(baseName) || "skill"}-${i}`;
    used.add(slug);

    const ownAgents = detectAgents([{ source: s.path, text: s.body }], [], []).map((a) => a.agent);
    return {
      slug,
      name: baseName.slice(0, 120),
      description: s.description?.slice(0, 1000) ?? null,
      sourcePath: s.path,
      skillType: "skill",
      skillConfidence: s.valid ? 0.95 : 0.85,
      isVerifiedSkill: s.valid,
      hasSkillMd: true,
      hasInstallation: s.installCommands.length > 0 || installCommands.length > 0,
      supportedAgents: [...new Set([...supportedAgents, ...ownAgents])],
      frontmatter: s.frontmatter,
      bodyExcerpt: s.bodyExcerpt,
      installMethod: s.installCommands[0]?.command ?? primaryInstall,
      contentHash: sha256(s.body),
      riskFlags: scanRisks([{ source: s.path, text: s.body, allowedTools: s.allowedTools }]),
      focusThemes: skillFocus.get(s.path) ?? [],
    };
  });

  return {
    readmeText: readmeText?.slice(0, 60_000) ?? null,
    readmeHash,
    contentHash,
    classification,
    category,
    primaryCategory: tax.primary,
    secondaryCategory: tax.secondary,
    taxonomyScores: tax.scores,
    tags,
    difficulty,
    installCommands,
    supportedAgents,
    requiresApiKey: apiKey.required,
    requiresLocalRuntime: local.required,
    requiresDocker: docker.required,
    riskFlags,
    securityLevel: securityLevelFor(riskFlags),
    isVerifiedSkill: validSkills.length > 0,
    hasSkillMd: tree.skillMdPaths.length > 0,
    skillCount: tree.skillMdPaths.length,
    isSkillCollection,
    focusThemes: focus.themes,
    focusScore: focus.score,
    focusEvidence: focus.evidence,
    skills,
    docSignals,
    parseEvidence: {
      agents,
      apiKey: apiKey.evidence,
      localRuntime: local.evidence,
      docker: docker.evidence,
      classification: classification.evidence,
      categoryScores: scores,
      taxonomy: { primary: tax.primary, secondary: tax.secondary, scores: tax.scores },
      scannedSources: scanned.map((s) => s.source),
      skillMdFetched: skillFiles.length,
      skillMdTotal: tree.skillMdPaths.length,
      skillMdErrors: skillFiles.filter((s) => s.frontmatterError).map((s) => ({ path: s.path, error: s.frontmatterError })).slice(0, 10),
      treeTruncated: tree.truncated,
    },
    junkReason,
    manifest,
  };
}
