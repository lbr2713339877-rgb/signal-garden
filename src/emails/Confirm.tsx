import React from "react";
import { Button, Heading, Link, Text } from "react-email";
import type { EmailLocale } from "@/lib/email-locale";
import { NewsletterFrame } from "./frame";

export { CONFIRM_SUBJECT, confirmSubject } from "@/lib/newsletter/confirm-copy";

export interface ConfirmEmailProps {
  locale: EmailLocale;
  confirmUrl: string;
  unsubscribeUrl: string;
  siteUrl: string;
}

export function ConfirmEmail({ locale, confirmUrl, unsubscribeUrl, siteUrl }: ConfirmEmailProps) {
  const en = locale === "en";
  const preview = en
    ? "Confirm your subscription. This link expires in 48 hours."
    : "请确认订阅。链接 48 小时内有效。";
  return (
    <NewsletterFrame locale={locale} preview={preview} siteUrl={siteUrl} unsubscribeUrl={unsubscribeUrl}>
      <Heading as="h1" className="text-ink m-0 text-[22px] font-normal leading-7">
        {en ? "Confirm your subscription" : "请确认订阅"}
      </Heading>
      <Button
        href={confirmUrl}
        className="bg-ink text-bg box-border mt-4 inline-block px-5 py-3 text-center text-[14px] no-underline"
      >
        {en ? "Confirm subscription" : "确认订阅"}
      </Button>
      <Text className="text-muted mt-4 mb-0 text-[14px] leading-6">
        {en
          ? "The link expires in 48 hours. If you did not ask for this, ignore this email."
          : "链接 48 小时内有效。如果不是你本人操作，忽略这封邮件即可。"}
      </Text>
      <Text className="text-muted mt-3 mb-0 text-[13px] leading-6">
        {en ? "Or paste this link into your browser:" : "或把这个链接贴到浏览器："}
        <br />
        <Link href={confirmUrl} className="text-ink underline" style={{ wordBreak: "break-all" }}>{confirmUrl}</Link>
      </Text>
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
