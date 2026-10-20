/** Project detail: decision summary, capabilities, installation, limitations and provenance. */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { DetailObservations, type Observation } from '@/components/v3/detail/DetailObservations';
import { CapabilityList } from '@/components/v3/detail/CapabilityList';
import { DetailInstall, type InstallCommand } from '@/components/v3/detail/DetailInstall';
import { DetailLimits, type LimitItem } from '@/components/v3/detail/DetailLimits';
import { categoryColor, categoryLabelEn, categoryLabelZh } from '@/components/v3/category-color';
import { getProjectBySlug, getProjectCopy } from '@/db/queries';
import { canonicalProjectSlug } from '@/lib/slug-alias';
import { redirectIfAlias } from '@/lib/slug-redirect';
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_LABEL_EN,
  STATUS_LABEL,
  STATUS_LABEL_EN,
  SECURITY_LABEL,
  SECURITY_LABEL_EN,
} from '@/lib/categories';
import { formatCount } from '@/lib/utils';
import { T, t, bi, both, type DictKey } from '@/lib/dict';
import { Fallback, LANG } from '@/lib/i18n';
import { ProjectActions } from '@/components/v3/ProjectActions';
import { pickLocalizedCopy } from '@/lib/project-copy';
import { projectPageMetadata, projectBodySummary } from '@/lib/page-meta';
import { JsonLd } from '@/components/seo/JsonLd';
import { githubCodeRepository, projectJsonLd } from '@/lib/jsonld';
import { siteOrigin } from '@/lib/edition';
import { NewsletterSignup } from '@/components/v3/NewsletterForm';
import { SubscribeLink } from '@/components/v3/SubscribeLink';
import { snapshotStarGrowth } from '@/lib/star-growth';
import { ReadmeBadge } from '@/components/v3/ReadmeBadge';
import { projectWasFeatured } from '@/db/queries/featured';
import { ownerRepo } from '@/lib/badge';

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

