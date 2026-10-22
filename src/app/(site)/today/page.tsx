/**
 * 今日榜单（V3）—— /today
 *
 * 首页展示的是层级（头条 + 精选），这一页是完整的一天：仍然是同一种形状
 * ——头条在最前，其余按排名往下排。
 *
 * 这里所有内容都过了发布门槛，所以"没通过检查的项目"即使一直往下滚也不会
 * 出现。这一页是服务端组件。
 *
 * 日期在这一层格式化（不依赖 locale），避免服务端和客户端渲染出不同字符串。
 */

import Link from 'next/link';
import { Fragment } from 'react';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { SpaceRow } from '@/components/v3/category/CategorySpace';
import { categoryColor, categoryLabelEn } from '@/components/v3/category-color';
import { getFeedEdition } from '@/db/queries';
import { T } from '@/lib/dict';
import { TODAY_LIMIT, siteOrigin } from '@/lib/edition';
import { Fallback } from '@/lib/i18n';
import { NewsletterSignup } from '@/components/v3/NewsletterForm';
import { SubscribeLink } from '@/components/v3/SubscribeLink';
import { todayInlineInsertIndex } from '@/lib/newsletter/placement';
import { todayPageMetadata } from '@/lib/page-meta';
import { JsonLd } from '@/components/seo/JsonLd';
import { todayItemList } from '@/lib/jsonld';

export const metadata: Metadata = todayPageMetadata();
export const revalidate = 0;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function displayDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

export default async function TodayPage() {
  const { date, cards, isPrevious } = await getFeedEdition(TODAY_LIMIT);
  const headline = cards[0] ?? null;
  const rows = cards.slice(1);
  const total = cards.length;
  const rowSplit = Math.max(0, todayInlineInsertIndex(total) - (headline ? 1 : 0));

  const headlineAccent = categoryColor(headline?.primaryCategory);

  return (
    <V3Shell>
      <JsonLd data={todayItemList(cards.map((card) => ({ name: card.name, slug: card.slug })), siteOrigin(), date)} />
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        {/* 页头 */}
        <T k={isPrevious ? 'home.latestEdition' : 'pg.today.kicker'} as="p" className="system" fade={false} />
        <T k={isPrevious ? 'pg.today.latestTitle' : 'pg.today.title'} as="h1" className="page-title mt-4 max-w-[10ch]" />
        <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <span className="data text-[var(--ink-2)]">{displayDate(date)}</span>
          <T
            k="pg.today.pastFloor"
            as="span"
            className="system"
            fade={false}
            vars={{ n: total }}
          />
        </div>

        {isPrevious ? <T k="edition.previousNote" as="p" className="body mt-5 text-[var(--ink-2)]" fade={false} /> : null}
        <T k="home.editionNote" as="p" className="body mt-4 max-w-[68ch] text-[var(--ink-2)]" />

        {/* 头条 —— 整页唯一一个占满宽度的项目 */}
        {headline ? (
          <section className="mt-10 border-t border-[var(--glass-1-border)] pt-10">
            <p className="system" style={{ color: headlineAccent }}>
              <T k="pg.today.headline" as="span" fade={false} />
            </p>

            <Link href={`/p/${headline.slug}`} className="group mt-6 block" data-umami-event="card_click" data-umami-event-repo={headline.fullName ?? headline.slug} data-umami-event-rank="1" data-umami-event-page="today">
              <h2 className="page-title max-w-[28ch] transition-colors duration-[var(--d-micro)] group-hover:text-[var(--ink-2)]">
                {headline.name}
              </h2>

              <Fallback
                as="p"
                zh={headline.oneLiner}
                en={headline.oneLinerEn ?? headline.description}
                className="body mt-5 max-w-[54ch] text-[var(--ink-2)]"
              />

              <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                {headline.forks7d ? (
                  <span className="data" style={{ color: headlineAccent }}>
                    +{headline.forks7d.toLocaleString('en-US')} FORKS / 7D
                  </span>
                ) : headline.stars24h ? (
                  <span className="data" style={{ color: headlineAccent }}>
                    +{headline.stars24h.toLocaleString('en-US')} STARS / 24H
                  </span>
                ) : null}
                <span className="system">
                  {categoryLabelEn(headline.primaryCategory)}
                  {headline.secondaryCategory ? ` / ${headline.secondaryCategory.toUpperCase()}` : ''}
                </span>
                <span className="system text-[var(--ink-4)]">
                  <T k="ts.open" as="span" fade={false} /> <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </section>
        ) : null}

        {/* 其余按排名 */}
        {rows.length ? (
          <section className="mt-10">
            <T
              k="pg.today.rest"
              as="p"
              className="system"
              fade={false}
              vars={{ n: rows.length }}
            />
            <div className="mt-6 flex flex-col">
              {rows.map((c, i) => (
                <Fragment key={c.id}>
                  {i === rowSplit ? <NewsletterSignup location="today_inline" /> : null}
                  <SpaceRow
                    index={i + (headline ? 1 : 0)}
                    slug={c.slug}
                    name={c.name}
                    hook={{ zh: c.hook, en: c.hookEn }}
                    oneLiner={{ zh: c.oneLiner, en: c.oneLinerEn ?? c.description }}
                    metric={c.forks7d ?? c.stars24h ?? 0}
                    metricUnit={c.forks7d ? 'FORKS / 7D' : 'STARS / 24H'}
                    category={categoryLabelEn(c.primaryCategory)}
                    accent={categoryColor(c.primaryCategory)}
                    isVerified={c.isVerifiedSkill}
                    track={{ repo: c.fullName ?? c.slug, rank: i + (headline ? 2 : 1), page: 'today' }}
                  />
                </Fragment>
              ))}
              {rowSplit >= rows.length ? <NewsletterSignup location="today_inline" /> : null}
            </div>
          </section>
        ) : !headline ? (
          <>
            <T
              k="pg.today.empty"
              as="p"
              className="body mt-10 max-w-[52ch] text-[var(--ink-3)]"
            />
            <NewsletterSignup location="today_inline" />
          </>
        ) : (
          <NewsletterSignup location="today_inline" />
        )}

        <SubscribeLink
          medium="today"
          className="body mt-10 inline-flex items-center gap-2 border-b border-[var(--glass-2-border)] pb-1 text-[var(--ink-1)]"
        >
          <T k="pd.subscribe.cta" as="span" fade={false} /> <span aria-hidden>→</span>
        </SubscribeLink>
        <div className="mt-10 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href="/archive"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="pg.today.archiveLink" as="span" fade={false} /> <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
