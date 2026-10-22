import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import { T } from '@/lib/dict';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: '退款政策 · Refund Policy' };

const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Refund request / 退款申请')}`;
const sections: LegalSection[] = [
  {
    id: 'can',
    title: 'refund.canTitle',
    paragraphs: ['refund.canP1'],
  },
  {
    id: 'days',
    title: 'refund.daysTitle',
    paragraphs: ['refund.daysP1'],
  },
  {
    id: 'how',
    title: 'refund.howTitle',
    paragraphs: ['refund.howP1'],
  },
  {
    id: 'timeline',
    title: 'refund.timeTitle',
    paragraphs: ['refund.timeP1'],
  },
  {
    id: 'destination',
    title: 'refund.whereTitle',
    paragraphs: ['refund.whereP1'],
  },
  {
    id: 'exceptions',
    title: 'refund.noTitle',
    items: ['refund.no1', 'refund.no2', 'refund.no3', 'refund.no4'],
  },
  {
    id: 'difference',
    title: 'refund.diffTitle',
    paragraphs: ['refund.diffP1', 'refund.diffP2'],
  },
  {
    id: 'duplicate',
    title: 'refund.duplicateTitle',
    paragraphs: ['refund.duplicateP1'],
  },
  {
    id: 'consumer-law',
    title: 'refund.lawTitle',
    paragraphs: ['refund.lawP1'],
  },
];

export default function RefundPage() {
  return (
    <LegalPage
      kicker="refund.kicker"
      title="refund.title"
      intro="refund.intro"
      sections={sections}
    >
      <section className="glass-1 mt-12 max-w-[76ch] p-6">
        <T k="refund.summary" as="p" className="body text-[var(--ink-1)]" />
      </section>

      <section
        id="request"
        className="glass-1 mt-12 max-w-[76ch] scroll-mt-32 p-6"
      >
        <T k="refund.applyTitle" as="p" className="system" fade={false} />
        <T
          k="refund.applyBody"
          as="p"
          className="body mt-4 text-[var(--ink-2)]"
        />
        <a
          href={mailto}
          className="system mt-6 inline-block border border-[var(--glass-2-border)] px-5 py-3 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
        >
          <T k="refund.mailButton" as="span" fade={false} />
        </a>
        <T
          k="refund.template"
          as="div"
          className="data mt-6 overflow-x-auto whitespace-pre-wrap border-t border-[var(--glass-1-border)] pt-5 text-[var(--ink-3)]"
          fade={false}
        />
      </section>
    </LegalPage>
  );
}
