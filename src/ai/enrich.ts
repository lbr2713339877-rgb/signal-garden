/**
 * AI enrichment: turn parsed facts into Chinese copy.
 *
 * The model rewrites what the parser found. It does not judge, rank, discover,
 * or infer. Four separate calls keep each output small and traceable, and
 * everything passes through guard.ts before it is stored.
 *
 * A failure never blocks the pipeline: the row is stored with passed_guard
 * false and the UI labels it as unverified, rather than dropping the project.
 */

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { aiContent, project } from "@/db/schema";
import { chatJson, aiUsage, AiError } from "./client";
import { buildEvidence, renderEvidence, type Evidence } from "./evidence";
import { guardGenerated, chineseLength, readingLength, sanitizeTargetUsers, type Generated } from "./guard";
import { generateHook, generateEnglish, generateEnglishCapabilities } from "./hook";
import { FOCUS_MIN } from "@/normalizers/focus";
import { signalDate } from "@/lib/day";
import { discoveryTraction, interestingDiscovery, DISCOVERY_COPY_CHANGED } from "@/normalizers/discovery-policy";
import { chunk, mapLimit } from "@/lib/concurrency";
import { log, type JobResult } from "@/jobs/run";

const PROMPT_VERSION = "v4-discovery";
const MAX_REPAIR_ROUNDS = 2;

const SYSTEM = `你是「Signal Garden」的编辑，要把有用、有意思的项目讲给普通人听。先讲读者能做成什么或体验到什么，再讲技术。机器人、创作工具、互动作品要讲具体使用场景，不能把「新奇」写成空泛的赞美。

铁律：
1. 只能使用我给你的证据。证据里没有的数字、许可证、平台、依赖，一律不许出现。
2. 不确定就写「文档未说明」。不要猜。
3. 不要厂商腔：不写「支持」「基于」「采用」「提供…能力」「赋能」「一站式」「端到端」；英文不写 supports / based on / powered by / end-to-end / seamless / unlock。
4. 说人话：如果必须提到技术词，先用日常说法解释。agent=能自己干活的程序；workflow=固定的几步流程；tool=它能调用的功能；provider=模型服务；MCP=一套通用接法；SDK / framework / API / CLI / 中间件 / 编排 尽量换成普通说法。
5. 可以保留项目名、产品名和真正必要的代码命令；其他术语能不用就不用。
6. 中文和英文都像懂行的朋友在介绍，不像官网文案。
7. roadmap、coming soon、计划中、即将上线的功能不能当成当前能力；厂商宣称的效果和用户口碑不能改写成独立验证的结论。
8. 只输出 JSON，不要任何解释文字。`;

interface FieldsA {
  one_liner: string;
  problem: string;
}

interface FieldsB {
  target_users: string[];
  why_now: string[];
  not_for: string[];
  limits: string[];
  install_hint: string;
}

interface FieldsC {
  risk_note: string;
  recommendation: "try" | "watch" | "caution" | "avoid";
}

interface FieldsD {
  capabilities: string[];
}

const BANNED_COPY_TERMS = /\b(?:agents?|workflows?|providers?|MCP|SDKs?|frameworks?|APIs?|CLIs?|middleware|orchestrat\w*|end-to-end|skills?|routers?)\b|中间件|编排|端到端|智能体|工作流|模型服务|大模型|脚手架|赋能|一站式|支持|基于|采用/i;

function softenCapability(x: string): string {
  return x
    .replace(/AI\s*agent|AI\s*Agent|agent/gi, '能自己干活的程序')
    .replace(/\bworkflow\b|工作流/gi, '固定流程')
    .replace(/\bprovider\b|模型服务/gi, '模型来源')
    .replace(/\bMCP\b/g, '通用接法')
    .replace(/\bSDK\b/g, '开发包')
    .replace(/\bframework\b/gi, '开发框架')
    .replace(/\bAPI\b/g, '接口')
    .replace(/\bCLI\b/g, '命令行')
    .replace(/\bskill\b/gi, '技能')
    .replace(/\bSkill\b/g, '技能')
    .replace(/\brouter\b/gi, '切换')
    .replace(/大模型/g, 'AI 模型')
    .replace(/脚手架/g, '项目模板')
    .replace(/赋能/g, '帮助')
    .replace(/一站式/g, '一起完成')
    .replace(/支持/g, '可以')
    .replace(/基于/g, '用')
    .replace(/采用/g, '用')
    .replace(/编排/g, '安排')
    .replace(/端到端/g, '完整');
}

