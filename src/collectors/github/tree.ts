/**
 * Repository file tree: one REST call returns every path, which is how the
 * pipeline finds every SKILL.md in a repo without guessing at names.
 */

import { ghGet } from "./client";

export interface TreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  size?: number;
}

export interface RepoTree {
  sha: string;
  truncated: boolean;
  entries: TreeEntry[];
}

export async function fetchTree(fullName: string, ref: string): Promise<RepoTree | null> {
  const res = await ghGet<{ sha: string; truncated: boolean; tree: TreeEntry[] }>(
    `/repos/${fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
  );
  if (!res) return null;
  return { sha: res.sha, truncated: res.truncated, entries: res.tree ?? [] };
}

/** Vendored, generated or test content — a SKILL.md in here is not the repo's own. */
const IGNORED_DIR = /(^|\/)(node_modules|vendor|dist|build|\.git|__pycache__|\.venv|venv|fixtures?|__fixtures__|test-data|testdata)\//i;

const MANIFESTS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  ".mcp.json",
  "server.json",
  "smithery.yaml",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
] as const;

export interface TreeFacts {
  fileCount: number;
  truncated: boolean;
  /** Root README path exactly as it appears in the tree (case matters). */
  readmePath: string | null;
  /** Every SKILL.md outside ignored directories, sorted. */
  skillMdPaths: string[];
  /** A top-level skills/ directory (or .claude/skills/) exists. */
  hasSkillsDir: boolean;
  /** Markdown files inside that skills directory — distinguishes a Skill
   *  collection from a game with a skills/ folder of code. */
  skillsDirMarkdown: number;
  /** Root manifests present, from MANIFESTS. */
  manifestPaths: string[];
  hasDockerfile: boolean;
  hasExamplesDir: boolean;
  markdownCount: number;
  codeFileCount: number;
  jsonCount: number;
  /** Paths that imply a platform: .claude/, .cursor/, .codex/ ... */
  platformMarkers: string[];
}

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|swift|c|cc|cpp|h|cs|sh)$/i;

export function analyzeTree(entries: TreeEntry[], truncated = false): TreeFacts {
  const blobs = entries.filter((e) => e.type === "blob" && !IGNORED_DIR.test(e.path));
  const dirs = new Set(entries.filter((e) => e.type === "tree").map((e) => e.path));
  const paths = new Set(blobs.map((b) => b.path));

  const readmePath =
    blobs.find((b) => /^readme(\.(md|mdx|markdown|rst|txt))?$/i.test(b.path))?.path ?? null;

  const skillMdPaths = blobs
    .filter((b) => /(^|\/)SKILL\.md$/i.test(b.path))
    .map((b) => b.path)
    .sort();

  const skillsDirs = [...dirs].filter((d) => /^(\.claude\/)?skills$/i.test(d));
  const skillsDirMarkdown = blobs.filter((b) =>
    skillsDirs.some((d) => b.path.startsWith(`${d}/`)) && /\.md$/i.test(b.path),
  ).length;

  const markers = new Set<string>();
  for (const p of [...paths, ...dirs]) {
    const top = p.split("/")[0];
    if ([".claude", ".claude-plugin", ".cursor", ".codex", ".gemini", ".windsurf", ".clinerules", ".cursorrules"].includes(top)) {
      markers.add(top);
    }
  }

  return {
    fileCount: blobs.length,
    truncated,
    readmePath,
    skillMdPaths,
    hasSkillsDir: skillsDirs.length > 0,
    skillsDirMarkdown,
    manifestPaths: MANIFESTS.filter((m) => paths.has(m)),
    hasDockerfile: paths.has("Dockerfile") || paths.has("docker-compose.yml") || paths.has("compose.yaml"),
    hasExamplesDir: [...dirs].some((d) => /^(examples?|demos?|samples?)$/i.test(d)),
    markdownCount: blobs.filter((b) => /\.mdx?$/i.test(b.path)).length,
    codeFileCount: blobs.filter((b) => CODE_EXT.test(b.path)).length,
    jsonCount: blobs.filter((b) => /\.json$/i.test(b.path)).length,
    platformMarkers: [...markers].sort(),
  };
}
