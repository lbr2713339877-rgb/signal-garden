import Image from 'next/image';
import type { ProjectCard } from '@/db/queries';
import { DISCOVERY_MEDIA } from '@/lib/discovery-media';
import { LANG } from '@/lib/i18n';

export function DiscoveryVisual({ card, featured = false }: { card: ProjectCard; featured?: boolean }) {
  const media = DISCOVERY_MEDIA[card.slug];
  return (
    <div className={`journal-visual${featured ? ' journal-visual-featured' : ''}`} data-category={card.primaryCategory}>
      {media ? <>
        <Image src={media.src} alt={media.altEn} width={media.width} height={media.height}
          sizes={featured ? '(max-width: 767px) calc(100vw - 40px), (max-width: 1280px) 56vw, 720px' : '(max-width: 360px) 100vw, (max-width: 767px) 45vw, (max-width: 1023px) 55vw, 28vw'}
          priority={featured} unoptimized={media.animated} className={media.animated ? 'journal-media journal-media-animated' : 'journal-media'} />
        {media.animated ? <div aria-hidden className="journal-reduced-poster"><span className="journal-poster-glyph">L</span><span className="journal-poster-name">LENIS</span></div> : null}
        <span className={`journal-media-caption${media.animated ? ' journal-animated-caption' : ''}`}><LANG zh="作者提供的项目图片" en="IMAGE FROM THE AUTHOR" /></span>
      </> : <div aria-hidden className="journal-type-cover">
        <span className="journal-cover-category">{card.secondaryCategory ?? card.primaryCategory ?? 'PROJECT'}</span>
        <span className="journal-cover-letter">{card.name.slice(0, 1).toUpperCase()}</span>
        <span className="journal-cover-name">{card.name}</span>
        <span className="journal-cover-rule" />
      </div>}
    </div>
  );
}
