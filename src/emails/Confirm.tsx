import React from "react";
import { Button, Heading, Text } from "react-email";
import type { EmailLocale } from "@/lib/email-locale";
import { NewsletterFrame } from "./frame";

export interface ConfirmEmailProps {
  locale: EmailLocale;
  confirmUrl: string;
  unsubscribeUrl: string;
  siteUrl: string;
}

export function confirmSubject(locale: EmailLocale): string {
  return locale === "en"
    ? "Confirm your Signal Garden Monday weekly digest"
    : "请确认订阅 Signal Garden 每周一周刊";
}

export function ConfirmEmail({ locale, confirmUrl, unsubscribeUrl, siteUrl }: ConfirmEmailProps) {
  const en = locale === "en";
  const preview = en
    ? "Confirm your address to receive the Monday weekly digest. This link expires in 48 hours."
    : "确认这个地址后才会收到每周一周刊。链接 48 小时内有效。";
  return (
    <NewsletterFrame locale={locale} preview={preview} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl}>
      <Heading as="h1" className="text-ink m-0 text-[26px] font-normal leading-8">
        {en ? "Confirm your subscription" : "确认订阅"}
      </Heading>
      <Text className="text-muted mt-4 text-[15px] leading-7">
        {en
          ? "Click the button to receive the Signal Garden Monday weekly digest. The link expires in 48 hours. If you did not ask for this, you can ignore the email."
          : "点下面的按钮，才会开始接收 Signal Garden 每周一周刊。链接 48 小时内有效。如果不是你本人操作，忽略这封邮件即可。"}
      </Text>
      <Button
        href={confirmUrl}
        className="bg-ink text-bg box-border mt-6 inline-block px-5 py-3 text-center text-[14px] no-underline"
      >
        {en ? "Confirm subscription" : "确认订阅"}
      </Button>
    </NewsletterFrame>
  );
}

ConfirmEmail.PreviewProps = {
  locale: "zh",
  confirmUrl: "https://signalgarden.site/subscribe/confirm?t=preview",
  unsubscribeUrl: "https://signalgarden.site/unsubscribe?t=preview",
  siteUrl: "https://signalgarden.site",
} satisfies ConfirmEmailProps;

export default ConfirmEmail;