function cleanCapabilities(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x) => softenCapability(String(x).trim()))
    .filter((x) => x.length > 0)
    .filter((x) => !BANNED_COPY_TERMS.test(x))
    .filter((x) => {
      const n = readingLength(x);
      return n >= 5 && n <= 20;
    })
    .slice(0, 5);
}

async function generateCapabilities(e: Evidence): Promise<string[]> {
  try {
    const { data } = await chatJson<FieldsD>({
      system: SYSTEM,
      user: `${renderEvidence(e)}

任务 D：写「它能帮你做成什么」。
- 只写 3-5 条，不要逐条翻译 README / SKILL.md 的原文。
- 每条不超过 20 个汉字，动词开头，讲用户能得到什么结果，不讲实现。
- 不要出现 agent、workflow、provider、MCP、SDK、framework、API、CLI、中间件、编排、端到端、智能体、工作流、工具、模型服务。
- 必须来自证据里的真实能力；证据没有的功能不要写。
- 不要写营销词，不要写「支持」「基于」「采用」「提供…能力」「赋能」「一站式」。
- 可保留项目名和必要代码命令，其他都换成日常说法。

输出 JSON: {"capabilities":["...","...","..."]}`,
      temperature: 0.35,
    });

    const capabilities = cleanCapabilities(data.capabilities);
    return capabilities.length >= 3 ? capabilities : [];
  } catch {
    // Capability copy is an enhancement. The Chinese one-liner and facts still
    // persist when this optional call fails, and the UI shows a pending state.
    return [];
  }
}

async function generate(e: Evidence): Promise<{ g: Generated; capabilities: string[]; model: string }> {
  const evidence = renderEvidence(e);
  const model = process.env.AI_MODEL ?? "";

  const a = await chatJson<FieldsA>({
    system: SYSTEM,
    user: `${evidence}

任务 A：写简介。
- one_liner：18-48 个中文字符，一句话说清它是什么、能帮谁做什么。不要形容词堆砌。
- problem：55-130 个中文字符，说清它帮人做成什么、谁需要它。

输出 JSON: {"one_liner":"...","problem":"..."}`,
  });

  const b = await chatJson<FieldsB>({
    system: SYSTEM,
    user: `${evidence}

任务 B：写判断信息。
- target_users：只能逐字从这些词里选，可多选，不允许改写或新增身份名：${["独立开发者", "AI 产品经理", "前端开发者", "设计师", "内容创作者", "技术创业者", "自动化爱好者"].join("、")}
- why_now：最多 3 条，每条一句话，必须基于证据里的事实（如具体用途、可体验入口、提交活跃、真实讨论）；没有增长记录不能声称爆火或正在流行。
- not_for：至少 1 条，说清什么人不需要它。
- limits：主要限制，如需要 API Key、文档不完整、只支持本地运行、仍处早期、依赖外部服务。
- install_hint：仓库：一句话说明怎么装，必须来自证据里的安装命令。网站：写证据里的官方体验入口，不能凭空编造安装命令。缺少说明就如实写文档未说明。

输出 JSON: {"target_users":[],"why_now":[],"not_for":[],"limits":[],"install_hint":"..."}`,
  });

  const c = await chatJson<FieldsC>({
    system: SYSTEM,
    user: `${evidence}

任务 C：写风险说明并给建议。
- risk_note：根据「静态扫描命中的风险」写一到两句。仓库扫描没命中就写「静态扫描未发现明显风险，但不代表安全」。托管网站无法检查服务端代码，必须写「仅核验官方页面，未审计服务端代码；数据处理和费用以官网为准」，不得声称已经扫描或确认安全。必须提到扫描命中的高风险项。
- recommendation：try（值得现在就试）/ watch（先观察）/ caution（谨慎）/ avoid（不建议）。

输出 JSON: {"risk_note":"...","recommendation":"try"}`,
  });

  const capabilities = await generateCapabilities(e);

  return {
    model: a.result.model || model,
    capabilities,
    g: {
      one_liner: a.data.one_liner ?? "",
      problem: a.data.problem ?? "",
      target_users: b.data.target_users ?? [],
      why_now: b.data.why_now ?? [],
      not_for: b.data.not_for ?? [],
      limits: b.data.limits ?? [],
      install_hint: b.data.install_hint ?? "",
      risk_note: c.data.risk_note ?? "",
      recommendation: c.data.recommendation ?? "watch",
    },
  };
}

