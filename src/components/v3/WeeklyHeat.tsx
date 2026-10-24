import type { ReactNode } from "react";
import Link from "next/link";
import { getThisWeekHeatTop } from "@/db/queries/weekly-heat";
import { T } from "@/lib/dict";
import { Fallback } from "@/lib/i18n";
import { publicWeeklyIssues } from "@/lib/weekly-sample";
import { SubscribeLink } from "./SubscribeLink";

function latestIssueNumber(): number {
  const issues = publicWeeklyIssues();
  return issues.reduce((latest, issue) => Math.max(latest, issue.number), 1);
}

/**
 * Homepage lead: this week's heat Top 10, then the existing subscribe form.
 * `children` is that form so the page keeps `location="home"`.
 */
export async function WeeklyHeatTop({ children }: { children?: ReactNode }) {
  const week = await getThisWeekHeatTop();
  const issue = latestIssueNumber();
  return (
    <>
      <section className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28">
        <T k="home.weekly.kicker" as="p" className="system" fade={false} />
        <T k="home.weekly.title" as="h1" className="page-title mt-4 max-w-[12ch]" fade={false} />
        {week.from && week.to ? (
          <p className="data mt-6 text-[var(--ink-2)]">
            {week.from} – {week.to}
          </p>
        ) : null}
        <T k="home.weekly.note" as="p" className="body mt-4 max-w-[62ch] text-[var(--ink-2)]" />
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <SubscribeLink medium="home" className="action-primary">
            <T k="pd.subscribe.cta" as="span" fade={false} />
            <span aria-hidden>→</span>
          </SubscribeLink>
          <Link
            href={`/weekly/${issue}`}
            className="system text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="home.weekly.issue" as="span" fade={false} vars={{ n: issue }} />
          </Link>
          <Link
            href="/today"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="weekly.today" as="span" fade={false} />
          </Link>
        </div>
      </section>
      {children}
      <section className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pb-4">
        {week.items.length ? (
          <ol className="flex flex-col">
            {week.items.map((item, index) => (
              <li key={item.slug} className="border-t border-[var(--glass-1-border)] py-6">
                <p className="system text-[var(--ink-3)]">
                  <span className="data mr-3">{String(index + 1).padStart(2, "0")}</span>
                  <Fallback zh={item.labelZh} en={item.labelEn} />
                </p>
                <h2 className="editorial mt-2 text-[var(--ink-1)]">
                  <Link
                    href={item.href}
                    className="transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)]"
                  >
                    {item.name}
                  </Link>
                </h2>
                <Fallback as="p" zh={item.zh} en={item.en} className="body mt-2 max-w-[62ch] text-[var(--ink-2)]" />
              </li>
            ))}
          </ol>
        ) : (
          <T k="home.weekly.empty" as="p" className="body max-w-[52ch] text-[var(--ink-2)]" />
        )}
      </section>
    </>
  );
}
