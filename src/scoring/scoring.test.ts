import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, logNormalize, percentile } from "./normalize";
import { documentationScore, freshnessScore, skillCompleteness } from "./freshness";
import { computeHeat, deriveGrowthStatus, heatBasis, isSpike, qualityGrade, type HeatInput } from "./heat";

function input(over: Partial<HeatInput> = {}): HeatInput {
  return {
    slug: "acme/tool",
    stars: 500,
    forks: 30,
    stars24hAgo: 480,
    stars7dAgo: 420,
    commits7d: 8,
    issuesOpened7d: 3,
    externalMentions: [],
    createdAt: new Date(Date.now() - 60 * 86_400_000),
    pushedAt: new Date(Date.now() - 2 * 86_400_000),
    docs: {
      hasReadme: true,
      readmeLength: 2500,
      hasInstallSection: true,
      hasInstallCommand: true,
      hasExamples: true,
      hasLicense: true,
      validSkillMdCount: 2,
    },
    hasSkillMd: true,
    validSkillMdCount: 2,
    skillMdCount: 2,
    hasInstallation: true,
    hasMaintainerCommit: true,
    isFork: false,
    isDuplicate: false,
    securityLevel: "review",
    linkDead: false,
    starsAtDiscovery: 400,
    ...over,
  };
}

test("log normalisation: p95 lands at 100, outliers do not dominate", () => {
  assert.equal(Math.round(logNormalize(1000, 1000)), 100);
  // Twice the p95 does not score twice the maximum.
  assert.ok(logNormalize(2000, 1000) <= 100);
  // A tenth of the p95 is still visible, not crushed to zero.
  assert.ok(logNormalize(100, 1000) > 30);

  // A giant repo cannot rescale everyone else to nothing: p95 is fixed by the
  // pool, and these two share the same scale.
  const small = logNormalize(200, 1000);
  const large = logNormalize(2000, 1000);
  assert.ok(large > small);
  assert.ok(large <= 100);
});

test("percentile picks a value from the sample", () => {
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(xs, 95), 95);
  assert.equal(percentile([], 95), 0);
});

test("freshness halves every 30 days and never goes negative", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  assert.equal(freshnessScore(new Date("2026-06-01T00:00:00Z"), now), 100);
  assert.equal(Math.round(freshnessScore(new Date("2026-05-02T00:00:00Z"), now)), 50);
  assert.ok(freshnessScore(new Date("2020-01-01T00:00:00Z"), now) < 1);
  assert.ok(freshnessScore(new Date("2026-06-02T00:00:00Z"), now) === 100, "a future date is not penalised");
});

test("documentation score is built only from parser facts", () => {
  const full = documentationScore({
    hasReadme: true, readmeLength: 3000, hasInstallSection: true,
    hasInstallCommand: true, hasExamples: true, hasLicense: true, validSkillMdCount: 1,
  });
  assert.ok(full >= 90);

  const bare = documentationScore({
    hasReadme: false, readmeLength: 0, hasInstallSection: false,
    hasInstallCommand: false, hasExamples: false, hasLicense: false, validSkillMdCount: 0,
  });
  assert.equal(bare, 0);
});

test("skill completeness only counts when SKILL.md exists", () => {
  assert.equal(skillCompleteness({ hasSkillMd: false, validSkillMdCount: 0, skillMdCount: 0, hasInstallation: true }), 0);
  assert.ok(skillCompleteness({ hasSkillMd: true, validSkillMdCount: 1, skillMdCount: 1, hasInstallation: true }) >= 90);
});

test("heat: a growing, documented, active repo scores high", () => {
  const r = computeHeat(input(), heatBasis([input()]));
  assert.ok(r.heatScore > 50, `expected a strong score, got ${r.heatScore}`);
  assert.match(r.reason, /Stars|提交|讨论/);
  assert.ok(r.breakdown.corrections.some((c) => c.code === "skill_md"));
});

