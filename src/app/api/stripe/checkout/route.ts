import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { subscription } from '@/db/schema';
import { getCurrentUser } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/user';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, requiresLogin: true }, { status: 401 });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({
      ok: false,
      sample: true,
      message: '请稍后再试。',
    });
  }

  const stripe = new Stripe(secret);
  await ensureProfile(user);
  const d = await db();
  const [sub] = await d.select().from(subscription).where(eq(subscription.userId, user.id)).limit(1);
  const origin = new URL(request.url).origin;
  const params: any = {
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: user.email ?? undefined,
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID ?? 'price_replace_me', quantity: 1 }],
    success_url: `${origin}/my-garden?checkout=success`,
    cancel_url: `${origin}/settings#subscription`,
    metadata: { userId: user.id },
    ...(sub?.stripeCustomerId ? { customer: sub.stripeCustomerId } : {}),
  };
  const session = await stripe.checkout.sessions.create(params);
  return NextResponse.json({ ok: true, url: session.url });
}
