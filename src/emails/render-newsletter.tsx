import React from "react";
import { render } from "react-email";
import type { EmailLocale } from "@/lib/email-locale";
import { ConfirmEmail, confirmSubject, type ConfirmEmailProps } from "./Confirm";
import { DailyEmail, dailySubject, type DailyEmailProps, type DigestItem } from "./Daily";
import { WelcomeDigestEmail, welcomeSubject, type DigestWelcomeProps } from "./Welcome";

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

async function renderPair(element: React.ReactElement, subject: string): Promise<RenderedMail> {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { subject, html, text };
}

export function renderConfirmMail(props: ConfirmEmailProps): Promise<RenderedMail> {
  return renderPair(<ConfirmEmail {...props} />, confirmSubject(props.locale));
}

export function renderWelcomeDigest(props: DigestWelcomeProps): Promise<RenderedMail> {
  return renderPair(<WelcomeDigestEmail {...props} />, welcomeSubject(props.locale));
}

export function renderDailyMail(props: DailyEmailProps): Promise<RenderedMail> {
  return renderPair(<DailyEmail {...props} />, dailySubject(props.locale, props.date));
}

export function digestItems(
  locale: EmailLocale,
  siteUrl: string,
  cards: Array<{ name: string; slug: string; oneLiner: string | null; oneLinerEn: string | null; forks7d: number | null }>,
): DigestItem[] {
  return cards.map((card, index) => ({
    rank: index + 1,
    name: card.name,
    oneLiner: (locale === "en" ? card.oneLinerEn || card.oneLiner : card.oneLiner) || card.name,
    forks7d: card.forks7d,
    href: `${siteUrl}/p/${encodeURIComponent(card.slug)}`,
  }));
}