test("heat: a stale repo with no growth scores low", () => {
  const r = computeHeat(
    input({
      stars24hAgo: 500,
      stars7dAgo: 500,
      commits7d: 0,
      pushedAt: new Date(Date.now() - 200 * 86_400_000),
      createdAt: new Date(Date.now() - 900 * 86_400_000),
      docs: { hasReadme: true, readmeLength: 100, hasInstallSection: false, hasInstallCommand: false, hasExamples: false, hasLicense: false, validSkillMdCount: 0 },
      hasSkillMd: false,
      validSkillMdCount: 0,
      skillMdCount: 0,
      hasInstallation: false,
    }),
    heatBasis([input()]),
  );
  assert.ok(r.heatScore < 15, `expected a weak score, got ${r.heatScore}`);
  assert.ok(r.breakdown.corrections.some((c) => c.code === "stale"));
  // A quiet repo now reports its standing (and possibly its usability) instead
  // of printing an internal "no growth" marker.
  assert.ok(r.reason.length > 0);
});

test("heat: a 15-day-old repo scoring 3 stars is not rescued by growth rate", () => {
  // 3 stars -> 30 is +900%, which a naive growth-rate term would let win.
  const youngInput = input({
    stars: 30,
    stars24hAgo: 20,
    stars7dAgo: 3,
    createdAt: new Date(Date.now() - 15 * 86_400_000),
    commits7d: 2,
  });
  const grownInput = input({
    stars: 3000,
    stars24hAgo: 2800,
    stars7dAgo: 2000,
    createdAt: new Date(Date.now() - 15 * 86_400_000),
    commits7d: 2,
  });
  // Both are scored against the same pool, which is the whole point.
  const basis = heatBasis([youngInput, grownInput]);
  const young = computeHeat(youngInput, basis);
  const grown = computeHeat(grownInput, basis);
  assert.ok(grown.heatScore > young.heatScore, "absolute size should decide between two new repos");
});

test("heat: basis is shared, so a quiet repo is not automatically a maximum", () => {
  // The bug this guards: deriving the baseline from the item being scored made
  // every item its own p95, so 3 -> 30 stars tied with 2,000 -> 3,000.
  const quiet = input({ stars: 30, stars24hAgo: 28, stars7dAgo: 25, commits7d: 1 });
  const loud = input({ stars: 30000, stars24hAgo: 29000, stars7dAgo: 20000, commits7d: 40 });
  const basis = heatBasis([quiet, loud]);

  assert.ok(computeHeat(loud, basis).heatScore > computeHeat(quiet, basis).heatScore);
  // And the loud repo does not flatten the quiet one to zero.
  assert.ok(computeHeat(quiet, basis).breakdown.normalized.star_growth < 100);
});

test("heat: corrections are multiplicative and bounded", () => {
  const penalised = computeHeat(input({ isFork: true, isDuplicate: true, linkDead: true }), heatBasis([input()]));
  const clean = computeHeat(input(), heatBasis([input()]));
  assert.ok(penalised.heatScore < clean.heatScore);
  const factor = penalised.breakdown.corrections.reduce((a, c) => a * c.factor, 1);
  assert.ok(factor < 1);
});

test("heat: with no history the reason never invents growth", () => {
  const r = computeHeat(input({ stars24hAgo: null, stars7dAgo: null, commits7d: 0 }), heatBasis([input()]));
  // It must not claim a growth figure it cannot substantiate.
  assert.doesNotMatch(r.reason, /新增|\+\d/);
  assert.ok(r.reason.length > 0);
});

test("quality grade reflects documentation, and a risk flag subtracts", () => {
  const docs = { hasReadme: true, readmeLength: 3000, hasInstallSection: true, hasInstallCommand: true, hasExamples: true, hasLicense: true, validSkillMdCount: 1 };
  assert.ok(["A", "A-"].includes(qualityGrade(docs, "unknown")));
  assert.ok(qualityGrade(docs, "risk") !== qualityGrade(docs, "unknown"));
});

test("growth status needs real history", () => {
  assert.equal(deriveGrowthStatus(null, 5, 2, "steady"), "steady");
  assert.equal(deriveGrowthStatus(40, 12, 1, "steady"), "surging");
  assert.equal(deriveGrowthStatus(40, 0, 1, "steady"), "steady", "growth without commits is not surging");
  assert.equal(deriveGrowthStatus(40, 12, 200, "steady"), "stale");
  assert.equal(deriveGrowthStatus(-5, 0, 300, "archived"), "archived");
});

test("spike detection catches unnatural jumps", () => {
  assert.equal(isSpike(600, 100), true);
  assert.equal(isSpike(300, 100), false);
  assert.equal(isSpike(100, 0), false);
});

test("clamp bounds", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
});
