/**
 * Public sample of weekly issue 1.
 * Static project names and summaries. No mailing-list rows or personal links.
 */

import Link from "next/link";
import { V3Shell } from "@/components/v3/V3Shell";
import { T } from "@/lib/dict";
import { Fallback } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { WEEKLY_ISSUE_1 } from "@/lib/weekly-sample";

export const metadata = pageMetadata({
  title: "第 1 期",
  description: `Signal Garden 每周精选公开样刊（${WEEKLY_ISSUE_1.from} – ${WEEKLY_ISSUE_1.to}）：本周热度最高的 10 个 GitHub 新项目。`,
  path: "/weekly/1",
});

export default function WeeklyIssueOnePage() {
  const issue = WEEKLY_ISSUE_1;
  return (
    <V3Shell>
      <article className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        <T k="weekly.kicker" as="p" className="system" fade={false} />
        <T k="weekly.title" as="h1" className="page-title mt-4 max-w-[12ch]" />
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

        <div className="mt-10 border-t border-[var(--glass-1-border)] pt-8">
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
