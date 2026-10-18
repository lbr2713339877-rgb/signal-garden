/**
 * 趋势（V3）—— /trends
 *
 * 增长是真的，但很新：数据来自 fork 时间戳（可以回溯 30 天），而不是 star
 * 历史 —— GitHub 已经不再提供 star 历史（REST 返回 404，GraphQL 返回空）。
 *
 * 所以这一页的做法是：说清楚门槛，给出当前的增长排名，并明确"这不是随时间
 * 变化的曲线"。等快照跨度到一周以上再换成真实趋势图 —— 事后拟合的曲线
 * 没有意义。
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { V3Shell } from '@/components/v3/V3Shell';
import { SpaceRow } from '@/components/v3/category/CategorySpace';
import { categoryColor, categoryLabelEn } from '@/components/v3/category-color';
import { getFeatures, getRising } from '@/db/queries';
import { GATE } from '@/collectors/github/growth';
import { T } from '@/lib/dict';

export const metadata: Metadata = { title: '趋势' };
export const revalidate = 0;

export default async function TrendsPage() {
  // Trend board, not the daily edition. See src/lib/edition.ts.
  const [rising, byGrowth] = await Promise.all([getRising(8), getFeatures(24)]);

  // 按测得的 7 天 fork 增长排序
  const ranked = [...byGrowth]
    .sort((a, b) => (b.forks7d ?? 0) - (a.forks7d ?? 0))
    .slice(0, 20);

  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k="pg.trend.kicker" as="p" className="system" fade={false} />
        <T k="pg.trend.title" as="h1" className="display-xl mt-6 max-w-[12ch]" />

        {/* 方法论：先讲清楚数字是怎么来的，再给数字 */}
        <div
          className="glass-1 mt-12 max-w-[68ch] p-6"
          style={{ filter: 'saturate(0.45) brightness(0.95)' }}
        >
          <T k="pg.trend.method" as="p" className="system" fade={false} />
          <T
            k="pg.trend.methodBody"
            as="p"
            className="body mt-4 text-[var(--ink-2)]"
          />
          <p className="data mt-4 text-[var(--ink-3)]">
            GATE · {GATE.totalStars} STARS · {GATE.stars24h} / 24H · {GATE.forks7d} FORKS / 7D
          </p>
          <p className="body mt-4 text-[var(--ink-3)]">
            <T k="pg.trend.notCurve" as="span" className="text-[var(--ink-2)]" fade={false} />
            <T k="pg.trend.notCurveTail" as="span" fade={false} />
          </p>
        </div>

        {/* 飙升 */}
        {rising.length ? (
          <section className="mt-20">
            <T k="pg.trend.rising" as="p" className="system" fade={false} />
            <T k="pg.trend.risingTitle" as="h2" className="display-l mt-6" />
            <T
              k="pg.trend.risingBody"
              as="p"
              className="body mt-5 max-w-[50ch] text-[var(--ink-2)]"
            />

            <div className="mt-10 flex flex-col">
              {rising.map((c, i) => (
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
          </section>
        ) : null}

        {/* 7 天增长榜 */}
        <section className="mt-24">
          <T k="pg.trend.growth" as="p" className="system" fade={false} />
          <T k="pg.trend.growthTitle" as="h2" className="display-l mt-6" />

          {ranked.length ? (
            <div className="mt-10 flex flex-col">
              {ranked.map((c, i) => (
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
            <T k="pg.trend.empty" as="p" className="body mt-10 text-[var(--ink-3)]" />
          )}
        </section>

        <div className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href="/today"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="pg.trend.todayLink" as="span" fade={false} /> <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
