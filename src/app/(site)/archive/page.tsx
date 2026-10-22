/**
 * 归档（V3）—— /archive
 *
 * 归档要成立，前提是每天的榜单被原样存下来（分数跟日期一起存），而不是
 * 用今天的排序回填过去 —— 那样归档就没有意义了。
 *
 * 按真实发布日分组读取往期记录，不复用今日列表。
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { V3Shell } from '@/components/v3/V3Shell';
import { SpaceRow } from '@/components/v3/category/CategorySpace';
import { categoryColor, categoryLabelEn } from '@/components/v3/category-color';
import { getArchiveEditions } from '@/db/queries';
import { T } from '@/lib/dict';

export const metadata: Metadata = { title: '归档' };
export const revalidate = 0;

export default async function ArchivePage() {
  const editions = await getArchiveEditions();

  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        <T k="pg.arch.kicker" as="p" className="system" fade={false} />
        <T k="pg.arch.title" as="h1" className="page-title mt-4 max-w-[10ch]" />

        {editions.length ? (
          <div className="mt-16 flex flex-col gap-20">
            {editions.map(({ date, cards }) => (
              <section key={date}>
                <h2 className="data mb-8 text-[var(--ink-2)]">{date}</h2>
                {cards.map((c, i) => (
                  <SpaceRow
                    key={c.id}
                    index={i}
                    slug={c.slug}
                    name={c.name}
                    hook={{ zh: c.hook, en: c.hookEn }}
                    oneLiner={{ zh: c.oneLiner, en: c.oneLinerEn ?? c.description }}
                    metric={Math.round(c.heatScore ?? 0)}
                    metricUnit="HEAT"
                    metricPrefix=""
                    category={categoryLabelEn(c.primaryCategory)}
                    accent={categoryColor(c.primaryCategory)}
                    isVerified={c.isVerifiedSkill}
                  />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <T k="pg.arch.empty" as="p" className="body mt-16 text-[var(--ink-3)]" />
        )}

        <div className="mt-10 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href="/today"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <span aria-hidden>←</span> <T k="pg.arch.back" as="span" fade={false} />
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
