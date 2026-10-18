/**
 * 分类总览（V3）—— /c
 *
 * 六个空间的门厅。每个分类卡片把自己的二级细分列出来，读者在点进去之前
 * 就知道里面是什么 —— 分类不是盲盒。
 *
 * 环境色在这里只作为光斑出现（两处 radial 低透明度渐变），不作填充。
 * 这一页是服务端组件。
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { categoryColor } from '@/components/v3/category-color';
import { getTaxonomyCounts } from '@/db/queries';
import { TAXONOMY } from '@/normalizers/taxonomy';
import { T } from '@/lib/dict';
import { LANG } from '@/lib/i18n';

export const metadata: Metadata = { title: '分类' };
export const revalidate = 0;

export default async function CategoriesHubPage() {
  const counts = await getTaxonomyCounts();
  const countOf = (k: string) => counts.find((c) => c.k === k)?.n ?? 0;

  return (
    <V3Shell>
      <div className="relative">
        {/* 门厅的环境光：两个很淡的光斑，只是让黑场不是死黑 */}
        <div
          aria-hidden
          className="ambient-light pointer-events-none absolute top-[-20%] left-[-14%] h-[640px] w-[640px]"
          style={{
            background: 'radial-gradient(circle, var(--light-fog), transparent 70%)',
            opacity: 0.1,
          }}
        />
        <div
          aria-hidden
          className="ambient-light pointer-events-none absolute top-[30%] right-[-16%] h-[520px] w-[520px]"
          style={{
            background: 'radial-gradient(circle, var(--light-coral), transparent 70%)',
            opacity: 0.08,
          }}
        />

        <div className="relative mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
          <T k="pg.cat.kicker" as="p" className="system" fade={false} />
          <T k="pg.cat.title" as="h1" className="page-title mt-4 max-w-[12ch]" />
          <T k="pg.cat.sub" as="p" className="editorial mt-8 max-w-[36ch] text-[var(--ink-2)]" />

          <ul className="mt-8 flex flex-col">
            {TAXONOMY.map((t, i) => {
              const accent = categoryColor(t.key);
              return (
                <li key={t.key}>
                  <Link
                    href={`/c/${t.key}`}
                    className="group relative flex flex-col gap-5 border-t border-[var(--glass-1-border)] py-7 md:flex-row md:items-baseline md:gap-12"
                  >
                    {/* hover 时从左侧渗出的一点分类色，只是光 */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-0 transition-opacity duration-[var(--d-narrative)] group-hover:opacity-100"
                      style={{
                        background: `radial-gradient(ellipse at left, color-mix(in srgb, ${accent} 14%, transparent), transparent 70%)`,
                      }}
                    />

                    <span className="data relative w-10 shrink-0 text-[var(--ink-4)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    <span className="relative min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                        <span className="editorial"><LANG zh={t.label} en={t.en} /></span>

                      </span>
                      <span className="body mt-4 block max-w-[46ch] text-[var(--ink-2)]">
                        <LANG zh={t.tagline} en={t.taglineEn} />
                      </span>

                      {/* 二级细分：点进去之前就知道里面有什么 */}
                      <span className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                        {t.secondary.map((s) => (
                          <span key={s.key} className="system text-[var(--ink-4)]">
                            <LANG zh={s.label} en={s.en} />
                          </span>
                        ))}
                      </span>
                    </span>

                    <span className="relative flex shrink-0 items-baseline gap-6 md:flex-col md:items-end md:gap-2">
                      <T
                        k="pg.cat.projects"
                        as="span"
                        className="data text-[var(--ink-3)]"
                        fade={false}
                        vars={{ n: countOf(t.key) }}
                      />
                      <span
                        className="data transition-colors duration-[var(--d-micro)]"
                        style={{ color: accent }}
                      >
                        <T k="pg.cat.enter" as="span" fade={false} /> <span aria-hidden>→</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-[var(--glass-1-border)] pt-10">
            <Link
              href="/"
              className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
            >
              <span aria-hidden>←</span> <T k="pd.back" as="span" fade={false} />
            </Link>
          </div>
        </div>
      </div>
    </V3Shell>
  );
}
