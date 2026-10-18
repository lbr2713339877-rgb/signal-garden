import Script from 'next/script';
import { analyticsConfig } from '@/lib/analytics';

/**
 * One visitor-analytics script, after the page is interactive.
 *
 * `afterInteractive` injects a single tag and does not block hydration if the
 * collector is slow or absent. Umami reads `data-website-id`. A Plausible
 * classic script reads `data-domain` from the same tag when that attribute
 * is set. No URL is built in code.
 */
export function Analytics() {
  const config = analyticsConfig({
    scriptSrc: process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_SRC,
    websiteId: process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID,
    dataDomain: process.env.NEXT_PUBLIC_ANALYTICS_DATA_DOMAIN,
  });
  if (!config) return null;

  return (
    <Script
      id="sg-analytics"
      src={config.src}
      strategy="afterInteractive"
      {...(config.websiteId ? { 'data-website-id': config.websiteId } : {})}
      {...(config.dataDomain ? { 'data-domain': config.dataDomain } : {})}
    />
  );
}
