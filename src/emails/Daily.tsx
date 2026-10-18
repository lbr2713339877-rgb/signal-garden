import React from "react";
import { Heading, Link, Section, Text } from "react-email";
import type { EmailLocale } from "@/lib/email-locale";
import { NewsletterFrame } from "./frame";

export interface DigestItem {
  rank: number;
  name: string;
  oneLiner: string;
  forks7d: number | null;
  href: string;
}

export interface DailyEmailProps {
  locale: EmailLocale;
  date: string;
  items: DigestItem[];
  unsubscribeUrl: string;
  siteUrl: string;
}

export function dailySubject(locale: EmailLocale, date: string): string {
  return locale === "en"
    ? `Signal Garden Monday weekly digest · ${date}`
    : `Signal Garden 每周一周刊 · ${date}`;
}

/** Per-project fork count. Null means the line is omitted, not a placeholder. */
export function forkLine(locale: EmailLocale, forks7d: number | null): string | null {
  if (typeof forks7d !== "number" || !Number.isFinite(forks7d)) return null;
  return locale === "en"
    ? `${forks7d} new forks in 7 days`
    : `7 日新增 fork ${forks7d}`;
}

export function DailyEmail({ locale, date, items, unsubscribeUrl, siteUrl }: DailyEmailProps) {
  const en = locale === "en";
  const preview = en
    ? `${items.length} projects worth opening on ${date}.`
    : `${date} 的 ${items.length} 个值得打开的项目。`;
  return (
    <NewsletterFrame locale={locale} preview={preview} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl}>
      <Heading as="h1" className="text-ink m-0 text-[26px] font-normal leading-8">
        {en ? "Today's signals" : "今日信号"}
      </Heading>
      <Text className="text-muted mt-2 text-[13px]">{date}</Text>
      {items.map((item) => (
        <Section key={item.href} className="border-none border-t border-solid border-line mt-4 pt-4">
          <Text className="text-dim m-0 text-[12px]">{String(item.rank).padStart(2, "0")}</Text>
          <Text className="m-0 mt-1 text-[18px] leading-6">
            <Link href={item.href} className="text-ink no-underline">{item.name}</Link>
          </Text>
          <Text className="text-muted m-0 mt-1 text-[14px] leading-6">{item.oneLiner}</Text>
          {forkLine(locale, item.forks7d) ? (
            <Text className="text-dim m-0 mt-1 text-[12px]">{forkLine(locale, item.forks7d)}</Text>
          ) : null}
        </Section>
      ))}
    </NewsletterFrame>
  );
}

DailyEmail.PreviewProps = {
  locale: "zh",
  date: "2026-10-17",
  siteUrl: "https://signalgarden.site",
  unsubscribeUrl: "https://signalgarden.site/unsubscribe?t=preview",
  items: [
    {
      rank: 1,
      name: "Example",
      oneLiner: "一句话说明这个项目做什么。",
      forks7d: 12,
      href: "https://signalgarden.site/p/example",
    },
  ],
} satisfies DailyEmailProps;

export default DailyEmail;