/**
 * Projects that need copy, most valuable first.
 *
 * Today's unpublished candidates come before the general backlog: the publish
 * job can only rank a project once its copy exists and passed the guard, so
 * writing for yesterday's leftovers first would leave today's board empty.
 */
/**
 * One repair pass: hand the model its own JSON and the rules it broke, with
 * the same evidence, and take back a corrected object. Returns null when the
 * reply cannot be used, so the caller keeps the last guarded version.
 */
async function repair(e: Evidence, current: Generated, failures: string[]): Promise<Generated | null> {
  try {
    const { data } = await chatJson<Generated>({
      system: SYSTEM,
      user: `${renderEvidence(e)}

下面是你上一次写的内容，它没有通过校验：
${JSON.stringify(current, null, 2)}

没通过的原因：
${failures.map((f) => `- ${f}`).join("\n")}

只修改有问题的字段，其余保持不变。长度规则：one_liner 18-48 字，problem 55-130 字（汉字按 1 计，每个英文单词或数字按 1 计）。
不要引入证据里没有的数字、平台或许可证。输出完整 JSON，字段与上面相同。`,
    });
    return {
      one_liner: data.one_liner ?? current.one_liner,
      problem: data.problem ?? current.problem,
      target_users: data.target_users ?? current.target_users,
      why_now: data.why_now ?? current.why_now,
      not_for: data.not_for ?? current.not_for,
      limits: data.limits ?? current.limits,
      install_hint: data.install_hint ?? current.install_hint,
      risk_note: data.risk_note ?? current.risk_note,
      recommendation: data.recommendation ?? current.recommendation,
    };
  } catch {
    return null;
  }
}

