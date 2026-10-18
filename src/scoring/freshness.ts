/**
 * Freshness: how new is this, on a decaying curve.
 *
 * A 30-day half-life. A repo published today scores ~100, one from last month
 * ~50, one from six months ago ~1.5. This is what stops a long-established
 * project from holding the top of "what's new" forever on accumulated stars.
 */

const HALF_LIFE_DAYS = 30;

export function freshnessScore(createdAt: Date | string | null, now = new Date()): number {
  if (!createdAt) return 0;
  const days = (now.getTime() - new Date(createdAt).getTime()) / 86_400_000;
  if (!Number.isFinite(days)) return 0;
  if (days <= 0) return 100;
  return 100 * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/**
 * Documentation quality from facts the parser actually established.
 *
 * Deliberately shallow: it measures whether the repo explains itself, not
 * whether the software is any good. Nothing here is inferred by a model.
 */
export interface DocFacts {
  hasReadme: boolean;
  readmeLength: number;
  hasInstallSection: boolean;
  hasInstallCommand: boolean;
  hasExamples: boolean;
  hasLicense: boolean;
  validSkillMdCount: number;
}

export function documentationScore(d: DocFacts): number {
  let s = 0;
  if (d.hasReadme) s += 25;
  // Length is a weak proxy, so it is worth little and saturates early.
  if (d.readmeLength >= 2000) s += 15;
  else if (d.readmeLength >= 800) s += 10;
  else if (d.readmeLength >= 200) s += 5;
  if (d.hasInstallCommand) s += 25;
  else if (d.hasInstallSection) s += 10;
  if (d.hasExamples) s += 15;
  if (d.hasLicense) s += 10;
  if (d.validSkillMdCount > 0) s += 10;
  return Math.min(100, s);
}

/** Completeness of the Skill itself, when the repo ships SKILL.md files. */
export function skillCompleteness(f: {
  hasSkillMd: boolean;
  validSkillMdCount: number;
  skillMdCount: number;
  hasInstallation: boolean;
}): number {
  if (!f.hasSkillMd) return 0;
  let s = 40;
  if (f.validSkillMdCount > 0) s += 35; // frontmatter with name + description
  if (f.hasInstallation) s += 25;
  return Math.min(100, s);
}
