/**
 * SKILL.md parser. One SKILL.md = one Skill entity.
 *
 * A valid SKILL.md opens with YAML frontmatter carrying at least `name` and
 * `description`. A file that exists but lacks them is still recorded, with
 * `valid: false` — it is evidence, but not a verified Skill.
 */

import { parse as parseYaml } from "yaml";
import { extractInstallCommands } from "./readme-parser";
import type { InstallCommand } from "./types";

export interface ParsedSkillMd {
  path: string;
  /** Directory name, the fallback identity when frontmatter has no name. */
  dirName: string;
  frontmatter: Record<string, unknown> | null;
  frontmatterError: string | null;
  name: string | null;
  description: string | null;
  license: string | null;
  allowedTools: string[];
  /** Has both `name` and `description` — the bar for a verified Skill. */
  valid: boolean;
  body: string;
  bodyExcerpt: string;
  installCommands: InstallCommand[];
}

const FRONTMATTER = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parseSkillMd(path: string, text: string): ParsedSkillMd {
  const parts = path.split("/");
  const dirName = parts.length > 1 ? parts[parts.length - 2] : "";

  let frontmatter: Record<string, unknown> | null = null;
  let frontmatterError: string | null = null;
  let body = text;

  const m = text.match(FRONTMATTER);
  if (m) {
    body = text.slice(m[0].length);
    try {
      // maxAliasCount blocks alias-expansion bombs in untrusted YAML.
      const parsed = parseYaml(m[1], { maxAliasCount: 50, uniqueKeys: false });
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      } else {
        frontmatterError = "frontmatter is not a mapping";
      }
    } catch (err) {
      frontmatterError = err instanceof Error ? err.message.split("\n")[0].slice(0, 200) : "invalid YAML";
    }
  } else {
    frontmatterError = "no frontmatter";
  }

  const name = str(frontmatter?.name);
  const description = str(frontmatter?.description);

  const tools = frontmatter?.["allowed-tools"] ?? frontmatter?.allowed_tools ?? frontmatter?.tools;
  const allowedTools = Array.isArray(tools)
    ? tools.map(String)
    : typeof tools === "string"
      ? tools.split(/[,\s]+/).filter(Boolean)
      : [];

  const plain = body.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`|-]+/g, " ").replace(/\s+/g, " ").trim();

  return {
    path,
    dirName,
    frontmatter,
    frontmatterError,
    name,
    description,
    license: str(frontmatter?.license),
    allowedTools: allowedTools.slice(0, 40),
    valid: !!(name && description),
    body,
    bodyExcerpt: plain.slice(0, 600),
    installCommands: extractInstallCommands(body, path),
  };
}
