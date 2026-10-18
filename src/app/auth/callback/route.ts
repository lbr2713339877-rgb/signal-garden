import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * OAuth / magic-link callback.
 *
 * The redirect target must be the public origin. Behind Nginx, Next.js sees the
 * internal request (`http://127.0.0.1:3000`), so building the URL from
 * `url.origin` sent users to `http://localhost:3000` after a successful Google
 * sign-in. Prefer the proxy's forwarded host when present, and fall back to the
 * request origin so local development keeps working.
 */
function publicOrigin(request: Request, url: URL): string {
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  if (forwardedHost && !forwardedHost.startsWith('127.0.0.1') && !forwardedHost.startsWith('localhost:')) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  // Local development, or a proxy that did not forward the host.
  return process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http') && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/my-garden';

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, publicOrigin(request, url)));
}
