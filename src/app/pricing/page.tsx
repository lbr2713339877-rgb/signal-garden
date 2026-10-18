import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import { T } from '@/lib/dict';
import { FREE_FOLLOW_LIMIT, FREE_SAVE_LIMIT } from '@/lib/user';
import { PRO_PRICE_CNY, PRO_PRICE_USD } from '@/lib/pricing';

export const metadata: Metadata = { title: '定价 · Pricing' };

const sections: LegalSection[] = [
  {
    id: 'billing',
    title: 'pricing.billingTitle',
    paragraphs: ['pricing.billingP1', 'pricing.billingP2'],
  },
  {
    id: 'payment',
    title: 'pricing.paymentTitle',
    paragraphs: ['pricing.paymentP1'],
  },
  {
    id: 'policies',
    title: 'pricing.policyTitle',
    paragraphs: ['pricing.policyBody'],
    links: [
      { href: '/refund', k: 'refund.title' },
      { href: '/terms', k: 'terms.title' },
      { href: '/privacy', k: 'privacy.title' },
    ],
  },
  {
    id: 'faq',
    title: 'pricing.faqTitle',
    faq: [
      { q: 'pricing.faqCancelQ', a: 'pricing.faqCancelA' },
      { q: 'pricing.faqManageQ', a: 'pricing.faqManageA' },
      { q: 'pricing.faqRefundQ', a: 'pricing.faqRefundA' },
      { q: 'pricing.faqPayQ', a: 'pricing.faqPayA' },
      { q: 'pricing.faqChangeQ', a: 'pricing.faqChangeA' },
    ],
  },
];

export default function PricingPage() {
  return (
    <LegalPage
      compact
      kicker="pricing.kicker"
      title="pricing.title"
      intro="pricing.intro"
      sections={sections}
    >
      <T
        k="pricing.taxNote"
        as="p"
        className="data mt-8 text-[var(--ink-3)]"
        fade={false}
      />

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <article className="glass-1 p-7">
          <T k="pricing.available" as="p" className="system text-[var(--ink-4)]" fade={false} />
          <T k="pricing.freePrice" as="h2" className="page-title mt-5" />
          <T k="pricing.freePeriod" as="p" className="data mt-2 text-[var(--ink-4)]" />
          <T k="pricing.freeDesc" as="p" className="body mt-6 max-w-[46ch] text-[var(--ink-2)]" />
          <ul className="body mt-8 flex flex-col gap-3 text-[var(--ink-2)]">
            <T k="pricing.freeFeat1" as="li" />
            <T k="pricing.freeFeat2" as="li" vars={{ n: FREE_SAVE_LIMIT }} />
            <T k="pricing.freeFeat3" as="li" vars={{ n: FREE_FOLLOW_LIMIT }} />
            <T k="pricing.freeFeat4" as="li" />
          </ul>
        </article>

        <article className="glass-1 p-7" style={{ borderColor: 'var(--light-cyan)' }}>
          <T k="pricing.planned" as="p" className="system text-[var(--light-cyan)]" fade={false} />
          <T k="pricing.proPrice" as="h2" className="page-title mt-5" vars={{ usd: PRO_PRICE_USD, cny: PRO_PRICE_CNY }} />
          
          <T k="pricing.proDesc" as="p" className="body mt-6 max-w-[46ch] text-[var(--ink-2)]" />
          <ul className="body mt-8 flex flex-col gap-3 text-[var(--ink-2)]">
            <T k="pricing.proFeat1" as="li" />
            <T k="pricing.proFeat2" as="li" />
            <T k="pricing.proFeat3" as="li" />
            <T k="pricing.proFeat4" as="li" />
            <T k="pricing.proFeat5" as="li" />
          </ul>
          <Link
            href="/subscription"
            className="system mt-8 inline-block border border-[var(--glass-2-border)] px-5 py-3 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
          >
            <T k="pricing.planned" as="span" fade={false} />
          </Link>
        </article>
      </div>
      <div className="mt-8 border-t border-[var(--glass-2-border)] pt-6">
        <T k="pricing.preview" as="h2" className="editorial" />
        <T k="pricing.previewBody" as="p" className="body mt-3 max-w-[68ch] text-[var(--ink-2)]" />
        <Link href="/today" className="body mt-4 inline-block"><T k="home.allToday" as="span" fade={false} /> →</Link>
      </div>
    </LegalPage>
  );
}
