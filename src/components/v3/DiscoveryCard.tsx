import Link from 'next/link';
import type { ProjectCard } from '@/db/queries';
import { categoryLabelEn, categoryLabelZh } from './category-color';
import { LANG } from '@/lib/i18n';
import { T } from '@/lib/dict';
import { discoveryCopy } from '@/lib/discovery-copy';
import { DiscoveryVisual } from './DiscoveryVisual';

export function DiscoveryCard({ card, rank, visual = false }: { card: ProjectCard; rank: number; visual?: boolean }) {
  const copy = discoveryCopy(card);
  return (
    <Link href={`/p/${card.slug}`} data-discovery-target={card.slug} data-discovery-placement="grid" className={`journal-project group${visual ? ' journal-project-illustrated' : ' journal-project-note'}`}>
      {visual ? <DiscoveryVisual card={card} /> : null}
      <div className="journal-project-meta"><span className="data">{String(rank).padStart(2, '0')}</span><LANG zh={categoryLabelZh(card.primaryCategory)} en={categoryLabelEn(card.primaryCategory)} className="system" /></div>
      <LANG as="h3" zh={copy.headlineZh} en={copy.headlineEn} className="journal-project-title" />
      <p className="data mt-3 break-words text-[var(--ink-3)]">{card.name}</p>
      <LANG as="p" zh={copy.headlineZh !== copy.summaryZh ? copy.summaryZh : ''} en={copy.headlineEn !== copy.summaryEn ? copy.summaryEn : ''} className="body mt-4 text-[var(--ink-2)]" />
      <span className="journal-project-open"><T k="ts.open" as="span" fade={false} /> <span aria-hidden>↗</span></span>
    </Link>
  );
}
