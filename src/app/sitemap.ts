import type { MetadataRoute } from 'next';
import { db } from '@/db/client';
import { project } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/* PGlite allows a single process to hold the data directory. Prerendering the
   sitemap alongside other DB-reading pages makes two build workers fight over
   that lock, so it is generated per request instead. */
export const dynamic = 'force-dynamic';

const STATIC_PATHS = [
  '/',
  '/today',
  '/trends',
  '/archive',
  '/c',
  '/search',
  '/sponsor',
  '/privacy',
  '/terms',
  '/refund',
  '/cookies',
  '/weekly/1',
] as const;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const statics = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' || path === '/today' ? ('daily' as const) : ('monthly' as const),
    priority: path === '/' ? 1 : path === '/today' ? 0.9 : 0.6,
  }));

  try {
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

    return [
      ...statics,
      ...rows.map((row) => ({
        url: `${base}/p/${row.slug}`,
        lastModified: row.firstTrackedAt ?? new Date(),
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
