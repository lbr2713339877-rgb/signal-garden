import Link from "next/link";
import type { Metadata } from "next";
import { V3Shell } from "@/components/v3/V3Shell";
import { T } from "@/lib/dict";
import { pageMetadata } from "@/lib/page-meta";
import { CONTACT_EMAIL, RANKING_ZH_SHORT } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "赞助 · Sponsor",
  description:
    `Signal Garden 面向每天追踪 GitHub 趋势仓库的开发者，${RANKING_ZH_SHORT}。早期赞助位是今日榜一条和周一邮件周刊，RSS 一行可选。来信 hello@signalgarden.site。`,
  path: "/sponsor",
});

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Sponsorship")}`;

export default function SponsorPage() {
  return (
    <V3Shell>
      <main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k="sponsor.kicker" as="p" className="system" fade={false} />
        <T k="sponsor.title" as="h1" className="page-title mt-4 max-w-[12ch]" />
        <T k="sponsor.intro" as="p" className="editorial mt-8 max-w-[42ch] text-[var(--ink-1)]" />

        <section className="mt-16 border-t border-[var(--glass-1-border)] pt-8">
          <T k="sponsor.audienceTitle" as="h2" className="system" fade={false} />
          <T k="sponsor.audienceBody" as="p" className="body mt-5 max-w-[66ch] text-[var(--ink-2)]" />
        </section>

        <section className="mt-16 border-t border-[var(--glass-1-border)] pt-8">
          <T k="sponsor.placementsTitle" as="h2" className="system" fade={false} />
          <ul className="mt-8 flex max-w-[70ch] flex-col gap-10">
            <li>
              <T k="sponsor.placeTodayTitle" as="h3" className="system text-[var(--ink-1)]" fade={false} />
              <T k="sponsor.placeTodayBody" as="p" className="body mt-3 text-[var(--ink-2)]" />
              <Link
                href="/today?utm_source=signalgarden&utm_medium=sponsor_page&utm_campaign=sponsor"
                className="data mt-3 inline-flex text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
              >
                /today <span aria-hidden>→</span>
              </Link>
            </li>
            <li>
              <T k="sponsor.placeDigestTitle" as="h3" className="system text-[var(--ink-1)]" fade={false} />
              <T k="sponsor.placeDigestBody" as="p" className="body mt-3 text-[var(--ink-2)]" />
            </li>
            <li>
              <T k="sponsor.placeRssTitle" as="h3" className="system text-[var(--ink-1)]" fade={false} />
              <T k="sponsor.placeRssBody" as="p" className="body mt-3 text-[var(--ink-2)]" />
              <Link
                href="/feed.xml?utm_source=signalgarden&utm_medium=sponsor_page&utm_campaign=sponsor"
                className="data mt-3 inline-flex text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
              >
                /feed.xml <span aria-hidden>→</span>
              </Link>
            </li>
          </ul>
          <T k="sponsor.note" as="p" className="body mt-10 max-w-[66ch] text-[var(--ink-3)]" />
        </section>

        <section className="mt-16 border-t border-[var(--glass-1-border)] pt-8">
          <T k="sponsor.contactTitle" as="h2" className="system" fade={false} />
          <T k="sponsor.contactBody" as="p" className="body mt-5 max-w-[66ch] text-[var(--ink-2)]" />
          <a
            href={MAILTO}
            data-umami-event="sponsor_click"
            data-umami-event-placement="sponsor_page"
            className="body mt-8 inline-flex items-center gap-2 border-b border-[var(--glass-2-border)] pb-1 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
          >
            <T k="sponsor.contactCta" as="span" fade={false} />
            <span aria-hidden>↗</span>
          </a>
          <p className="data mt-4 text-[var(--ink-3)]">{CONTACT_EMAIL}</p>
        </section>
      </main>
    </V3Shell>
  );
}
