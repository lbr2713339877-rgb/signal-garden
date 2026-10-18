import React from "react";
import { Button, Heading, Text } from "react-email";
import type { EmailLocale } from "@/lib/email-locale";
import { NewsletterFrame } from "./frame";

export interface DigestWelcomeProps {
  locale: EmailLocale;
  todayUrl: string;
  unsubscribeUrl: string;
  siteUrl: string;
}

export function welcomeSubject(locale: EmailLocale): string {
  return locale === "en"
    ? "You're subscribed to Signal Garden"
    : "你已订阅 Signal Garden 每日精选";
}

export function WelcomeDigestEmail({ locale, todayUrl, unsubscribeUrl, siteUrl }: DigestWelcomeProps) {
  const en = locale === "en";
  const preview = en
    ? "Your daily digest starts with the next published edition."
    : "下一期每日精选发布后会发到这个地址。";
  return (
    <NewsletterFrame locale={locale} preview={preview} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl}>
      <Heading as="h1" className="text-ink m-0 text-[26px] font-normal leading-8">
        {en ? "You're in." : "订阅已确认。"}
      </Heading>
      <Text className="text-muted mt-4 text-[15px] leading-7">
        {en
          ? "The daily digest arrives after an edition is published. Every letter has an unsubscribe link, and we do not track opens or clicks."
          : "每日精选会在当天榜单发布后寄出。每封信都可以退订。我们不追踪打开和点击。"}
      </Text>
      <Button
        href={todayUrl}
        className="bg-ink text-bg box-border mt-6 inline-block px-5 py-3 text-center text-[14px] no-underline"
      >
        {en ? "Read today's signals" : "看今日信号"}
      </Button>
    </NewsletterFrame>
  );
}

WelcomeDigestEmail.PreviewProps = {
  locale: "en",
  todayUrl: "https://signalgarden.site/today",
  unsubscribeUrl: "https://signalgarden.site/unsubscribe?t=preview",
  siteUrl: "https://signalgarden.site",
} satisfies DigestWelcomeProps;

export default WelcomeDigestEmail;
