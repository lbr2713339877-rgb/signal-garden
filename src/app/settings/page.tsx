/**
 * 设置（V3）—— /settings
 *
 * 用户偏好页面：展示可订阅的分类与二级细分。
 * 六个分类的配色沿用分类空间，所以和 /c 的视觉是同一套。
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { categoryColor } from '@/components/v3/category-color';
import { TAXONOMY } from '@/normalizers/taxonomy';
import { T } from '@/lib/dict';
import { LANG } from '@/lib/i18n';

export const metadata: Metadata = { title: '设置 · Settings' };
export const revalidate = 0;

export default function SettingsPage() {
  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k="pg.set.kicker" as="p" className="system" fade={false} />
        <T k="pg.set.title" as="h1" className="display-xl mt-6 max-w-[10ch]" />
        <T k="pg.set.sub" as="p" className="editorial mt-8 max-w-[34ch] text-[var(--ink-2)]" />

        {/* 订阅分类 */}
        <section className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.set.subscribe" as="p" className="system" fade={false} />
          <ul className="mt-6 flex flex-col">
            {TAXONOMY.map((t) => (
              <li
                key={t.key}
                className="flex items-center gap-5 border-t border-[var(--glass-1-border)] py-4"
              >
                <span
                  aria-hidden
                  className="h-[6px] w-[6px] shrink-0 rounded-full"
                  style={{ background: categoryColor(t.key) }}
                />
                {/* 分类名中英不同：用 LANG 叠放，中文模式显示中文、英文模式英文 */}
                <LANG
                  zh={t.label}
                  en={t.en}
                  as="span"
                  className="editorial flex-1 text-[var(--ink-2)]"
                />
                <span className="system shrink-0 text-[var(--ink-4)]">{t.en}</span>
              </li>
            ))}
          </ul>
          <T
            k="pg.set.subscribeNote"
            as="p"
            className="body mt-6 max-w-[54ch] text-[var(--ink-3)]"
          />
        </section>

        {/* 二级细分 */}
        <section className="mt-16 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.set.subFilters" as="p" className="system" fade={false} />
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {TAXONOMY.flatMap((t) => t.secondary).map((s) => (
              <LANG
                key={s.key}
                zh={s.label}
                en={s.en}
                as="span"
                className="system text-[var(--ink-4)]"
              />
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.set.email" as="p" className="system" fade={false} />
          <T k="pg.set.emailBody" as="p" className="body mt-4 max-w-[54ch] text-[var(--ink-2)]" />
          <Link
            href="/feed.xml"
            data-umami-event="rss_click"
            className="system mt-5 inline-flex min-h-11 items-center text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="pg.set.feedLink" as="span" fade={false} /> <span aria-hidden>→</span>
          </Link>
        </section>

        <div className="mt-16 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href="/"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <span aria-hidden>←</span> <T k="pd.back" as="span" fade={false} />
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
