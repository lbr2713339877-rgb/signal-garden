import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageShell, Ambient } from "@/components/ui/Chrome";
import { GlassCard } from "@/components/ui/GlassCard";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { HeatNumber } from "@/components/ui/HeatNumber";
import { InstallBlock } from "@/components/ui/InstallBlock";
import { PatternBlock } from "@/components/ui/PatternBlock";
import { Fallback, LANG } from "@/lib/i18n";
import { pickLocalizedCopy } from "@/lib/project-copy";
import { getProjectBySlug, getProjectCopy } from "@/db/queries";
import { canonicalProjectSlug } from "@/lib/slug-alias";
import { redirectIfAlias } from "@/lib/slug-redirect";
import { projectPageMetadata } from "@/lib/page-meta";
import { DIFFICULTY_LABEL, DIFFICULTY_LABEL_EN, DIFFICULTY_STARS, SECURITY_LABEL, SECURITY_LABEL_EN, STATUS_LABEL, STATUS_LABEL_EN, categoryLabel } from "@/lib/categories";
import { T } from "@/lib/dict";
import { formatCount } from "@/lib/utils";
import { ReadmeBadge } from "@/components/v3/ReadmeBadge";
import { projectWasFeatured } from "@/db/queries/featured";
import { ownerRepo } from "@/lib/badge";
import { siteOrigin } from "@/lib/edition";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const current = await canonicalProjectSlug(slug);
  const data = await getProjectBySlug(current);
  if (!data) return projectPageMetadata({ slug: current, name: current });
  const copy = await getProjectCopy(data.project.id);
  const localized = pickLocalizedCopy(copy, data.project.description ?? null);
  return projectPageMetadata({
    slug: current,
    name: data.project.name,
    oneLinerZh: localized.oneLiner.zh,
    oneLinerEn: localized.oneLiner.en,
  });
}

const RISK_LABEL_EN: Record<string, string> = {
  remote_script: 'Runs a remote script',
  unknown_binary: 'Downloads an unknown binary',
  system_privilege: 'Needs system permissions',
  shell_exec: 'Runs shell commands',
  browser_control: 'Controls a browser',
  file_rw: 'Reads and writes local files',
  api_key_read: 'Reads an API key',
  install_script: 'Runs a script during install',
};

