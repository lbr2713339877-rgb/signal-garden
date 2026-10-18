import React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";
import type { EmailLocale } from "@/lib/email-locale";
import { RANKING_EN_SHORT, RANKING_ZH_SHORT } from "@/lib/site";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Noto Sans SC',Helvetica,Arial,sans-serif";

export function mailCopy(locale: EmailLocale) {
  const en = locale === "en";
  return {
    en,
    lang: en ? "en" : "zh-CN",
    reason: en
      ? "You're receiving this email because you subscribed to the Signal Garden Monday weekly digest."
      : "你收到这封邮件，是因为你订阅了 Signal Garden 的每周一周刊。",
    unsubscribe: en ? "Unsubscribe from the Monday weekly digest" : "退订每周一周刊",
    entity: "Signal Garden",
    tagline: en ? "Less noise. More signal." : "Less noise. More signal.",
    ranking: en
      ? `The daily list is ${RANKING_EN_SHORT}.`
      : `每日榜单${RANKING_ZH_SHORT}。`,
  };
}

export function NewsletterFrame({
  locale,
  preview,
  siteUrl,
  unsubscribeUrl,
  children,
}: {
  locale: EmailLocale;
  preview: string;
  siteUrl: string;
  unsubscribeUrl: string;
  children: React.ReactNode;
}) {
  const copy = mailCopy(locale);
  return (
    <Html lang={copy.lang}>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                bg: "#060808",
                panel: "#101414",
                footer: "#141c19",
                ink: "#f2f0ea",
                muted: "#b0b7b2",
                dim: "#929e97",
                line: "#2b3430",
              },
            },
          },
        }}
      >
        <Head />
        <Body className="bg-bg m-0 font-sans" style={{ fontFamily: FONT, backgroundColor: "#060808" }}>
          <Preview>{preview}</Preview>
          <Container className="bg-panel mx-auto my-8 max-w-[600px] border-solid border border-line px-8 py-8" style={{ backgroundColor: "#101414" }}>
            <Section>
              <Link href={siteUrl}>
                <Img
                  src={`${siteUrl}/email/logo.png`}
                  alt="Signal Garden"
                  width="240"
                  height="40"
                />
              </Link>
            </Section>
            <Hr className="border-none border-t border-solid border-line my-6" />
            {children}
            <Section className="bg-footer mt-8 px-0 py-4" style={{ backgroundColor: "#141c19" }}>
              <Text className="text-ink m-0 text-[16px]">{copy.tagline}</Text>
              <Text className="text-muted m-0 mt-3 text-[13px] leading-6">
                {copy.entity}
                <br />
                <Link href={siteUrl} className="text-muted underline">{siteUrl.replace(/^https:\/\//, "")}</Link>
                <br />
                <Link href="mailto:hello@signalgarden.site" className="text-muted underline">hello@signalgarden.site</Link>
              </Text>
              <Text className="text-dim m-0 mt-4 text-[12px] leading-5">{copy.ranking}</Text>
              <Text className="text-dim m-0 mt-4 text-[12px] leading-5">{copy.reason}</Text>
              <Text className="m-0 mt-3 text-[13px]">
                <Link href={unsubscribeUrl} className="text-ink underline">{copy.unsubscribe}</Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
