import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Cookie 政策 · Cookie Policy' };

const sections: LegalSection[] = [
  {
    id: 'what',
    title: 'cookies.whatTitle',
    paragraphs: ['cookies.whatP1'],
  },
  {
    id: 'essential',
    title: 'cookies.essentialTitle',
    paragraphs: ['cookies.essentialP1'],
    items: ['cookies.essential1', 'cookies.essential2', 'cookies.essential3'],
  },
  {
    id: 'functional',
    title: 'cookies.functionalTitle',
    paragraphs: ['cookies.functionalP1'],
    items: ['cookies.functional1', 'cookies.functional2', 'cookies.functional3'],
  },
  {
    id: 'analytics',
    title: 'cookies.analyticsTitle',
    paragraphs: ['cookies.analyticsP1'],
  },
  {
    id: 'third-party',
    title: 'cookies.thirdTitle',
    paragraphs: ['cookies.thirdP1'],
  },
  {
    id: 'manage',
    title: 'cookies.manageTitle',
    paragraphs: ['cookies.manageP1'],
  },
  {
    id: 'contact',
    title: 'cookies.contactTitle',
    paragraphs: ['cookies.contactP1'],
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="cookies.kicker"
      title="cookies.title"
      intro="cookies.intro"
      sections={sections}
    />
  );
}