function Stars({ level }: { level: number }) {
  return (
    <span className="num text-[length:var(--fs-sm)]" aria-label={`Setup ${level} / 5`}>
      <span className="text-[var(--ink-1)]">{"★".repeat(level)}</span>
      <span className="text-[var(--ink-4)]">{"★".repeat(5 - level)}</span>
    </span>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const data = await getProjectBySlug(slug);
  if (!data) {
    await redirectIfAlias("/p", slug, await searchParams, "/classic");
    notFound();
  }

  const { project: p, skills, content, mentions, history } = data;
  const github = ownerRepo(p.fullName);
  const featured = github ? await projectWasFeatured(p.id) : false;
  const copy = await getProjectCopy(p.id);
  const localized = pickLocalizedCopy(copy, p.description ?? null);
  const hookZh = localized.hook.zh;
  const hookEn = localized.hook.en;
  const oneLinerZh = localized.oneLiner.zh;
  const oneLinerEn = localized.oneLiner.en;
  const riskNoteZh = localized.riskNote.zh;
  const riskNoteEn = localized.riskNote.en;
  const personas = (copy.zh?.personas ?? []) as { persona: string; scenario: string }[];
  const difficulty = p.difficulty ? DIFFICULTY_STARS[p.difficulty] ?? null : null;
  const flags = (p.riskFlags ?? null) as { id: string; label: string; severity: string; source: string; snippet: string }[] | null;
  const installs = (p.installCommands ?? []) as { kind: string; command: string; source: string }[];
  const docSignals = (p.docSignals ?? {}) as Record<string, unknown>;
  const evidence = (p.parseEvidence ?? {}) as Record<string, unknown>;

  return (
    <PageShell ambient={`var(--c-${p.category ?? "skill"})`}>
      <main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] py-[var(--s-9)]">
        {/* --- Hero ------------------------------------------------------- */}
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <CategoryTag category={p.category} />
              {p.supportedAgents.slice(0, 4).map((a) => (
                <span key={a} className="kicker">
                  {a}
                </span>
              ))}
            </div>

            <h1 className="mt-6 text-[length:var(--fs-h1)] leading-[var(--lh-display)] tracking-[var(--ls-display)] text-[var(--ink-1)]">
              {p.name}
            </h1>
            {p.fullName ? (
              <p className="num mt-2 text-[length:var(--fs-sm)] text-[var(--ink-4)]">{p.fullName}</p>
            ) : null}

            {/* The hook leads, because it is the reason someone opened this
                page. The one-line description follows it. */}
            {hookZh || hookEn ? (
              <Fallback
                as="p"
                zh={hookZh}
                en={hookEn}
                className="mt-6 max-w-[54ch] text-[length:var(--fs-h3)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)]"
              />
            ) : null}
            <Fallback
              as="p"
              zh={oneLinerZh}
              en={oneLinerEn}
              className={`max-w-[54ch] text-[length:var(--fs-body)] leading-[var(--lh-body)] text-[var(--ink-2)] ${hookZh || hookEn ? "mt-3" : "mt-6"}`}
            />

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
              {p.stars > 0 ? (
                <span className="num">
                  {formatCount(p.stars)} <span className="text-[var(--ink-4)]">stars</span>
                </span>
              ) : null}
              {p.forks > 0 ? (
                <span className="num">
                  {formatCount(p.forks)} <span className="text-[var(--ink-4)]">forks</span>
                </span>
              ) : null}
              {p.commits7d > 0 ? (
                <span className="num">
                  {p.commits7d} <span className="text-[var(--ink-4)]">commits / 7d</span>
                </span>
              ) : null}
              {p.license ? <span className="num">{p.license}</span> : null}
              {p.status ? <span>{STATUS_LABEL_EN[p.status] ?? p.status}</span> : null}
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={p.primaryUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-[var(--r-sm)] border border-[var(--hairline-strong)] px-4 py-2 text-[length:var(--fs-sm)] text-[var(--ink-1)] transition-colors duration-[var(--d-fast)] hover:bg-[var(--glass-2)]"
              >
                <LANG zh="打开仓库" en="Open repository" />
              </a>
              {p.homepageUrl ? (
                <a
                  href={p.homepageUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-[var(--r-sm)] border border-[var(--hairline)] px-4 py-2 text-[length:var(--fs-sm)] text-[var(--ink-3)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
                >
                  <LANG zh="官网" en="Homepage" />
                </a>
              ) : null}
            </div>
            {featured && github ? (
              <ReadmeBadge owner={github.owner} repo={github.repo} slug={p.slug} origin={siteOrigin()} />
            ) : null}
          </div>

          {/* The four judgements, always separate. Heat is not quality. */}
          <GlassCard className="relative overflow-hidden p-6">
            <Ambient color={`var(--c-${p.category ?? "skill"})`} size={420} className="-right-24 -top-24" opacity={0.14} />
            <p className="kicker">HEAT SCORE</p>
            <p className="num mt-3 text-[length:var(--fs-h1)] leading-none text-[var(--ink-1)]">
              <HeatNumber value={Math.round(p.heatScoreLatest)} />
              <span className="text-[length:var(--fs-h3)] text-[var(--ink-4)]"> / 100</span>
            </p>
            <p className="mt-3 text-[length:var(--fs-xs)] text-[var(--ink-4)]">
              <LANG zh={p.heatComputedAt ? "按最近一次计算" : "暂无计算记录"} en={p.heatComputedAt ? "Calculated from the latest run" : "No calculation recorded"} />
            </p>

            <dl className="relative mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
              {[
                { k: "quality", label: <LANG zh="质量" en="Quality" />, v: p.qualityGrade ?? gradeFromDocs(docSignals) },
                { k: "maintenance", label: <LANG zh="维护" en="Maintenance" />, v: <LANG zh={STATUS_LABEL[p.status] ?? "—"} en={STATUS_LABEL_EN[p.status] ?? "—"} /> },
                { k: "security", label: <LANG zh="安全" en="Security" />, v: <LANG zh={SECURITY_LABEL[p.securityLevel] ?? "—"} en={SECURITY_LABEL_EN[p.securityLevel] ?? "—"} /> },
                { k: "difficulty", label: <LANG zh="难度" en="Setup" />, v: <LANG zh={p.difficulty ? DIFFICULTY_LABEL[p.difficulty] : "未识别"} en={p.difficulty ? DIFFICULTY_LABEL_EN[p.difficulty] : "Not recognised"} /> },
              ].map((m) => (
                <div key={m.k}>
                  <dt className="kicker">{m.k}</dt>
                  <dd className="mt-1 text-[length:var(--fs-sm)] text-[var(--ink-1)]">{m.v}</dd>
                </div>
              ))}
            </dl>

            {p.focusThemes.length ? (
              <div className="relative mt-8 border-t border-[var(--hairline)] pt-4">
                <p className="kicker"><LANG zh="焦点" en="Focus" /></p>
                <p className="mt-2 text-[length:var(--fs-sm)] text-[var(--ink-2)]">
                  {p.focusThemes.join(" · ")} <span className="num text-[var(--ink-4)]">({p.focusScore})</span>
                </p>
              </div>
            ) : null}
          </GlassCard>
        </div>

        {/* --- What it does / Skills -------------------------------------- */}
        {skills.length ? (
          <section className="mt-[var(--s-11)]">
            <p className="kicker">WHAT IT DOES</p>
            <h2 className="mt-3 text-[length:var(--fs-h2)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
              <LANG zh={`它提供 ${skills.length} 个能力`} en={`It gives you ${skills.length} capabilities`} />
            </h2>
            <div className="mt-8 grid gap-3 md:grid-cols-2">
              {skills.map((s) => (
                <GlassCard key={s.id} as="article" lift className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[var(--ink-1)]">{s.name}</h3>
                    {s.isVerifiedSkill ? <span className="kicker"><LANG zh="已验证" en="Verified" /></span> : null}
                  </div>
                  {s.description ? (
                    <p className="mt-2 text-[length:var(--fs-sm)] text-[var(--ink-3)]">{s.description}</p>
                  ) : null}
                  {s.sourcePath ? (
                    <p className="num mt-3 truncate text-[length:var(--fs-xs)] text-[var(--ink-4)]">{s.sourcePath}</p>
                  ) : null}
                </GlassCard>
              ))}
            </div>
          </section>
        ) : null}

        {/* --- Pattern (V2 §6): the page's second visual focus ------------- */}
        <PatternBlock personas={personas} />

        {/* --- Install ---------------------------------------------------- */}
        <section className="mt-[var(--s-10)]">
          <p className="kicker">
            <LANG zh="怎么装" en="INSTALL" />
          </p>
          <h2 className="mt-3 text-[length:var(--fs-h2)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
            怎么装
          </h2>
          {installs.length ? (
            <div className="mt-6 space-y-4">
              <InstallBlock commands={installs} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { k: "difficulty", label: <LANG zh="难度" en="Setup" />, v: difficulty !== null ? <Stars level={difficulty} /> : <LANG zh="未识别" en="Not recognised" /> },
                  { k: "apikey", label: <LANG zh="需要 API Key" en="Needs an API key" />, v: <LANG zh={p.requiresApiKey ? "是" : "未在文档中发现"} en={p.requiresApiKey ? "Yes" : "Not found in the docs"} /> },
                  { k: "local", label: <LANG zh="需要本地环境" en="Needs a local runtime" />, v: <LANG zh={p.requiresLocalRuntime ? "是" : "否"} en={p.requiresLocalRuntime ? "Yes" : "No"} /> },
                  { k: "docker", label: <LANG zh="需要 Docker" en="Needs Docker" />, v: <LANG zh={p.requiresDocker ? "是" : "否"} en={p.requiresDocker ? "Yes" : "No"} /> },
                ].map((m) => (
                  <GlassCard key={m.k} className="p-4">
                    <p className="kicker">{m.k}</p>
                    <p className="mt-2 text-[length:var(--fs-sm)] text-[var(--ink-1)]">{m.v}</p>
                  </GlassCard>
                ))}
              </div>
            </div>
          ) : (
            <GlassCard className="mt-6 p-6">
              <p className="text-[length:var(--fs-sm)] text-[var(--ink-3)]">
                文档里没有找到可识别的安装命令。这类项目按发布规则不会进入榜单，只能在这里查看。
              </p>
            </GlassCard>
          )}
        </section>

        {/* --- Risk ------------------------------------------------------- */}
        <section className="mt-[var(--s-10)]">
          <p className="kicker">RISK &amp; LIMITS</p>
          <h2 className="mt-3 text-[length:var(--fs-h2)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
            风险与限制
          </h2>
          <p className="mt-3 max-w-[62ch] text-[length:var(--fs-sm)] text-[var(--ink-3)]">
            这里只做静态扫描：读 README、SKILL.md 和依赖清单，不执行代码。
            没有命中不代表安全，只能说明文档里没写。
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <RiskBadge level={p.securityLevel} />
            {riskNoteZh || riskNoteEn ? (
              <LANG zh={riskNoteZh ?? ""} en={riskNoteEn ?? ""} as="p" className="text-[length:var(--fs-sm)] text-[var(--ink-2)]" />
            ) : null}
          </div>

          {flags === null ? (
            <GlassCard className="mt-6 p-6">
              <p className="text-[length:var(--fs-sm)] text-[var(--ink-3)]"><LANG zh="尚未扫描。" en="Not scanned yet." /></p>
            </GlassCard>
          ) : flags.length === 0 ? (
            <GlassCard className="mt-6 p-6">
              <p className="text-[length:var(--fs-sm)] text-[var(--ink-3)]">
                在扫描的文档中没有匹配到已知风险模式。这不等于安全。
              </p>
            </GlassCard>
          ) : (
            <ul className="mt-6 space-y-3">
              {flags.map((f, i) => (
                <GlassCard key={`${f.id}-${i}`} as="li" className="p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: f.severity === "high" ? "var(--risk-high)" : "var(--risk-review)" }}
                      aria-hidden
                    />
                    <span className="text-[var(--ink-1)]"><LANG zh={f.label} en={RISK_LABEL_EN[f.id] ?? f.label} /></span>
                    <span className="num text-[length:var(--fs-xs)] text-[var(--ink-4)]">{f.source}</span>
                  </div>
                  <pre className="num mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--bg-void)] p-3 text-[length:var(--fs-xs)] text-[var(--ink-3)]">
                    {f.snippet}
                  </pre>
                </GlassCard>
              ))}
            </ul>
          )}

          {Array.isArray(docSignals.dependencies) && (docSignals.dependencies as string[]).length ? (
            <p className="mt-6 text-[length:var(--fs-xs)] text-[var(--ink-4)]">
              <LANG zh="依赖：" en="Dependencies:" />{(docSignals.dependencies as string[]).slice(0, 12).join(", ")}
            </p>
          ) : null}
        </section>

        {/* --- Why now / history ------------------------------------------ */}
        {history.length > 1 ? (
          <section className="mt-[var(--s-10)]">
            <p className="kicker">WHY NOW</p>
            <h2 className="mt-3 text-[length:var(--fs-h2)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
              <LANG zh="增长轨迹" en="Growth path" />
            </h2>
            <p className="mt-3 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
              <LANG zh={`基于 ${history.length} 个每日快照，从 ${history[0].stars} stars 到现在 ${history[history.length - 1].stars} stars。`} en={`Based on ${history.length} daily snapshots, from ${history[0].stars} stars to ${history[history.length - 1].stars} stars now.`} />
            </p>
            <Sparkline points={history.map((h) => h.stars)} />
          </section>
        ) : null}

        {/* --- Provenance ------------------------------------------------- */}
        <section className="mt-[var(--s-10)]">
          <p className="kicker">PROVENANCE</p>
          <details className="mt-4">
            <summary className="cursor-pointer text-[length:var(--fs-sm)] text-[var(--ink-3)] hover:text-[var(--ink-1)]">
              <LANG zh="这些结论的依据是什么" en="Where these conclusions come from" />
            </summary>
            <GlassCard className="mt-4 p-5">
              <dl className="space-y-3 text-[length:var(--fs-xs)]">
                {[
                  { k: "source", label: <LANG zh="来源 URL" en="Source URL" />, v: p.sourceUrl ?? p.primaryUrl },
                  { k: "hash", label: <LANG zh="raw_data_hash" en="raw_data_hash" />, v: p.rawDataHash?.slice(0, 24) ?? "—" },
                  { k: "parsed", label: <LANG zh="parsed_at" en="parsed_at" />, v: p.parsedAt ? new Date(p.parsedAt).toISOString() : "—" },
                  { k: "verified", label: <LANG zh="last_verified_at" en="last_verified_at" />, v: p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toISOString() : "—" },
                  { k: "queries", label: <LANG zh="发现查询" en="Discovery queries" />, v: (p.discoveryQueries ?? []).join(", ") || "—" },
                  { k: "category", label: <LANG zh="分类来源" en="Category source" />, v: p.categorySource ?? "—" },
                ].map((r) => (
                  <div key={r.k} className="flex flex-wrap gap-x-4">
                    <dt className="num w-40 shrink-0 text-[var(--ink-4)]">{r.k}</dt>
                    <dd className="min-w-0 flex-1 break-all text-[var(--ink-3)]">{r.v}</dd>
                  </div>
                ))}
              </dl>
              <details className="mt-4">
                <summary className="cursor-pointer text-[var(--fs-xs)] text-[var(--ink-4)]"><LANG zh="完整解析证据 JSON" en="Full parse evidence JSON" /></summary>
                <pre className="num mt-3 max-h-80 overflow-auto rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--bg-void)] p-3 text-[length:var(--fs-micro)] text-[var(--ink-3)]">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              </details>
            </GlassCard>
          </details>

          <p className="mt-8 text-[length:var(--fs-xs)] text-[var(--ink-4)]">
            <LANG zh="分类" en="Category" />: {categoryLabel(p.category)}
            {mentions.length ? <LANG zh={` · 外部讨论 ${mentions.length} 条`} en={` · ${mentions.length} external mentions`} /> : null}
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-6 text-[length:var(--fs-sm)]">
          <Link href="/today" className="text-[var(--ink-3)] hover:text-[var(--ink-1)]">
            <LANG zh="返回今日榜单" en="Back to today" />
          </Link>
          <Link href={`/feedback/${p.slug}`} className="text-[var(--ink-3)] hover:text-[var(--ink-1)]">
            <LANG zh="反馈问题" en="Report a problem" />
          </Link>
        </div>
      </main>
    </PageShell>
  );
}

/** Documentation-driven grade. Not a quality judgement beyond what is written. */
function gradeFromDocs(d: Record<string, unknown>): string {
  let score = 0;
  if (d.hasReadme) score += 1;
  if (d.hasInstallCommand) score += 1;
  if (d.hasExamples) score += 1;
  if (d.hasLicense) score += 1;
  if ((d.validSkillMdCount as number) > 0) score += 1;
  return ["D", "C", "C+", "B", "B+", "A"][Math.min(score, 5)];
}

/** Hand-drawn sparkline — no chart library, no axes, just the shape. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 640;
  const h = 80;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const step = w / (points.length - 1);
  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-6 h-20 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--c-skill)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
