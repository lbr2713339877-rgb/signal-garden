import type { MetadataRoute } from 'next';

function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(raw)) {
    throw new Error('[robots] NEXT_PUBLIC_SITE_URL must be an HTTPS production domain');
  }
  return raw;
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/today.json'],
      disallow: ['/api/', '/settings', '/my-garden'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
