/**
 * 页脚品牌区块（V3）
 *
 * 用的是 V3 的 .system / .editorial / --ink-* ，不是 V2 的 --fs-sm / --hairline。
 * 之前那版混用了 V2 token，在 V3 子树里对不上。
 */

import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import { T, type DictKey } from '@/lib/dict';
import { CONTACT_EMAIL, XHS_ID, XHS_URL } from '@/lib/site';
import { NewsletterSignup } from '@/components/v3/NewsletterForm';

export function FooterBrand({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  return (
    <footer className="relative border-t border-[var(--glass-1-border)] px-[var(--gutter)] py-[clamp(56px,9vh,112px)]">
      <div className="mx-auto flex max-w-[var(--container)] flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-6">
          <BrandLogo variant="full" theme={theme} />
          <T
            k="footer.tagline"
            as="p"
            className="editorial max-w-[30ch] text-[var(--ink-2)]"
          />
          <NewsletterSignup source="footer" />
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <T k="footer.note" as="p" className="system" fade={false} />
          <Link
            href="/status"
            className="data text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="footer.status" as="span" fade={false} />
            <span aria-hidden> →</span>
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="data text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="footer.contact" as="span" fade={false} />
            <span aria-hidden> →</span>
          </a>
          <Link
            href="/sponsor?utm_source=signalgarden&utm_medium=footer&utm_campaign=sponsor"
            className="data text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="footer.sponsor" as="span" fade={false} />
            <span aria-hidden> →</span>
          </Link>
          <a
            href={XHS_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="data text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <T k="footer.xhs" as="span" fade={false} /> {XHS_ID}
            <span aria-hidden> →</span>
          </a>

          <div className="flex flex-wrap gap-x-2 gap-y-2 md:justify-end">
            {([
              ['/privacy', 'privacy.title'],
              ['/terms', 'terms.title'],
              ['/refund', 'refund.title'],
              ['/cookies', 'cookies.title'],
            ] satisfies [string, DictKey][]).map(([href, k], i) => (
              <span key={href} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden className="text-[var(--ink-4)]">·</span> : null}
                <Link
                  href={href}
                  className="data whitespace-nowrap text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
                >
                  <T k={k} as="span" fade={false} />
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
