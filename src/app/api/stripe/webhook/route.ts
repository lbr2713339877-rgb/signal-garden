import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profile, subscription } from '@/db/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) return NextResponse.json({ ok: false, sample: true }, { status: 202 });

  const stripe = new Stripe(secret);
  const sig = request.headers.get('stripe-signature') ?? '';
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const d = await db();
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      await d
        .insert(subscription)
        .values({
          userId,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
          plan: 'pro',
          status: 'active',
        })
        .onConflictDoUpdate({
          target: subscription.userId,
          set: {
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            plan: 'pro',
            status: 'active',
          },
        });
      await d.update(profile).set({ subscriptionTier: 'pro' }).where(eq(profile.userId, userId));
    }
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const s = event.data.object as Stripe.Subscription;
    const userId = s.metadata?.userId;
    if (userId) {
      const active = ['active', 'trialing'].includes(s.status);
      await d
        .update(subscription)
        .set({ plan: active ? 'pro' : 'free', status: s.status, renewalDate: (s as any).current_period_end ? new Date((s as any).current_period_end * 1000) : null })
        .where(eq(subscription.userId, userId));
      await d.update(profile).set({ subscriptionTier: active ? 'pro' : 'free' }).where(eq(profile.userId, userId));
    }
  }

  return NextResponse.json({ received: true });
}