/**
 * 日期格式化不依赖 locale，避免同一页在不同环境下渲染出不同字符串。
 * 例：2026-09-24 → "24 SEP 2026"
 */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function fmtDate(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** ISO 时间戳，用于 provenance。 */
function fmtStamp(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString();
}

export default async function ProjectPageV3({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  await redirectIfAlias("/p", slug, await searchParams);
  const data = await getProjectBySlug(slug);
  if (!data) notFound();

  const { project: p, skills, content, mentions, history } = data;
  const isWebsite = p.projectKind !== "repo";
  const copy = await getProjectCopy(p.id);

  const categoryKey = p.primaryCategory ?? p.category ?? 'dev-tools';
  const accent = categoryColor(categoryKey);

  const localized = pickLocalizedCopy(copy, p.description ?? null);
  const oneLinerZh = localized.oneLiner.zh;
  const oneLinerEn = localized.oneLiner.en;
  const riskNote = localized.riskNote;
  const installHint = localized.installHint;
  const targetUsers = localized.targetUsers;
  const whyNow = localized.whyNow;
  const notFor = localized.notFor;
  const capabilities = localized.capabilities;
  const rawCapabilities = skills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    sourcePath: s.sourcePath,
    isVerifiedSkill: s.isVerifiedSkill,
  }));

  const installs = (p.installCommands ?? []) as InstallCommand[];
  const flags = (p.riskFlags ?? null) as
    | { id: string; label: string; severity: string; source: string; snippet: string }[]
    | null;
  const docSignals = (p.docSignals ?? {}) as Record<string, unknown>;
  const evidence = (p.parseEvidence ?? {}) as Record<string, unknown>;

  /* ── 观测值：全部来自字段，缺数据就说缺数据 ─────────────────────────── */

  const firstSeen = fmtDate(p.firstSeenAt ?? p.firstTrackedAt);

  const growth = snapshotStarGrowth(history);

  // 外部讨论：按来源去重计数
  const sources = new Set(mentions.map((m) => m.source));

  /* Every observation must have a real data source behind it. Items with no
     data are omitted entirely rather than rendered as "历史不足 / 暂无" —
     exposing an internal empty state reads as a half-finished product. */
  const observations: Observation[] = [];

  if (firstSeen) {
    observations.push({
      key: 'first-seen',
      label: bi('pd.obs.firstSeen'),
      value: both(firstSeen),
    });
  }

  if (growth) {
    observations.push({
      key: 'growth',
      label: bi('pd.obs.growth'),
      value: both(`${growth.pct >= 0 ? '+' : ''}${growth.pct.toFixed(1)}%`),
      note: bi('pd.obs.growthNote', {
        from: formatCount(growth.from),
        to: formatCount(growth.to),
        n: growth.samples,
      }),
      magnitude: Math.min(1, Math.abs(growth.pct) / 100),
    });
  }

  if (mentions.length) {
    observations.push({
      key: 'sources',
      label: bi('pd.obs.discussion'),
      value: both(`${sources.size} SOURCES`),
      note: bi('pd.obs.mentions', { n: mentions.length }),
      dots: sources.size,
    });
  }

  observations.push({
    key: 'status',
    label: bi('pd.obs.status'),
    value: isWebsite ? { zh: '网站应用', en: 'Web product' } : { zh: STATUS_LABEL[p.status] ?? p.status, en: STATUS_LABEL_EN[p.status] ?? p.status },
    note: p.qualityGrade ? bi('pd.obs.quality', { g: p.qualityGrade }) : undefined,
  });

  /* ── 限制项：能确认的写结论，没写的写"未在文档中发现" ───────────────── */

  const limits: LimitItem[] = isWebsite ? [
    { key: 'pricing', label: { zh: '费用', en: 'Pricing' }, value: { zh: '以官网当前方案为准', en: 'Check the current plans on the official site' } },
    { key: 'privacy', label: { zh: '数据与隐私', en: 'Data & privacy' }, value: { zh: '未审计服务端代码', en: 'Server-side code has not been audited' } },
    { key: 'review', label: { zh: '官方资料核验', en: 'Official page checked' }, value: both(fmtDate(p.lastVerifiedAt) ?? '—') },
  ] : [
    {
      key: 'apikey',
      label: bi('pd.limits.item.apikey'),
      value: p.requiresApiKey ? bi('pd.limits.found') : bi('pd.limits.notFound'),
    },
    {
      key: 'local',
      label: bi('pd.limits.item.local'),
      value: p.requiresLocalRuntime ? bi('pd.limits.found') : bi('pd.limits.notFound'),
    },
    {
      key: 'docker',
      label: bi('pd.limits.item.docker'),
      value: p.requiresDocker ? bi('pd.limits.found') : bi('pd.limits.notFound'),
    },
    {
      key: 'difficulty',
      label: bi('pd.limits.item.difficulty'),
      value: p.difficulty
        ? { zh: DIFFICULTY_LABEL[p.difficulty] ?? p.difficulty, en: DIFFICULTY_LABEL_EN[p.difficulty] ?? p.difficulty }
        : bi('pd.limits.unrecognised'),
    },
    {
      key: 'license',
      label: bi('pd.limits.item.license'),
      value: p.license ? both(p.license) : bi('pd.limits.notFound'),
      note: p.pricing ? both(p.pricing) : undefined,
    },
    {
      key: 'stage',
      label: bi('pd.limits.item.stage'),
      value: { zh: STATUS_LABEL[p.status] ?? p.status, en: STATUS_LABEL_EN[p.status] ?? p.status },
      note: p.upstreamCreatedAt
        ? bi('pd.limits.createdAt', { d: fmtDate(p.upstreamCreatedAt) ?? '' })
        : undefined,
    },
  ];

  /* ── 渲染 ──────────────────────────────────────────────────────────── */

  const repoUrl = githubCodeRepository(p.primaryUrl, p.fullName);
  const github = ownerRepo(p.fullName);
  const featured = github ? await projectWasFeatured(p.id) : false;
  const githubAttrs = /github\.com\//i.test(p.primaryUrl ?? '')
    ? { 'data-umami-event': 'repo_outbound', 'data-umami-event-repo': p.fullName ?? p.slug }
    : {};

  return (
    <V3Shell>
      <JsonLd
        data={projectJsonLd({
          name: p.name,
          description: projectBodySummary({ name: p.name, oneLinerZh, oneLinerEn }),
          slug: p.slug,
          codeRepository: repoUrl,
          origin: siteOrigin(),
          programmingLanguage: p.language,
          license: p.license,
          author: p.owner,
          forks7d: p.forks7d,
        })}
      />
      {/* ── 第一屏：抽象场景 ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-[var(--gutter)] pt-28 pb-10">
        <div className="relative z-10 mx-auto w-full max-w-[var(--container)]">
          <p className="system" style={{ color: accent }}>
            <LANG zh={categoryLabelZh(categoryKey)} en={categoryLabelEn(categoryKey)} />
            {p.secondaryCategory ? <span className="ml-3">· {p.secondaryCategory.toUpperCase()}</span> : null}
          </p>

          {/* 共享元素：与首页卡片的 h2 同名（§7）。转场时浏览器会把卡片的
              名称放大并移动到这个位置，所以这里不要加淡入动画去抢它。 */}
          <h1
            className="page-title mt-5 max-w-[26ch]"
            style={{ viewTransitionName: `project-title-${p.slug}` }}
          >
            {p.name}
          </h1>

          {p.fullName ? (
            <p className="data mt-4 text-[var(--ink-4)]">{p.fullName}</p>
          ) : null}

          <Fallback as="p" zh={oneLinerZh} en={oneLinerEn} className="editorial mt-6 max-w-[65ch] text-[var(--ink-1)]" />
          <T k="pd.docOnly" as="p" className="data mt-4 text-[var(--ink-3)]" fade={false} />
          {isWebsite ? <dl className="mt-7 grid gap-x-8 gap-y-5 border-y border-[var(--glass-2-border)] py-5 sm:grid-cols-3">
            <div><dt className="system"><LANG zh="官方入口" en="OFFICIAL SITE" /></dt><dd className="body mt-2">{p.domain}</dd></div>
            <div><dt className="system"><LANG zh="费用" en="PRICING" /></dt><dd className="body mt-2"><LANG zh="官网查看当前方案" en="See current plans on the site" /></dd></div>
            <div><dt className="system"><LANG zh="资料核验" en="LAST CHECKED" /></dt><dd className="body mt-2">{fmtDate(p.lastVerifiedAt) ?? '—'}</dd></div>
          </dl> : <dl className="mt-7 grid gap-x-8 gap-y-5 border-y border-[var(--glass-2-border)] py-5 sm:grid-cols-3">
            <div><dt className="system"><T k="pd.agents" as="span" fade={false} /></dt><dd className="body mt-2">{p.supportedAgents.length ? p.supportedAgents.join(' · ') : <T k="pd.costUnknown" as="span" fade={false} />}</dd></div>
            <div><dt className="system"><T k="pd.requirements" as="span" fade={false} /></dt><dd className="body mt-2">{[p.requiresApiKey ? 'API key' : '', p.requiresLocalRuntime ? 'Local runtime' : '', p.requiresDocker ? 'Docker' : ''].filter(Boolean).join(' · ') || <T k="pd.costUnknown" as="span" fade={false} />}</dd></div>
            <div><dt className="system"><T k="pd.limits.item.license" as="span" fade={false} /></dt><dd className="body mt-2">{p.license || <T k="pd.costUnknown" as="span" fade={false} />}</dd></div>
          </dl>}
          <nav className="body mt-6 flex flex-wrap gap-6" aria-label="Project sections / 项目内容">
            <a href="#capabilities"><T k="pd.what.title" as="span" fade={false} /> ↓</a>
            <a href="#install">{isWebsite ? <LANG zh="开始体验" en="Get started" /> : <T k="pd.install.title" as="span" fade={false} />} ↓</a>
            <a href="#limits"><T k="pd.limits.title" as="span" fade={false} /> ↓</a>
          </nav>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href={p.primaryUrl}
              target="_blank"
              rel="noreferrer noopener"
              {...githubAttrs}
              className="body inline-flex items-center gap-2 border-b border-[var(--glass-2-border)] pb-1 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
            >
              {isWebsite ? <LANG zh="打开官网" en="Visit the website" /> : <T k="pd.hero.openRepo" as="span" fade={false} />} <span aria-hidden>↗</span>
            </a>
            {p.homepageUrl && !isWebsite ? (
              <a
                href={p.homepageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="body inline-flex items-center gap-2 border-b border-[var(--glass-1-border)] pb-1 text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)] hover:text-[var(--ink-1)]"
              >
                <T k="pd.hero.homepage" as="span" fade={false} /> <span aria-hidden>↗</span>
              </a>
            ) : null}
            {p.isRising ? (
              <span className="data" style={{ color: accent }}>
                <T k="pd.hero.rising" as="span" fade={false} />
              </span>
            ) : null}
          </div>

          <ProjectActions slug={p.slug} />
          {featured && github ? (
            <ReadmeBadge owner={github.owner} repo={github.repo} slug={p.slug} origin={siteOrigin()} />
          ) : null}

        </div>
      </section>

      {/* ── 第三屏：What it does ────────────────────────────────────── */}
      <section id="capabilities" className="px-[var(--gutter)] py-10">
        <div className="mx-auto max-w-[var(--container)]">
          <T k="pd.what.kicker" as="p" className="system" fade={false} />
          <T k="pd.what.title" as="h2" className="display-l mt-4" />

          <CapabilityList
            capabilities={capabilities}
            raw={rawCapabilities}
            accent={accent}
          />
        </div>
      </section>

      {/* ── 第五屏：Install ─────────────────────────────────────────── */}
      <section id="install" className="px-[var(--gutter)] py-10">
        <div className="mx-auto max-w-[var(--container)]">
          <T k="pd.install.kicker" as="p" className="system" fade={false} />
          {isWebsite ? <LANG zh="开始体验。" en="Get started." as="h2" className="display-l mt-4" /> : <T k="pd.install.title" as="h2" className="display-l mt-4" />}

          <div className="mt-7 max-w-[880px]">
            {!isWebsite && <DetailInstall commands={installs} />}
            <a href={p.primaryUrl} target="_blank" rel="noopener noreferrer" {...githubAttrs} className="body mt-5 inline-block border-b border-[var(--glass-2-border)] pb-1"><LANG zh={isWebsite ? "打开官方体验入口" : "打开项目文档"} en={isWebsite ? "Visit the official site" : "Open project documentation"} /> ↗</a>
          </div>

          {!installs.length && (installHint.zh || installHint.en) ? (
            <Fallback
              as="p"
              zh={installHint.zh}
              en={installHint.en}
              className="body mt-8 max-w-[52ch] text-[var(--ink-2)]"
            />
          ) : null}
        </div>
      </section>

      {/* ── 第六屏：Limits / Risk ───────────────────────────────────── */}
      <section id="limits" className="px-[var(--gutter)] py-10">
        <div className="mx-auto max-w-[var(--container)]">
          <T k="pd.limits.kicker" as="p" className="system" fade={false} />
          <T k="pd.limits.title" as="h2" className="display-l mt-4" />
          {isWebsite ? <LANG zh="以下信息来自官方产品资料，费用和使用条件以官网当前说明为准。" en="These details come from the official product page. Check the site for current pricing and terms of use." as="p" className="body mt-5 max-w-[54ch] text-[var(--ink-2)]" /> : <T
            k="pd.limits.body"
            as="p"
            className="body mt-5 max-w-[54ch] text-[var(--ink-2)]"
          />}

          <div className="mt-7">
            <DetailLimits
              items={limits}
              flags={isWebsite ? null : flags}
              hostedProduct={isWebsite}
              securityLabel={SECURITY_LABEL[p.securityLevel] ?? t('zh', 'state.unknown')}
              securityLabelEn={SECURITY_LABEL_EN[p.securityLevel] ?? t('en', 'state.unknown')}
              riskNoteZh={riskNote.zh}
              riskNoteEn={riskNote.en}
            />
          </div>
        </div>
      </section>

      {/* ── 第二屏：Why now ─────────────────────────────────────────── */}
      {observations.length > 1 ? (
        <section className="px-[var(--gutter)] py-10">
          <div className="mx-auto max-w-[var(--container)]">
            <T k="pd.whynow.kicker" as="p" className="system" fade={false} />
            <T k="pd.whynow.title" as="h2" className="display-l mt-4" />

            <div className="mt-7">
              <DetailObservations items={observations} accent={accent} />
            </div>

            {whyNow.zh.length || whyNow.en.length ? (
              <Fallback
                as="p"
                zh={whyNow.zh[0] ?? null}
                en={whyNow.en[0] ?? null}
                className="editorial mt-7 max-w-[46ch] text-[var(--ink-2)]"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Real Hacker News discussions. Omitted entirely when none were found —
          never rendered as "暂无". */}
      {mentions.length ? (
        <section className="px-[var(--gutter)] pb-[var(--section-gap)]">
          <div className="mx-auto max-w-[var(--container)]">
            <T k="pd.discuss.title" as="h2" className="system" fade={false} />
            <ul className="mt-6 flex flex-col">
              {mentions.slice(0, 3).map((m) => (
                <li key={m.id} className="border-t border-[var(--glass-1-border)] py-5">
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="body block text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-3)]"
                  >
                    {m.title ?? m.url}
                  </a>
                  <p className="data mt-2 text-[var(--ink-4)]">
                    {m.source.toUpperCase()} · {m.points} points · {m.comments} comments
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ── Provenance ──────────────────────────────────────────────── */}
      <section className="px-[var(--gutter)] pb-[var(--section-gap)]">
        <div className="mx-auto max-w-[var(--container)]">
          <details className="border-t border-[var(--glass-1-border)] pt-6">
            <summary className="system cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              PROVENANCE · <T k="pd.prov.summary" as="span" fade={false} />
            </summary>

            <dl className="mt-8 flex flex-col gap-4">
              {[
                { k: 'pd.prov.sourceUrl', v: p.sourceUrl ?? p.primaryUrl },
                { k: 'pd.prov.rawHash', v: p.rawDataHash?.slice(0, 32) ?? '—' },
                { k: 'pd.prov.parsedAt', v: fmtStamp(p.parsedAt) },
                { k: 'pd.prov.lastVerifiedAt', v: fmtStamp(p.lastVerifiedAt) },
                { k: 'pd.prov.growthMeasuredAt', v: fmtStamp(p.growthMeasuredAt) },
                { k: 'pd.prov.queries', v: (p.discoveryQueries ?? []).join(', ') || '—' },
                { k: 'pd.prov.categorySource', v: p.categorySource ?? '—' },
                {
                  k: 'pd.prov.focus',
                  v: p.focusThemes?.length
                    ? `${p.focusThemes.join(' · ')} (${p.focusScore})`
                    : '—',
                },
              ].map((r, i) => (
                <div key={r.k ?? i} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                  <dt className="data w-52 shrink-0 text-[var(--ink-4)]">
                    <T k={r.k as DictKey} as="span" fade={false} />
                  </dt>
                  <dd className="data min-w-0 flex-1 break-all text-[var(--ink-3)]">{r.v}</dd>
                </div>
              ))}
            </dl>

            {Array.isArray(docSignals.dependencies) && (docSignals.dependencies as string[]).length ? (
              <p className="data mt-6 text-[var(--ink-4)]">
                <T k="pd.prov.dependencies" as="span" fade={false} />{(docSignals.dependencies as string[]).slice(0, 12).join(', ')}
              </p>
            ) : null}

            <details className="mt-8">
              <summary className="system cursor-pointer list-none text-[var(--ink-4)] [&::-webkit-details-marker]:hidden">
                <T k="pd.prov.evidenceJson" as="span" fade={false} />
              </summary>
              <pre className="data mt-4 max-h-80 overflow-auto border border-[var(--glass-1-border)] bg-[var(--bg-void)] p-4 whitespace-pre-wrap break-all text-[var(--ink-3)]">
                {JSON.stringify(evidence, null, 2)}
              </pre>
            </details>
          </details>

          <div className="mt-12 border-t border-[var(--glass-1-border)] pt-8">
            <NewsletterSignup location="project_bottom" />
            <SubscribeLink
              medium="project_page"
              className="body mt-6 inline-flex items-center gap-2 border-b border-[var(--glass-2-border)] pb-1 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
            >
              <T k="pd.subscribe.cta" as="span" fade={false} /> <span aria-hidden>→</span>
            </SubscribeLink>
          </div>

          <div className="mt-12 flex flex-wrap gap-8">
            <Link
              href="/"
              className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
            >
              <span aria-hidden>←</span> <T k="pd.back" as="span" fade={false} />
            </Link>
            <Link
              href="/today"
              className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
            >
              <T k="pd.nav.today" as="span" fade={false} />
            </Link>
            <Link
              href={`/feedback/${p.slug}`}
              className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
            >
              <T k="pd.nav.feedback" as="span" fade={false} />
            </Link>
          </div>
        </div>
      </section>
    </V3Shell>
  );
}
