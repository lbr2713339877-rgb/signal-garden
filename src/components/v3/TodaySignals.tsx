import Link from 'next/link';
import { getFeedEdition } from '@/db/queries';
import { TODAY_LIMIT } from '@/lib/edition';
import { TAXONOMY } from '@/normalizers/taxonomy';
import { ProjectArchiveSlice, type ProjectSliceData } from './ProjectSlice';
import { T } from '@/lib/dict';

const CATEGORY_COLOR: Record<string, string> = {
  'ai-tools': 'var(--light-purple)', 'indie-web': 'var(--light-cyan)',
  'dev-tools': 'var(--light-fog)', design: 'var(--light-coral)',
  'skill-agent': 'var(--light-mint)', productivity: 'var(--light-amber)',
};
const CATEGORY_LABEL = Object.fromEntries(TAXONOMY.map((category) => [category.key, category.en.toUpperCase()]));

export async function TodaySignals({ limit = TODAY_LIMIT }: { limit?: number }) {
  const { cards, date, isPrevious } = await getFeedEdition(limit);
  const projects: ProjectSliceData[] = cards.map((card, index) => {
    const categoryKey = card.primaryCategory ?? 'dev-tools';
    return {
      id: card.id, slug: card.slug, rank: index + 1, name: card.name, fullName: card.fullName,
      hook: { zh: card.hook, en: card.hookEn },
      oneLiner: { zh: card.oneLiner, en: card.oneLinerEn ?? card.description },
      metric: card.forks7d ?? card.stars24h ?? 0,
      metricUnit: card.forks7d ? 'FORKS / 7D' : 'STARS / 24H',
      categoryKey, categoryLabel: `${CATEGORY_LABEL[categoryKey] ?? categoryKey.toUpperCase()} / ${(card.secondaryCategory ?? '').toUpperCase() || 'GENERAL'}`,
      color: CATEGORY_COLOR[categoryKey] ?? 'var(--light-fog)', imageUrl: card.previewImageUrl,
    };
  });
  return (
    <section id="signals" className="relative overflow-hidden">
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[var(--section-gap)] pb-12">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <p className="system"><T k={isPrevious ? 'home.latestEdition' : 'ts.kicker'} as="span" fade={false} /><span className="data ml-4">{date}</span></p>
          <Link href="/today" className="body inline-flex min-h-11 items-center gap-3"><T k={isPrevious ? 'home.allLatest' : 'home.allToday'} as="span" fade={false} /> →</Link>
        </div>
        <T k={projects.length ? (isPrevious ? 'ts.archiveTitle' : 'ts.title') : 'ts.empty.title'} as="h2" className="display-l mt-6" vars={{ n: projects.length }} />
        <T k={projects.length ? 'home.editionNote' : 'ts.empty.body'} as="p" className="body mt-5 max-w-[52ch] text-[var(--ink-2)]" />
        {isPrevious ? <T k="edition.previousNote" as="p" className="data mt-3 text-[var(--ink-3)]" fade={false} /> : null}
        {projects.length ? <details id="edition-index" className="mt-10 border-y border-[var(--glass-2-border)] py-4">
          <summary className="body cursor-pointer py-2"><T k="ts.quickBrowse" as="span" fade={false} /></summary>
          <ol className="mt-4 grid gap-x-10 sm:grid-cols-2">
            {projects.map((project) => <li key={project.id}><a href={`#signal-${project.slug}`} className="body flex min-h-11 items-center gap-4 border-t border-[var(--glass-1-border)] py-3"><span className="data text-[var(--ink-3)]">{String(project.rank).padStart(2, '0')}</span><span className="min-w-0 break-words">{project.name}</span><span aria-hidden className="ml-auto">↓</span></a></li>)}
          </ol>
        </details> : <Link href="/search" className="body mt-8 inline-flex"><T k="home.browse" as="span" fade={false} /> →</Link>}
      </div>
      {projects.map((project, index) => <ProjectArchiveSlice key={project.id} project={project} reverse={index % 2 === 1} />)}
    </section>
  );
}
