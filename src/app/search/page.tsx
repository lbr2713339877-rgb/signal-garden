/**
 * 搜索（V3）—— /search
 *
 * 筛选器全部是链接，携带 URL 状态：可分享、不需要 JS、不可能和结果脱节。
 * 表单本身是原生 form method=get，所以即使 JS 没加载，回车也能搜。
 *
 * 搜索框不做成"有结果的浮层"：结果是整页的，因为这一页的排序和筛选
 * 需要和结果同时可见。
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { SpaceRow } from '@/components/v3/category/CategorySpace';
import { categoryColor, categoryLabelEn } from '@/components/v3/category-color';
import { searchProjects } from '@/db/queries';
import { TAXONOMY } from '@/normalizers/taxonomy';
import { T, t, bi, both, type DictKey } from '@/lib/dict';
import { SearchForm } from '@/components/v3/SearchForm';
import { LANG } from '@/lib/i18n';
import type { Bi } from '@/components/v3/detail/DetailObservations';


export const metadata: Metadata = { title: '搜索' };
export const revalidate = 0;

interface Group {
  key: 'cat' | 'difficulty' | 'agent' | 'security';
  labelKey: DictKey;
  /** 选项：专有名词（平台名）两种语言相同，其余走字典 */
  options: { value: string; label: Bi }[];
}

const DIFF_KEY: Record<string, DictKey> = {
  one_click: 'diff.one_click',
  simple_config: 'diff.simple_config',
  needs_api_key: 'diff.needs_api_key',
  needs_local: 'diff.needs_local',
  needs_dev: 'diff.needs_dev',
};

const GROUPS: Group[] = [
  {
    key: 'cat',
    labelKey: 'pg.search.byCat',
    options: TAXONOMY.map((t) => ({ value: t.key, label: { zh: t.label, en: t.en } })),
  },
  {
    key: 'difficulty',
    labelKey: 'pg.search.byDifficulty',
    options: (['one_click', 'simple_config', 'needs_api_key', 'needs_local', 'needs_dev'] as const).map(
      (k) => ({ value: k, label: bi(DIFF_KEY[k]) }),
    ),
  },
  {
    key: 'agent',
    labelKey: 'pg.search.byPlatform',
    /* 平台名是专有名词，按语言策略 a 两种模式都一样 */
    options: ['claude-code', 'cursor', 'codex', 'claude-desktop'].map((k) => ({
      value: k,
      label: both(k),
    })),
  },
  {
    key: 'security',
    labelKey: 'pg.search.bySecurity',
    options: [
      { value: 'unknown', label: bi('pg.search.secNone') },
      { value: 'review', label: bi('pg.search.secReview') },
      { value: 'risk', label: bi('pg.search.secRisk') },
    ],
  },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    difficulty?: string;
    agent?: string;
    security?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();

  const page = Math.min(1000, Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1));
  const pageSize = 30;
  const found = await searchProjects(q, pageSize + 1, { ...sp, offset: (page - 1) * pageSize });
  const hasMore = found.length > pageSize;
  const cards = found.slice(0, pageSize);

  const href = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = {
      q,
      cat: sp.cat,
      difficulty: sp.difficulty,
      agent: sp.agent,
      security: sp.security,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    const s = u.toString();
    return `/search${s ? `?${s}` : ''}`;
  };

  const activeCount = [sp.cat, sp.difficulty, sp.agent, sp.security].filter(Boolean).length;

  return (
        <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        <T k="pg.search.kicker" as="p" className="system" fade={false} />
        <T k="pg.search.title" as="h1" className="page-title mt-4 max-w-[10ch]" />

        {/* 搜索框：原生 form，无 JS 也能提交 */}
        <SearchForm q={q} filters={{ cat: sp.cat, difficulty: sp.difficulty, agent: sp.agent, security: sp.security }} />

        {/* 筛选：链接即状态 */}
        <div className="mt-10 flex flex-col gap-5 border-t border-[var(--glass-1-border)] pt-6">
          {GROUPS.map((g) => (
            <div key={g.key} className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
              <span className="system w-12 shrink-0">
                <T k={g.labelKey} as="span" fade={false} />
              </span>
              {g.options.map((o) => {
                const on = (sp as Record<string, string | undefined>)[g.key] === o.value;
                return (
                  <Link
                    key={o.value}
                    href={href({ [g.key]: on ? undefined : o.value })}
                    aria-current={on ? 'true' : undefined}
                    className="data transition-colors duration-[var(--d-micro)]"
                    style={{
                      color: on ? 'var(--ink-1)' : 'var(--ink-4)',
                      borderBottom: `1px solid ${on ? 'var(--light-fog)' : 'transparent'}`,
                    }}
                  >
                    <LANG zh={o.label.zh} en={o.label.en} as="span" />
                  </Link>
                );
              })}
            </div>
          ))}

          {activeCount ? (
            <div className="flex flex-wrap items-baseline gap-x-6">
              <span className="system w-12 shrink-0" />
              <Link
                href={href({ cat: undefined, difficulty: undefined, agent: undefined, security: undefined })}
                className="data text-[var(--ink-4)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
              >
                <T k="act.filterClear" as="span" fade={false} />
              </Link>
            </div>
          ) : null}
        </div>

        {/* 结果 */}
        <p className="data mt-8 text-[var(--ink-3)]">
          <T k="pg.search.results" as="span" fade={false} vars={{ n: cards.length }} />
          {activeCount ? (
            <>
              {' · '}
              <T
                k="pg.search.filters"
                as="span"
                fade={false}
                vars={{ n: activeCount }}
              />
            </>
          ) : null}
        </p>

        {cards.length ? (
          <div className="mt-6 flex flex-col">
            {cards.map((c, i) => (
              <SpaceRow
                key={c.id}
                index={i}
                slug={c.slug}
                name={c.name}
                hook={{ zh: c.hook, en: c.hookEn }}
                oneLiner={{ zh: c.oneLiner, en: c.oneLinerEn ?? c.description }}
                metric={c.forks7d ?? c.stars24h ?? 0}
                metricUnit={c.forks7d ? 'FORKS / 7D' : 'STARS / 24H'}
                category={categoryLabelEn(c.primaryCategory)}
                accent={categoryColor(c.primaryCategory)}
                isVerified={c.isVerifiedSkill}
              />
            ))}
          </div>
        ) : (
          <T
            k="pg.search.noMatch"
            as="p"
            className="body mt-6 text-[var(--ink-3)]"
          />
        )}
        {page > 1 || hasMore ? <nav aria-label="Pagination / 分页" className="body mt-8 flex gap-8">
          {page > 1 ? <Link href={href({ page: String(page - 1) })}><LANG zh="上一页" en="Previous" /></Link> : null}
          {hasMore ? <Link href={href({ page: String(page + 1) })}><LANG zh="下一页" en="Next" /></Link> : null}
        </nav> : null}
      </div>
    </V3Shell>
  );
}
