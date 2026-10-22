import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { hasSupabaseAuthCookie } from "@/lib/supabase/auth-cookie";

test("sb- auth cookies are the only reason to refresh a session", () => {
  assert.equal(hasSupabaseAuthCookie([]), false);
  assert.equal(hasSupabaseAuthCookie(["signal-garden:lang", "theme"]), false);
  assert.equal(hasSupabaseAuthCookie(["sb-project"]), false);
  assert.equal(hasSupabaseAuthCookie(["sb-ref-auth-token"]), true);
  assert.equal(hasSupabaseAuthCookie(["sb-ref-auth-token.0", "sb-ref-auth-token.1"]), true);
  assert.equal(hasSupabaseAuthCookie(["sb-ref-auth-token-code-verifier"]), true);
});

test("middleware does not fetch slug aliases and skips auth without an sb- cookie", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const anon = await middleware(new NextRequest("https://signalgarden.site/p/cosscom-coss?utm_source=badge"));
    assert.equal(anon.status, 200);
    assert.equal(anon.headers.get("location"), null);
    assert.deepEqual(calls, []);

    calls.length = 0;
    const session = Buffer.from(JSON.stringify({
      access_token: "header.payload.sig",
      refresh_token: "refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "user-1", aud: "authenticated", role: "authenticated" },
    })).toString("base64url");
    const authed = await middleware(new NextRequest("https://signalgarden.site/today", {
      headers: { cookie: `sb-example-auth-token=base64-${session}` },
    }));
    assert.equal(authed.headers.get("location"), null);
    // assert.deepEqual(calls, []) narrows the array to an empty tuple.
    const fetched = calls as string[];
    assert.equal(fetched.some((url) => url.includes("slug-alias")), false);
    assert.equal(fetched.some((url) => url.includes("example.supabase.co")), true);
  } finally {
    globalThis.fetch = original;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  }
});
