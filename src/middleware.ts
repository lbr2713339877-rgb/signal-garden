import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { aliasLookupUrl, aliasRedirectPath, isSlug } from '@/lib/slug-redirect-path';

/**
 * Page redirects run after the root loading skeleton has started streaming, so
 * they cannot set an HTTP status. This lookup returns 308 first. The fetch
 * uses the loopback listener; the Location header stays on the public origin.
 */
async function aliasRedirect(request: NextRequest): Promise<NextResponse | null> {
  const target = aliasRedirectPath(request.nextUrl.pathname);
  if (!target || !isSlug(target.slug)) return null;
  try {
    const res = await fetch(aliasLookupUrl(target.slug), { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { redirectTo?: unknown };
    if (typeof body.redirectTo !== "string" || !isSlug(body.redirectTo)) return null;
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/+$/, "");
    const location = new URL(
      `${target.prefix}/${body.redirectTo}${target.suffix}${request.nextUrl.search}`,
      origin,
    );
    const response = NextResponse.redirect(location, 308);
    response.headers.set("cache-control", "public, max-age=300, s-maxage=300");
    return response;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const renamed = await aliasRedirect(request);
  if (renamed) return renamed;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)'],
};
