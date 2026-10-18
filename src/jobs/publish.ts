/**
 * Publish (brief section 二十): the gate between "scored" and "shown".
 *
 * Every rule the brief lists is checked here, per project, and the reason for
 * each failure is stored so an operator can see why something did not appear.
 * A project that fails any gate is never published with a recommendation —
 * that is the whole point of separating scoring from publishing.
 *
 * Order matters: enrich-ai runs before this, because a project with no guarded
 * copy cannot pass gate 6.
 */

import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { aiContent, dailySignal, project } from "@/db/schema";
import { discoveryTraction, currentDiscoveryReview, selectEdition } from "@/normalizers/discovery-policy";
import { log, type JobResult } from "./run";
import { signalDate } from "@/lib/day";
import { TODAY_LIMIT } from "@/lib/edition";
import { exposureKeys, notPreviouslyFeatured } from "@/scoring/exposure";

/**
 * Per-category floor for the daily list. The heat ranking remains global, but
 * a hot category cannot occupy every slot on a quiet day for another category.
 * The floor is intentionally small: it guarantees representation without
 * lowering the gate or forcing bad projects through.
 */
const CATEGORY_FLOOR: Record<string, number> = {
  "ai-tools": 2,
  "indie-web": 2,
  "dev-tools": 2,
  design: 2,
  "skill-agent": 2,
  productivity: 2,
};

interface Gate {
  code: string;
  label: string;
  pass: boolean;
  detail?: string;
}

/**
 * A "resource" is a library / component set / design asset collection rather
 * than an AI skill. GSAP, Lenis, Vanta, React Bits and uiverse/galaxy all fit:
 * they are imported or copied into a project, ship no SKILL.md, and expose no
 * single install command for the parser to find. They are exactly what indie
 * builders reach for, so they must not be judged by the SKILL track.
 */
export const RESOURCE_STAR_FLOOR = 150;

function isResource(row: any): boolean {
  const docs = row.docSignals as any;
  const hasReadme = !!docs?.hasReadme || row.hasSkillMd;
  if (row.hasSkillMd || !hasReadme || !row.category) return false;

  /* Evidence of real use — any one is enough. A fixed 200-star bar alone
     excluded small published packages that people actually install. */
  const stars = row.stars ?? 0;
  const publishedPackage = !!docs?.hasPackageManifest;
  const hasRelease = (row.releaseCount ?? 0) > 0;
  const documentedInstall = !!docs?.hasInstallCommand || !!docs?.hasInstallSection;
  return stars >= RESOURCE_STAR_FLOOR || publishedPackage || hasRelease || documentedInstall;
}

export function evaluatePublication(row: any): Gate[] {
  const installs = (row.installCommands ?? []) as any[];
  const flags = row.riskFlags as any[] | null;
  const resource = isResource(row);
  const website = row.projectKind && row.projectKind !== "repo";
  const discovery = website || (row.focusThemes ?? []).includes("play");
  const review = currentDiscoveryReview(row.docSignals, row.readmeHash);

  return [
    {
      code: "discovery_review",
      label: "新奇应用用途与使用证据已审核",
      pass: !discovery || review?.passed === true,
      detail: discovery ? review?.reason ?? "review pending" : "standard resource",
    },
    {
      code: "first_feature",
      label: "仓库或官网未在往期榜单出现",
      pass: row.isNew === true,
    },
    {
      code: "link_accessible",
      label: "官方链接可访问",
      pass: row.linkStatus === "ok",
      detail: row.linkStatus,
    },
    {
      code: "repo_alive",
      label: "仓库没有被删除",
      pass: !row.isArchived || true, // archived is a status, not a deletion
    },
    {
      code: "not_junk",
      label: "不是明显的垃圾仓库",
      pass: !row.junkReason && !row.isSkillCollection,
      detail: row.junkReason ?? (row.isSkillCollection ? "skill collection" : undefined),
    },
    {
      code: "has_docs",
      label: website ? "有官方产品资料" : "有基本 README 或 SKILL.md",
      pass: !!(row.docSignals as any)?.hasReadme || row.hasSkillMd,
    },
    {
      code: "categorised",
      label: "分类已确认",
      pass: !!row.category,
      detail: row.categorySource ?? undefined,
    },
    {
      code: "ai_grounded",
      label: "AI 摘要有来源依据",
      pass: row.aiPassed === true,
      detail: row.aiFailures?.length ? row.aiFailures.slice(0, 2).join("; ") : undefined,
    },
    {
      /* The detail page leads with 3–5 Chinese capability statements. A row can
         pass the guard while its capability array is still empty (the AI call
         budget ran out, or the capabilities step never ran), and publishing it
         shows readers "中文简介生成中" on a project we just shipped. If the
         consumer-facing copy is not there, the project is not ready. */
      code: "has_capabilities",
      label: "中文能力文案已生成",
      pass: Array.isArray(row.capabilities) && row.capabilities.length > 0,
      detail: Array.isArray(row.capabilities) ? `${row.capabilities.length} statements` : "missing",
    },
    {
      /* SKILL track: a recognised install command. Resource track: the project
         is an established library/asset set, fetched by npm/CDN/copy rather
         than installed once, so a command is not a prerequisite. */
      code: "install_known",
      label: resource ? "资源类型可用" : "安装方式被识别",
      /* Resource track accepts documented install instructions as evidence,
         not only a parser-recognised command. */
      pass:
        installs.length > 0 ||
        (resource && (!!(row.docSignals as any)?.hasInstallSection || !!(row.docSignals as any)?.hasInstallCommand)) ||
        resource || (website && review?.passed === true && !!row.docSignals?.hasOfficialPage),
      detail: installs.length ? `${installs.length} commands` : resource ? "resource track" : "none found",
    },
    {
      // The scan always produces a level; "unknown" is a recorded result, not
      // a missing one. What must not happen is skipping the scan entirely.
      code: "risk_scanned",
      label: website ? "托管产品风险状态已记录" : "安全风险已经标记",
      pass: website ? row.securityLevel === "unknown" && !!row.parseEvidence?.website : flags !== null,
      detail: flags === null ? "not scanned" : row.securityLevel,
    },
    {
      code: "license_recorded",
      label: "许可证状态已经记录",
      pass: row.parsedAt !== null, // recorded either as an SPDX id or as absent
      detail: row.license ?? "declared none",
    },
    {
      code: "not_copy",
      label: "没有明显复制他人项目的迹象",
      pass: !row.duplicateOf && !row.forkOf,
      detail: row.duplicateOf ? "duplicate" : row.forkOf ? "fork" : undefined,
    },
  ];
}

