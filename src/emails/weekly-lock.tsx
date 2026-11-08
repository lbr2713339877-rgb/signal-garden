/**
 * Curated Monday weekly, rendered from a published issue lock.
 * Subject, Top 10, and editor pick come from that issue. Nothing here reads the list.
 */
import React from "react";
import { Heading, Hr, Link, Section, Text, render } from "react-email";
import { CONTACT_EMAIL } from "@/lib/site";
import type { WeeklyEditorPick, WeeklyIssue, WeeklySampleItem } from "@/lib/weekly-sample";
import {
  WEEKLY_LOCK_PREHEADER,
  weeklyAbsoluteUrl,
  weeklyLockSubject,
  weeklyMonthDay,
  weeklyPlainCopy,
  weeklyRssUrl,
  weeklyTodayUrl,
  weeklyWebUrl,
  weeklyWindowLabel,
} from "@/lib/newsletter/weekly-lock";
import { NewsletterFrame } from "./frame";

function heatLine(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function ProjectBlock({ item, siteUrl }: { item: WeeklySampleItem; siteUrl: string }) {
  const peak = item.peakDate ? weeklyMonthDay(item.peakDate) : "";
  return (
    <Section className="border-none border-t border-solid border-line mt-4 pt-4">
      <Text className="text-dim m-0 text-[12px]">
        {heatLine([
          `#${item.rank}`,
          item.heat != null ? `热度分 ${item.heat}` : null,
          peak ? `峰值 ${peak}` : null,
        ])}
      </Text>
      <Text className="m-0 mt-1 text-[18px] leading-6">
        <Link href={weeklyAbsoluteUrl(siteUrl, item.href)} className="text-ink no-underline">
          {item.name}
        </Link>
      </Text>
      <Text className="text-muted m-0 mt-1 text-[14px] leading-6">{item.zh}</Text>
      {item.en ? <Text className="text-dim m-0 mt-1 text-[12px] leading-5">{item.en}</Text> : null}
      {item.starsLine ? <Text className="text-dim m-0 mt-1 text-[12px]">{item.starsLine}</Text> : null}
    </Section>
  );
}

function EditorPickBlock({ pick, siteUrl }: { pick: WeeklyEditorPick; siteUrl: string }) {
  return (
    <>
      <Hr className="border-none border-t border-solid border-line my-6" />
      <Heading as="h2" className="text-ink m-0 text-[18px] font-normal leading-7">
        编辑推荐 · {pick.name}
      </Heading>
      <Section className="mt-3">
        <Text className="text-dim m-0 text-[12px]">
          {heatLine([`热度分 ${pick.heat}`, `峰值 ${weeklyMonthDay(pick.peakDate)}`, "不在 Top 10"])}
        </Text>
        <Text className="m-0 mt-1 text-[18px] leading-6">
          <Link href={weeklyAbsoluteUrl(siteUrl, pick.href)} className="text-ink no-underline">
            {pick.name}
          </Link>
        </Text>
        <Text className="text-muted m-0 mt-1 text-[14px] leading-6">{pick.zh}</Text>
        {pick.en ? <Text className="text-dim m-0 mt-1 text-[12px] leading-5">{pick.en}</Text> : null}
        <Text className="text-dim m-0 mt-1 text-[12px]">{pick.starsLine}</Text>
        <Text className="text-muted m-0 mt-2 text-[13px] leading-6">{weeklyPlainCopy(pick.reasonZh)}</Text>
      </Section>
    </>
  );
}

export function WeeklyLockEmail({
  issue,
  siteUrl,
  unsubscribeUrl,
}: {
  issue: WeeklyIssue;
  siteUrl: string;
  unsubscribeUrl: string;
}) {
  const web = weeklyWebUrl(siteUrl, issue.issue);
  const note = issue.editorNote;
  return (
    <NewsletterFrame locale="zh" preview={WEEKLY_LOCK_PREHEADER} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl}>
      <Heading as="h1" className="text-ink m-0 text-[26px] font-normal leading-8">
        Signal Garden 周刊 #{issue.issue}
      </Heading>
      <Text className="text-muted mt-2 text-[13px]">
        第 {issue.issue} 期 · {weeklyWindowLabel(issue.from, issue.to)}
      </Text>
      <Text className="text-muted m-0 mt-1 text-[13px]">
        网页版：
        <Link href={web} className="text-ink underline">
          {new URL(siteUrl).host}/weekly/{issue.issue}
        </Link>
      </Text>

      {note ? (
        <Section className="mt-6">
          <Text className="text-ink m-0 text-[15px] font-normal">编者按</Text>
          <Text className="text-muted m-0 mt-2 text-[14px] leading-6">{weeklyPlainCopy(note.zh)}</Text>
          <Text className="text-dim m-0 mt-3 text-[13px] leading-6">{weeklyPlainCopy(note.en)}</Text>
        </Section>
      ) : null}

      <Hr className="border-none border-t border-solid border-line my-6" />
      <Heading as="h2" className="text-ink m-0 text-[18px] font-normal leading-7">
        Top 10 · 本周热度最高
      </Heading>
      {issue.items.map((item) => (
        <ProjectBlock key={item.slug} item={item} siteUrl={siteUrl} />
      ))}

      {issue.editorPick ? <EditorPickBlock pick={issue.editorPick} siteUrl={siteUrl} /> : null}

      {issue.sponsor ? (
        <Section className="mt-6">
          <Text className="text-dim m-0 text-[13px] leading-6">
            想在这里介绍你的开发者工具？写信给我们：
            <Link href={`mailto:${CONTACT_EMAIL}?subject=Sponsorship`} className="text-ink underline">
              {CONTACT_EMAIL}
            </Link>
          </Text>
        </Section>
      ) : null}

      <Section className="mt-6">
        <Text className="text-muted m-0 text-[13px]">
          <Link href={weeklyTodayUrl(siteUrl)} className="text-ink underline">
            看今天的榜单 →
          </Link>
        </Text>
        <Text className="text-muted m-0 mt-2 text-[13px]">
          <Link href={web} className="text-ink underline">
            网页版 / 转发给朋友 →
          </Link>
        </Text>
        <Text className="text-dim m-0 mt-3 text-[12px]">
          RSS：
          <Link href={weeklyRssUrl(siteUrl)} className="text-muted underline">
            {weeklyRssUrl(siteUrl)}
          </Link>
        </Text>
      </Section>
    </NewsletterFrame>
  );
}

export async function renderWeeklyLockMail(
  issue: WeeklyIssue,
  siteUrl: string,
  unsubscribeUrl: string,
): Promise<{ subject: string; html: string; text: string }> {
  const element = <WeeklyLockEmail issue={issue} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl} />;
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { subject: weeklyLockSubject(issue), html, text };
}
