/**
 * Public weekly issue. Frozen project names and summaries only.
 * Issue 2+ is another entry in PUBLISHED_WEEKLY_ISSUES; this route stays put.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V3Shell } from "@/components/v3/V3Shell";
import { SubscribeLink } from "@/components/v3/SubscribeLink";
import { SubscribeHash } from "@/components/v3/SubscribeHash";
import { NewsletterSignup } from "@/components/v3/NewsletterForm";
import { T } from "@/lib/dict";
import { Fallback, LANG } from "@/lib/i18n";
import { weeklyIssueMetadata } from "@/lib/page-meta";
import { CONTACT_EMAIL } from "@/lib/site";
import { publicWeeklyIssues, weeklyIssueByNumber, type WeeklyEditorPick, type WeeklySampleItem } from "@/lib/weekly-sample";

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

function emphasis(text: string) {
  return text.split("**").map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-normal text-[var(--ink-1)]">
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function HeatLine({ heat, peakDate, rank }: { heat: number; peakDate?: string; rank?: number }) {
  return (
    <p className="system text-[var(--ink-3)]">
      {rank != null ? <span className="data mr-3">{String(rank).padStart(2, "0")}</span> : null}
      <T k="weekly.heat" as="span" fade={false} vars={{ n: heat }} />
      {peakDate ? (
        <>
          <span aria-hidden> · </span>
          <T k="weekly.peak" as="span" fade={false} vars={{ d: peakDate }} />
        </>
      ) : null}
    </p>
  );
}

function ProjectRow({ item }: { item: WeeklySampleItem }) {
  return (
    <li className="border-t border-[var(--glass-1-border)] py-6">
      {item.heat != null ? (
        <HeatLine heat={item.heat} peakDate={item.peakDate} rank={item.rank} />
      ) : (
        <p className="system text-[var(--ink-3)]">
          <Fallback zh={item.labelZh} en={item.labelEn} />
        </p>
      )}
      <h2 className="editorial mt-2 text-[var(--ink-1)]">
        <Link href={item.href} className="transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)]">
          {item.name}
        </Link>
      </h2>
      <Fallback as="p" zh={item.zh} en={item.en} className="body mt-2 max-w-[62ch] text-[var(--ink-2)]" />
      {item.starsLine ? <p className="data mt-2 text-[var(--ink-3)]">{item.starsLine}</p> : null}
    </li>
  );
}

function EditorPick({ pick }: { pick: WeeklyEditorPick }) {
  return (
    <section className="mt-4 border-t border-[var(--glass-1-border)] pt-10">
      <T k="weekly.editorPick" as="h2" className="system text-[var(--ink-1)]" fade={false} />
      <T k="weekly.editorPickAside" as="p" className="data mt-2 text-[var(--ink-3)]" fade={false} />
      <div className="mt-8">
        <HeatLine heat={pick.heat} peakDate={pick.peakDate} />
      </div>
      <h3 className="editorial mt-2 text-[var(--ink-1)]">
        <Link href={pick.href} className="transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)]">
          {pick.name}
        </Link>
      </h3>
      <Fallback as="p" zh={pick.zh} en={pick.en} className="body mt-2 max-w-[62ch] text-[var(--ink-2)]" />
      <p className="data mt-2 text-[var(--ink-3)]">{pick.starsLine}</p>
      <Fallback as="p" zh={pick.reasonZh} en={pick.reasonEn} className="body mt-4 max-w-[62ch] text-[var(--ink-2)]" />
    </section>
  );
}

export default async function WeeklyIssuePage({
  params,
}: {
  params: Promise<{ issue: string }>;
}) {
  const { issue: raw } = await params;
  const issue = weeklyIssueByNumber(Number(raw));
  if (!issue) notFound();
  const edition = issue.editorNote;

  return (
    <V3Shell>
      {edition ? <SubscribeHash /> : null}
      <article className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
        <T k={edition ? "home.weekly.kicker" : "weekly.kicker"} as="p" className="system" fade={false} />
        <T k="weekly.title" as="h1" className="page-title mt-4 max-w-[12ch]" vars={{ n: issue.issue }} />
        <p className="data mt-6 text-[var(--ink-2)]">
          {issue.from} – {issue.to}
        </p>
        {edition ? (
          <LANG as="p" fade className="body mt-4 max-w-[62ch] text-[var(--ink-2)]" zh={emphasis(edition.zh)} en={emphasis(edition.en)} />
        ) : (
          <T k="weekly.note" as="p" className="body mt-4 max-w-[62ch] text-[var(--ink-2)]" />
        )}

        {edition ? (
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#subscribe" className="action-primary">
              <T k="pd.subscribe.cta" as="span" fade={false} />
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/today"
              className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
            >
              <T k="weekly.today" as="span" fade={false} /> <span aria-hidden>→</span>
            </Link>
          </div>
        ) : null}

        <ol className="mt-12 flex flex-col">
          {issue.items.map((item) => (
            <ProjectRow key={item.slug} item={item} />
          ))}
        </ol>

        {issue.editorPick ? <EditorPick pick={issue.editorPick} /> : null}

        {issue.sponsor ? (
          <p className="body mt-10 max-w-[62ch] text-[var(--ink-2)]">
            <T k="weekly.sponsor" as="span" fade={false} />{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Sponsorship")}`}
              className="text-[var(--ink-1)] underline decoration-[var(--glass-2-border)] underline-offset-4 transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)]"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        ) : null}

        {edition ? (
          <NewsletterSignup location="weekly" />
        ) : (
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
        )}
      </article>
    </V3Shell>
  );
}
