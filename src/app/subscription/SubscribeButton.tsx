import Link from 'next/link';
import { T } from '@/lib/dict';

export function SubscribeButton({ isPro }: { isPro: boolean }) {
  return (
    <Link
      href="/pricing"
      className="system mt-8 inline-block border border-[var(--glass-2-border)] px-5 py-3 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)]"
    >
      <T k={isPro ? 'sub.manageUnavailable' : 'sub.notOpen'} as="span" fade={false} />
    </Link>
  );
}
