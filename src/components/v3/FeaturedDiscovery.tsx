import Link from 'next/link';
import type { ProjectCard } from '@/db/queries';
import { discoveryCopy } from '@/lib/discovery-copy';
import { DISCOVERY_MEDIA } from '@/lib/discovery-media';
import { LANG } from '@/lib/i18n';
import { T } from '@/lib/dict';
import { categoryLabelEn, categoryLabelZh } from './category-color';
import { DiscoveryVisual } from './DiscoveryVisual';

export function FeaturedDiscovery({ card }: { card: ProjectCard }) {
  const copy = discoveryCopy(card);
  const media = DISCOVERY_MEDIA[card.slug];
  return (
    <article className="journal-feature">
      <Link href={`/p/${card.slug}`} data-discovery-target={card.slug} data-discovery-placement="featured" className="journal-feature-link group">
        <div className="journal-feature-copy">
          <p className="journal-feature-overline"><T k="home.firstFeature" as="span" fade={false} /><span aria-hidden> / </span><LANG zh={categoryLabelZh(card.primaryCategory)} en={categoryLabelEn(card.primaryCategory)} /></p>
          <LANG as="h3" zh={copy.headlineZh} en={copy.headlineEn} className="journal-feature-title" />
          <p className="data mt-4 text-[var(--ink-3)]">{card.name}</p>
          <LANG as="p" zh={copy.summaryZh} en={copy.summaryEn} className="body mt-5 text-[var(--ink-2)]" />
          <span className="journal-text-link mt-6 inline-flex items-center gap-5"><T k="home.tryProject" as="span" fade={false} /><span aria-hidden>↗</span></span>
        </div>
        <DiscoveryVisual card={card} featured />
      </Link>
      <div className="journal-feature-footnote">
        <p className="data text-[var(--ink-3)]"><LANG zh={media?.captionZh ?? '项目能力根据公开文档整理。'} en={media?.captionEn ?? 'Capabilities summarized from public documentation.'} /></p>
        {media ? <a href={media.source} target="_blank" rel="noopener noreferrer" className="data journal-source"><T k="home.imageSource" as="span" fade={false} /> ↗</a> : null}
      </div>
    </article>
  );
}
