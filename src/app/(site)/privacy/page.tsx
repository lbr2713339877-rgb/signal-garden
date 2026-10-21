import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: '隐私政策 · Privacy Policy' };

const sections: LegalSection[] = [
  {
    id: 'collect',
    title: 'privacy.collectTitle',
    paragraphs: [
      'privacy.collectP1',
      'privacy.collectP2',
      'privacy.collectP3',
    ],
  },
  {
    id: 'why',
    title: 'privacy.whyTitle',
    paragraphs: ['privacy.whyP1'],
  },
  {
    id: 'use',
    title: 'privacy.useTitle',
    items: [
      'privacy.use1',
      'privacy.use2',
      'privacy.use3',
      'privacy.use4',
      'privacy.use5',
      'privacy.use6',
    ],
  },
  {
    id: 'share',
    title: 'privacy.shareTitle',
    paragraphs: ['privacy.shareP1'],
    items: ['privacy.share2', 'privacy.share3', 'privacy.share4', 'privacy.share5'],
  },
  {
    id: 'storage',
    title: 'privacy.storageTitle',
    paragraphs: ['privacy.storageP1', 'privacy.storageP2'],
  },
  {
    id: 'rights',
    title: 'privacy.rightsTitle',
    paragraphs: ['privacy.rightsP1'],
  },
  {
    id: 'cookies',
    title: 'privacy.cookiesTitle',
    paragraphs: ['privacy.cookiesP1'],
    links: [{ href: '/cookies', k: 'privacy.cookiesLink' }],
  },
  {
    id: 'children',
    title: 'privacy.childrenTitle',
    paragraphs: ['privacy.childrenP1'],
  },
  {
    id: 'changes',
    title: 'privacy.changesTitle',
    paragraphs: ['privacy.changesP1'],
  },
  {
    id: 'contact',
    title: 'privacy.contactTitle',
    paragraphs: ['privacy.contactP1'],
  },
  {
    id: 'newsletter',
    title: 'privacy.newsletterTitle',
    paragraphs: [
      'privacy.newsletterP1',
      'privacy.newsletterP2',
      'privacy.newsletterP3',
      'privacy.newsletterP4',
      'privacy.newsletterP5',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="privacy.kicker"
      title="privacy.title"
      intro="privacy.intro"
      sections={sections}
      updated="2026-10-17"
    />
  );
}
