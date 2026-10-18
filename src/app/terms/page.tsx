import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: '服务条款 · Terms of Service' };

const sections: LegalSection[] = [
  {
    id: 'accept',
    title: 'terms.acceptTitle',
    paragraphs: ['terms.acceptP1'],
  },
  {
    id: 'service',
    title: 'terms.serviceTitle',
    paragraphs: ['terms.serviceP1', 'terms.serviceP2'],
  },
  {
    id: 'accounts',
    title: 'terms.accountTitle',
    paragraphs: ['terms.accountP1'],
  },
  {
    id: 'acceptable-use',
    title: 'terms.useTitle',
    paragraphs: ['terms.useP1'],
  },
  {
    id: 'paid',
    title: 'terms.paidTitle',
    paragraphs: ['terms.paidP1', 'terms.paidP2'],
    links: [
      { href: '/sponsor', k: 'nav.sponsor' },
      { href: '/refund', k: 'refund.title' },
    ],
  },
  {
    id: 'ip',
    title: 'terms.ipTitle',
    paragraphs: ['terms.ipP1'],
  },
  {
    id: 'disclaimer',
    title: 'terms.disclaimerTitle',
    paragraphs: ['terms.disclaimerP1', 'terms.disclaimerP2'],
  },
  {
    id: 'liability',
    title: 'terms.liabilityTitle',
    paragraphs: ['terms.liabilityP1'],
  },
  {
    id: 'changes',
    title: 'terms.changeTitle',
    paragraphs: ['terms.changeP1'],
  },
  {
    id: 'law',
    title: 'terms.lawTitle',
    paragraphs: ['terms.lawP1'],
  },
  {
    id: 'contact',
    title: 'terms.contactTitle',
    paragraphs: ['terms.contactP1'],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="terms.kicker"
      title="terms.title"
      intro="terms.intro"
      sections={sections}
    />
  );
}