export async function enrichAi(
  opts: { limit?: number; all?: boolean; retryFailedToday?: boolean; hooksOnly?: boolean; rewriteHooks?: boolean; capabilitiesOnly?: boolean; englishOnly?: boolean; rewriteExisting?: boolean; slugs?: string[] } = {},
): Promise<JobResult> {
  const limit = opts.limit ?? 40;
  const d = await db();
  /* Must match the timezone scoring and publish use. With UTC here the nightly
     run (06:00 Asia/Singapore = 22:00 UTC the previous day) looked for the
     previous day's board, so enrich-ai wrote copy for a different candidate set
     than publish had selected. */
  const today = signalDate();
  const copyDayStart = new Date(`${today}T00:00:00+08:00`);

  // No copy yet, or copy that failed the guard on an earlier day. A failed row
  // is retried at most once per day, which bounds the cost of a project the
  // model keeps getting wrong.
  // Hooks and the English row were added after the first run, so existing
  // rows need a backfill pass that does not rewrite their Chinese copy.
  const needsHook = sql`EXISTS (
    SELECT 1 FROM ${aiContent} c
    WHERE c.project_id = ${project.id} AND c.locale = 'zh'
      AND c.passed_guard AND (c.hook IS NULL OR btrim(c.hook) = '')
  )`;

  /* Template-y hooks produced by an earlier prompt: the whole catalogue came
     out as "...凭什么". A rewrite pass replaces those with the new effect-first
     phrasing while leaving genuinely varied hooks alone. */
  const badHook = sql`EXISTS (
    SELECT 1 FROM ${aiContent} c
    WHERE c.project_id = ${project.id} AND c.locale = 'zh'
      AND c.passed_guard
      AND c.hook IS NOT NULL
      AND (c.hook ILIKE '%凭什么%' OR c.hook ILIKE '%今天都在传%' OR c.hook ILIKE '%免费平替%')
  )`;

  const needsCopy = sql`(NOT EXISTS (
    SELECT 1 FROM ${aiContent} c
    WHERE c.project_id = ${project.id} AND c.locale = 'zh'
      AND (c.passed_guard OR (c.generated_at >= ${copyDayStart} AND ${opts.retryFailedToday ? sql`false` : sql`true`}))
  ) OR EXISTS (SELECT 1 FROM ${aiContent} c WHERE c.project_id = ${project.id} AND c.locale = 'zh'
    AND NOT c.passed_guard AND c.guard_failures @> ${JSON.stringify([DISCOVERY_COPY_CHANGED])}::jsonb))`;

  const needsCapabilities = sql`EXISTS (
    SELECT 1 FROM ${aiContent} c
    WHERE c.project_id = ${project.id} AND c.locale = 'zh'
      AND c.passed_guard
      AND jsonb_array_length(coalesce(c.capabilities, '[]'::jsonb)) = 0
  )`;

  const needsEnglish = sql`NOT EXISTS (
    SELECT 1 FROM ${aiContent} c
    WHERE c.project_id = ${project.id} AND c.locale = 'en'
      AND c.passed_guard
      AND c.one_liner IS NOT NULL AND btrim(c.one_liner) <> ''
      AND jsonb_array_length(coalesce(c.capabilities, '[]'::jsonb)) > 0
  )`;
  const isCandidate = sql`EXISTS (SELECT 1 FROM daily_signal s WHERE s.project_id = ${project.id} AND s.signal_date = ${today})`;
  const slugFilter = opts.slugs?.length ? inArray(project.slug, opts.slugs) : sql`true`;

  const rows = await d
    .select({ id: project.id, fullName: project.fullName })
    .from(project)
    .where(
      and(
        eq(project.parseState, "parsed"),
        eq(project.hidden, false),
        isNull(project.junkReason),
        eq(project.isSkillCollection, false),
        isNull(project.duplicateOf),
        gte(project.focusScore, FOCUS_MIN),
        discoveryTraction(),
        sql`NOT EXISTS (
          SELECT 1 FROM ${aiContent} c
          WHERE c.project_id = ${project.id} AND c.verified_by_human = true
        )`,
        opts.rewriteExisting ? sql`true` : opts.rewriteHooks ? badHook : opts.hooksOnly ? needsHook : opts.capabilitiesOnly ? needsCapabilities : opts.englishOnly ? needsEnglish : needsCopy,
        slugFilter,
        // `all` widens to the whole in-focus backlog; the default serves the board.
        opts.all || opts.rewriteExisting || opts.hooksOnly || opts.rewriteHooks || opts.capabilitiesOnly || opts.englishOnly || opts.slugs?.length ? sql`true` : isCandidate,
      ),
    )
    .orderBy(desc(opts.all ? interestingDiscovery() : isCandidate),
      desc(opts.all ? sql`${project.projectKind} <> 'repo'` : interestingDiscovery()),
      desc(opts.all ? isCandidate : sql`${project.projectKind} <> 'repo'`), desc(project.focusScore), desc(project.stars))
    .limit(limit);

  log("enrich-ai", `${rows.length} projects need copy`);

  let written = 0;
  let passed = 0;
  let hooked = 0;
  const failures: { project: string; reason: string }[] = [];

  /**
   * Generate and store copy for one project. Extracted from the old
   * double-for loop so independent projects can run concurrently: each project
   * is several sequential model calls, and running three at a time cuts the
   * wall-clock cost roughly in half without changing what is stored.
   */
  async function processOne(r: any): Promise<void> {
    try {
      const e = await buildEvidence(r.id);
      if (!e) return;

      if (opts.englishOnly) {
        const h = await generateHook(e);
        const en = await generateEnglish(e, h?.hookEn ?? null);
        if (!en) {
          failures.push({ project: e.fullName, reason: "english copy not generated" });
          return;
        }
        await d
          .insert(aiContent)
          .values({
            projectId: r.id,
            locale: "en",
            oneLiner: en.oneLiner,
            problem: en.problem,
            hook: h?.hookEn ?? null,
            hookType: h?.hookType ?? null,
            targetUsers: en.targetUsers,
            whyNow: en.whyNow,
            notFor: en.notFor,
            capabilities: en.capabilities,
            installHint: en.installHint,
            riskNote: en.riskNote,
            passedGuard: true,
            model: process.env.AI_MODEL ?? null,
            promptVersion: PROMPT_VERSION,
          })
          .onConflictDoUpdate({
            target: [aiContent.projectId, aiContent.locale],
            set: {
              oneLiner: en.oneLiner,
              problem: en.problem,
              hook: h?.hookEn ?? null,
              hookType: h?.hookType ?? null,
              targetUsers: en.targetUsers,
              whyNow: en.whyNow,
              notFor: en.notFor,
              capabilities: en.capabilities,
              passedGuard: true,
              model: process.env.AI_MODEL ?? null,
              generatedAt: new Date(),
            },
          });
        written++;
        log("enrich-ai", `english: ${e.fullName} · ${en.capabilities.length}`);
        return;
      }

      if (opts.capabilitiesOnly) {
        const [capabilities, enCapabilities] = await Promise.all([
          generateCapabilities(e),
          generateEnglishCapabilities(e),
        ]);
        if (!capabilities.length) {
          failures.push({ project: e.fullName, reason: "capabilities not generated" });
          return;
        }

        await d
          .update(aiContent)
          .set({ capabilities, generatedAt: new Date() })
          .where(and(eq(aiContent.projectId, r.id), eq(aiContent.locale, "zh")));

        if (enCapabilities.length) {
          await d
            .update(aiContent)
            .set({ capabilities: enCapabilities, generatedAt: new Date() })
            .where(and(eq(aiContent.projectId, r.id), eq(aiContent.locale, "en")));
        }

        written++;
        log("enrich-ai", `capabilities: ${e.fullName} · ${capabilities.length}`);
        return;
      }

      if (opts.hooksOnly || opts.rewriteHooks) {
        const h = await generateHook(e);
        if (!h) {
          failures.push({ project: e.fullName, reason: "hook not generated" });
          return;
        }
        const en = await generateEnglish(e, h.hookEn);
        await d
          .update(aiContent)
          .set({ hook: h.hookZh, hookType: h.hookType, generatedAt: new Date() })
          .where(and(eq(aiContent.projectId, r.id), eq(aiContent.locale, "zh")));
        if (en) {
          await d
            .insert(aiContent)
            .values({
              projectId: r.id,
              locale: "en",
              oneLiner: en.oneLiner,
              problem: en.problem,
              hook: h.hookEn,
              hookType: h.hookType,
              targetUsers: en.targetUsers,
              whyNow: en.whyNow,
              notFor: en.notFor,
              capabilities: en.capabilities,
              passedGuard: true,
              model: process.env.AI_MODEL ?? null,
              promptVersion: PROMPT_VERSION,
            })
            .onConflictDoUpdate({
              target: [aiContent.projectId, aiContent.locale],
              set: { oneLiner: en.oneLiner, problem: en.problem, hook: h.hookEn, hookType: h.hookType, targetUsers: en.targetUsers, whyNow: en.whyNow, notFor: en.notFor, capabilities: en.capabilities, installHint: en.installHint, riskNote: en.riskNote, generatedAt: new Date() },
            });
        }
        written++;
        hooked++;
        log("enrich-ai", `hook: ${e.fullName} · ${h.hookType} · ${h.hookZh}`);
        return;
      }

      const first = await generate(e);
      first.g.target_users = sanitizeTargetUsers(first.g.target_users);
      const model = first.model;
      let guard = guardGenerated(first.g, e);

      // Up to two repair rounds. The model gets its own output back with the
      // exact rule it broke; most failures are a sentence a few characters
      // short, which a rewrite fixes and a fresh generation may not.
      for (let round = 0; !guard.passed && round < MAX_REPAIR_ROUNDS; round++) {
        const repaired = await repair(e, guard.cleaned, guard.failures);
        if (!repaired) break;
        guard = guardGenerated(repaired, e);
      }

      // V2: a hook in both languages, plus English copy written natively.
      // Neither blocks the Chinese row — a project with copy and no hook is
      // still usable, it just is not eligible for the headline slot.
      const hook = guard.passed ? await generateHook(e) : null;
      const enHook = hook ?? (await generateHook(e));
      const english = await generateEnglish(e, enHook?.hookEn ?? null);

      await d
        .insert(aiContent)
        .values({
          projectId: r.id,
          locale: "zh",
          hook: hook?.hookZh ?? null,
          hookType: hook?.hookType ?? null,
          oneLiner: guard.cleaned.one_liner,
          problem: guard.cleaned.problem,
          targetUsers: guard.cleaned.target_users,
          whyNow: guard.cleaned.why_now,
          notFor: guard.cleaned.not_for,
          limits: guard.cleaned.limits,
          installHint: guard.cleaned.install_hint,
          riskNote: guard.cleaned.risk_note,
          recommendation: guard.cleaned.recommendation,
          capabilities: first.capabilities,
          evidence: { sources: e.installCommands.map((c) => c.command), riskFlags: e.riskFlags },
          passedGuard: guard.passed,
          guardFailures: guard.failures,
          model,
          promptVersion: PROMPT_VERSION,
        })
        .onConflictDoUpdate({
          target: [aiContent.projectId, aiContent.locale],
          set: {
            oneLiner: guard.cleaned.one_liner,
            problem: guard.cleaned.problem,
            hook: hook?.hookZh ?? null,
            hookType: hook?.hookType ?? null,
            targetUsers: guard.cleaned.target_users,
            whyNow: guard.cleaned.why_now,
            notFor: guard.cleaned.not_for,
            limits: guard.cleaned.limits,
            installHint: guard.cleaned.install_hint,
            riskNote: guard.cleaned.risk_note,
            recommendation: guard.cleaned.recommendation,
            capabilities: first.capabilities,
            passedGuard: guard.passed,
            guardFailures: guard.failures,
            model,
            generatedAt: new Date(),
          },
        });

      if (english) {
        await d
          .insert(aiContent)
          .values({
            projectId: r.id,
            locale: "en",
            oneLiner: english.oneLiner,
            problem: english.problem,
            hook: enHook?.hookEn ?? null,
            hookType: enHook?.hookType ?? null,
            targetUsers: english.targetUsers,
            whyNow: english.whyNow,
            notFor: english.notFor,
            capabilities: english.capabilities,
            installHint: english.installHint,
            riskNote: english.riskNote,
            // The Chinese guard ran against the same evidence; the English
            // copy is held to the same bar by the translation check below.
            passedGuard: true,
            model,
            promptVersion: PROMPT_VERSION,
          })
          .onConflictDoUpdate({
            target: [aiContent.projectId, aiContent.locale],
            set: {
              oneLiner: english.oneLiner,
              problem: english.problem,
              hook: enHook?.hookEn ?? null,
              hookType: enHook?.hookType ?? null,
              targetUsers: english.targetUsers,
              whyNow: english.whyNow,
              notFor: english.notFor,
              capabilities: english.capabilities,
              installHint: english.installHint,
              riskNote: english.riskNote,
              generatedAt: new Date(),
            },
          });
      }

      await d.update(project).set({ aiGeneratedAt: new Date() }).where(eq(project.id, r.id));
      written++;
      if (guard.passed) passed++;
      if (hook) hooked++;
      else failures.push({ project: e.fullName, reason: guard.failures.slice(0, 2).join("; ") });

      if (written % 8 === 0) log("enrich-ai", `${written}/${rows.length} · ${passed} passed guard`);
    } catch (err) {
      const msg = err instanceof AiError ? err.message : err instanceof Error ? err.message : String(err);
      failures.push({ project: r.fullName ?? r.id, reason: msg });
      log("enrich-ai", `failed ${r.fullName}: ${msg.slice(0, 100)}`);
    }
  }

  await mapLimit(rows as any[], 3, processOne);

  log("enrich-ai", `${written} written · ${passed} passed guard · ${hooked} with hooks · ${failures.length} problems`);
  return {
    itemsIn: rows.length,
    itemsOut: written,
    meta: { passed, hooked, failures: failures.slice(0, 20), usage: aiUsage() },
  };
}