export async function publish(opts: { top?: number; date?: string } = {}): Promise<JobResult> {
  const top = opts.top ?? TODAY_LIMIT;
  const d = await db();
  // Explicit date lets an operator re-publish a specific day (e.g. a run that
  // crossed midnight). Defaults to the signal date in the site timezone.
  const today = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : signalDate();

  const rows = (await d
    .select({
      projectId: project.id,
      slug: project.slug,
      fullName: project.fullName,
      projectKind: project.projectKind,
      focusThemes: project.focusThemes,
      readmeHash: project.readmeHash,
      parseEvidence: project.parseEvidence,
      linkStatus: project.linkStatus,
      isArchived: project.isArchived,
      junkReason: project.junkReason,
      isSkillCollection: project.isSkillCollection,
      docSignals: project.docSignals,
      hasSkillMd: project.hasSkillMd,
      category: project.category,
      primaryCategory: project.primaryCategory,
      secondaryCategory: project.secondaryCategory,
      categorySource: project.categorySource,
      installCommands: project.installCommands,
      riskFlags: project.riskFlags,
      securityLevel: project.securityLevel,
      license: project.license,
      parsedAt: project.parsedAt,
      duplicateOf: project.duplicateOf,
      forkOf: project.forkOf,
      stars: project.stars,
      heatScore: dailySignal.heatScore,
      breakdown: dailySignal.breakdown,
      reason: dailySignal.reason,
      aiPassed: aiContent.passedGuard,
      aiFailures: aiContent.guardFailures,
      recommendation: aiContent.recommendation,
      oneLiner: aiContent.oneLiner,
      capabilities: aiContent.capabilities,
      contributors: project.contributors,
      isNew: notPreviouslyFeatured(today),
      exposureKeys: exposureKeys(),
    })
    .from(dailySignal)
    .innerJoin(project, eq(dailySignal.projectId, project.id))
    .leftJoin(aiContent, and(eq(aiContent.projectId, project.id), eq(aiContent.locale, "zh")))
    .where(
      and(
        eq(dailySignal.signalDate, today),
        eq(dailySignal.needsReview, false),
        eq(project.hidden, false),
        isNull(project.duplicateOf),
        discoveryTraction(),
      ),
    )
    .orderBy(desc(dailySignal.heatScore))) as any[];

  log("publish", `${rows.length} candidates from today's scoring`);

  const held: { row: any; gates: Gate[]; failed: Gate[] }[] = [];
  const blocked: { slug: string; failed: string[] }[] = [];
  const eligible: any[] = [];
  for (const row of rows) {
    const gates = evaluatePublication(row);
    const failed = gates.filter(g => !g.pass);
    if (failed.length) {
      held.push({ row, gates, failed });
      blocked.push({ slug: row.slug, failed: failed.map(g => g.detail ? `${g.code}(${g.detail})` : g.code) });
    } else {
      const review = currentDiscoveryReview(row.docSignals, row.readmeHash);
      eligible.push({ ...row, interesting: review?.interesting === true,
        earlySolo: row.projectKind === 'repo' && row.contributors > 0 && row.contributors <= 1 && row.stars < 100 });
    }
  }
  const published = selectEdition(eligible, top);

  // A shorter edition is valid. Never fill it with historical discoveries.
  // Commit the full edition together so readers cannot see a half-written list.
  await d.transaction(async (tx) => {
    await tx.update(dailySignal).set({ isPublished: false }).where(eq(dailySignal.signalDate, today));
    for (const { row, gates, failed } of held) {
      await tx.update(dailySignal).set({
        breakdown: { ...(row.breakdown ?? {}), gates, gateFailures: failed.map((f) => f.code) },
      }).where(and(eq(dailySignal.signalDate, today), eq(dailySignal.projectId, row.projectId)));
    }
    for (const [i, row] of published.entries()) {
      await tx.update(dailySignal).set({
        isPublished: true,
        rank: i + 1,
        breakdown: { ...(row.breakdown ?? {}), gates: evaluatePublication(row), gateFailures: [] },
      }).where(and(eq(dailySignal.signalDate, today), eq(dailySignal.projectId, row.projectId)));
    }
  });

  if (blocked.length) {
    log("publish", `${blocked.length} held back. most common failures:`);
    const tally = new Map<string, number>();
    for (const b of blocked) for (const f of b.failed) tally.set(f.split("(")[0], (tally.get(f.split("(")[0]) ?? 0) + 1);
    for (const [code, n] of [...tally].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      log("publish", `  ${code}: ${n}`);
    }
  }

  log("publish", `published ${published.length} of ${rows.length} candidates`);
  return {
    itemsIn: rows.length,
    itemsOut: published.length,
    meta: { date: today, blocked: blocked.slice(0, 30) },
  };
}
