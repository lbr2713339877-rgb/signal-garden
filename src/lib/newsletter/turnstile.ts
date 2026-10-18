export type TurnstileResult =
  | { status: "skipped" }
  | { status: "ok" }
  | { status: "failed"; code: string };

const CODE = /^[a-z0-9-]{1,48}$/;

/** Cloudflare error-codes are already short tokens. Anything else becomes `failed`. */
export function turnstileCode(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return CODE.test(raw) ? raw : "failed";
}

/**
 * Verification runs only when TURNSTILE_SECRET_KEY is set. An empty secret
 * means the widget is not configured yet, so signup is not blocked on it.
 * Failures keep Cloudflare's error-codes and are logged here; callers return
 * the short code so the client can record `turnstile:<code>`.
 */
export async function verifyTurnstile(input: {
  token: unknown;
  secret?: string;
  ip?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileResult> {
  const secret = input.secret ?? process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!secret) return { status: "skipped" };
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!token) {
    console.error("[turnstile] siteverify failed", ["missing-input-response"]);
    return { status: "failed", code: "missing-input-response" };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (input.ip) body.set("remoteip", input.ip);
  try {
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      "error-codes"?: unknown;
    } | null;
    if (payload?.success === true) return { status: "ok" };
    const codes = Array.isArray(payload?.["error-codes"])
      ? payload["error-codes"].filter((item): item is string => typeof item === "string")
      : [];
    console.error("[turnstile] siteverify failed", codes.length ? codes : { status: response.status });
    return { status: "failed", code: turnstileCode(codes[0]) };
  } catch (error) {
    console.error("[turnstile] siteverify request failed", error);
    return { status: "failed", code: "network" };
  }
}
