import { redirect } from 'next/navigation';
import { V3Shell } from '@/components/v3/V3Shell';
import { T } from '@/lib/dict';
import { getCurrentUser } from '@/lib/supabase/server';
import { ensureProfile, FREE_FOLLOW_LIMIT, FREE_SAVE_LIMIT } from '@/lib/user';
import { PRO_PRICE_CNY, PRO_PRICE_USD } from '@/lib/pricing';
import { SubscribeButton } from './SubscribeButton';

export const revalidate = 0;

export default async function SubscriptionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const me = await ensureProfile(user);

  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k="sub.kicker" as="p" className="system text-[var(--ink-4)]" fade={false} />
        <T k="sub.title" as="h1" className="display-xl mt-6" />
        <T k="sub.intro" as="p" className="body mt-6 max-w-[56ch] text-[var(--ink-2)]" />

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <article className="glass-1 p-7">
            <p className="system text-[var(--ink-4)]">FREE</p>
            <h2 className="display-l mt-5">$0</h2>
            <ul className="body mt-8 flex flex-col gap-3 text-[var(--ink-2)]">
              <T k="pricing.freeFeat1" as="li" />
              <T k="pricing.freeFeat2" as="li" vars={{ n: FREE_SAVE_LIMIT }} />
              <T k="pricing.freeFeat3" as="li" vars={{ n: FREE_FOLLOW_LIMIT }} />
              <T k="pricing.freeFeat4" as="li" />
            </ul>
          </article>
          <article className="glass-1 p-7" style={{ borderColor: 'var(--light-cyan)' }}>
            <p className="system text-[var(--light-cyan)]">PRO</p>
            <T k="pricing.proPrice" as="h2" className="display-l mt-5" vars={{ usd: PRO_PRICE_USD, cny: PRO_PRICE_CNY }} />
            <ul className="body mt-8 flex flex-col gap-3 text-[var(--ink-2)]">
              <T k="pricing.proFeat1" as="li" />
              <T k="pricing.proFeat2" as="li" />
              <T k="pricing.proFeat3" as="li" />
              <T k="pricing.proFeat4" as="li" />
              <T k="pricing.proFeat5" as="li" />
            </ul>
            <SubscribeButton isPro={me.isPro} />
          </article>
        </div>
      </div>
    </V3Shell>
  );
}
