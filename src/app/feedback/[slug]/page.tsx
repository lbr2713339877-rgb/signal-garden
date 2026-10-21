/**
 * 反馈（V3）—— /feedback/[slug]
 *
 * 反馈只提供 brief 允许的五种类型。它进入审核队列，永远不会直接改动公开内容，
 * 所以这里没有"提交项目"。
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { getProjectBySlug } from '@/db/queries';
import { redirectIfAlias } from '@/lib/slug-redirect';
import { T } from '@/lib/dict';
import { FeedbackForm } from './FeedbackForm';

export const metadata: Metadata = { title: '反馈 · Feedback' };
export const revalidate = 0;

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const data = await getProjectBySlug(slug);
  if (!data) {
    await redirectIfAlias("/feedback", slug, await searchParams);
    notFound();
  }

  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k="pg.fb.kicker" as="p" className="system" fade={false} />
        <T k="pg.fb.title" as="h1" className="display-xl mt-6 max-w-[10ch]" />
        <p className="data mt-6 text-[var(--ink-4)]">
          {data.project.fullName ?? data.project.name}
        </p>

        <FeedbackForm slug={slug} />

        <div
          className="glass-1 mt-12 max-w-[62ch] p-6"
          style={{ filter: 'saturate(0.55) brightness(0.95)' }}
        >
          <T k="pg.fb.noteBody" as="p" className="body text-[var(--ink-2)]" />
        </div>

        <div className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href={`/p/${slug}`}
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <span aria-hidden>←</span> <T k="pg.fb.back" as="span" fade={false} />
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
