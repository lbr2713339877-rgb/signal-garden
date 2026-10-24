import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { connection } from 'next/server';
import { db } from '@/db/client';
import { project } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { publicWeeklyIssues } from '@/lib/weekly-sample';

/* PGlite allows a single process to hold the data directory. Prerendering the
   sitemap alongside other DB-reading pages makes two build workers fight over
   that lock, and the database may be absent during `next build`. Bail out of
   that prerender (dynamic on the first request). `revalidate` plus the cached
   project query keep later requests off the database for an hour. */
export const revalidate = 3600;

const STATIC_PATHS = [
  '/',
  '/today',
  '/en',
  '/trends',
  '/archive',
  '/c',
  '/search',
  '/sponsor',
  '/privacy',
  '/terms',
  '/refund',
  '/cookies',
] as const;

function sitemapPaths(): string[] {
  return [
    ...STATIC_PATHS,
    ...publicWeeklyIssues().map((issue) => `/weekly/${issue.number}`),
  ];
}

function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(raw)) {
    throw new Error('[sitemap] NEXT_PUBLIC_SITE_URL must be an HTTPS production domain');
  }
  if (/^https?:\/\/\d{1,3}(\.\d{1,3}){3}/i.test(raw)) {
    throw new Error('[sitemap] NEXT_PUBLIC_SITE_URL must be a domain, not an IP');
  }
  return raw;
}

type SitemapProject = {
  slug: string;
  firstTrackedAt: string | null;
};

const loadSitemapProjects = unstable_cache(
  async (): Promise<SitemapProject[]> => {
    const d = await db();
    const rows = await d
      .select({ slug: project.slug, firstTrackedAt: project.firstTrackedAt })
      .from(project)
      .where(
        and(
          eq(project.hidden, false),
          eq(project.parseState, 'parsed'),
          isNull(project.junkReason),
          eq(project.isSkillCollection, false),
          isNull(project.duplicateOf),
        ),
      );
    return rows.map((row) => ({
      slug: row.slug,
      firstTrackedAt: row.firstTrackedAt ? row.firstTrackedAt.toISOString() : null,
    }));
  },
  ['sitemap-projects'],
  { revalidate: 3600 },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    await connection();
  }

  const base = siteUrl();

  const statics = sitemapPaths().map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' || path === '/today' ? ('daily' as const) : path.startsWith('/weekly/') ? ('weekly' as const) : ('monthly' as const),
    priority: path === '/' ? 1 : path === '/today' ? 0.9 : path.startsWith('/weekly/') ? 0.8 : 0.6,
  }));

  try {
    const rows = await loadSitemapProjects();

    return [
      ...statics,
      ...rows.map((row) => ({
        url: `${base}/p/${row.slug}`,
        lastModified: row.firstTrackedAt ? new Date(row.firstTrackedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // 数据库瞬时故障（例如连接池超时）时降级返回静态路径，避免 sitemap
    // 对搜索引擎爬虫 500。项目 URL 会在下一次成功的请求里补回来。
    return statics;
  }
}
