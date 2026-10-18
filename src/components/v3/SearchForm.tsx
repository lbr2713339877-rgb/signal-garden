"use client";
import { useLang } from '@/components/ui/Lang';
import { T, t } from '@/lib/dict';

export function SearchForm({ q, filters }: { q: string; filters: Record<string, string | undefined> }) {
  const lang = useLang();
  return <form method="get" action="/search" className="mt-8 max-w-[800px]" role="search">
    {Object.entries(filters).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
    <label htmlFor="project-search" className="sr-only">{t(lang, 'pg.search.placeholder')}</label>
    <div className="glass-2 flex items-center gap-3 p-1.5">
      <input id="project-search" type="search" name="q" defaultValue={q} placeholder={t(lang, 'pg.search.placeholder')} autoComplete="off" className="body min-w-0 flex-1 bg-transparent px-4 py-3 text-[var(--ink-1)] placeholder:text-[var(--ink-3)]" />
      <button type="submit" className="action-primary"><T k="pg.search.title" as="span" fade={false} /></button>
    </div>
  </form>;
}
