/**
 * Public weekly issue. Frozen project names and summaries only.
 * Issue 2+ is another entry in PUBLISHED_WEEKLY_ISSUES; this route stays put.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3Shell } from "@/components/v3/V3Shell";
import { SubscribeLink } from "@/components/v3/SubscribeLink";
import { T } from "@/lib/dict";
import { Fallback } from "@/lib/i18n";
import { weeklyIssueMetadata } from "@/lib/page-meta";
import { publicWeeklyIssues, weeklyIssueByNumber } from "@/lib/weekly-sample";

export function generateStaticParams() {
  return publicWeeklyIssues().map((issue) => ({ issue: String(issue.number) }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ issue: string }>;
}): Promise<Metadata> {
  const { issue: raw } = await params;
  const issue = weeklyIssueByNumber(Number(raw));
  if (!issue) return { title: "周刊" };
  return weeklyIssueMetadata(issue);
}

export default async function WeeklyIssuePage({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue: raw } = await params;
  const issue = weeklyIssueByNumber(Number(raw));
  if (!issue) notFound();

  return (
    <V3Shell>
      <article className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        <T k="weekly.kicker" as="p" className="system" fade={false} />
        <T k="weekly.title" as="h1" className="page-title mt-4 max-w-[12ch]" vars={{ n: issue.issue }} />
        <p className="data mt-6 text-[var(--ink-2)]">
          {issue.from} – {issue.to}
        </p>
        <T k="weekly.note" as="p" className="body mt-4 max-w-[62ch] text-[var(--ink-2)]" />

        <ol className="mt-12 flex flex-col">
          {issue.items.map((item) => (
            <li key={item.href} className="border-t border-[var(--glass-1-border)] py-6">
              <p className="system text-[var(--ink-3)]">
                <Fallback zh={item.labelZh} en={item.labelEn} />
              </p>
              <h2 className="editorial mt-2 text-[var(--ink-1)]">
                <Link href={item.href} className="transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)]">
                  {item.name}
                </Link>
              </h2>
              <Fallback as="p" zh={item.zh} en={item.en} className="body mt-2 max-w-[62ch] text-[var(--ink-2)]" />
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-[var(--glass-1-border)] pt-8">
          <SubscribeLink
            medium="weekly_issue"
            className="system text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)]"
          >
            <T k="pd.subscribe.cta" as="span" fade={false} /> <span aria-hidden>→</span>
          </SubscribeLink>
          <Link
            href="/today"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="weekly.today" as="span" fade={false} /> <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    </V3Shell>
  );
}
