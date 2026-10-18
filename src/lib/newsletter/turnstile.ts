export type TurnstileResult = "skipped" | "ok" | "failed";

/**
 * Verification runs only when TURNSTILE_SECRET_KEY is set. An empty secret
 * means the widget is not configured yet, so signup is not blocked on it.
 */
export async function verifyTurnstile(input: {
  token: unknown;
  secret?: string;
  ip?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileResult> {
  const secret = input.secret ?? process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!secret) return "skipped";
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (!token) return "failed";
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (input.ip) body.set("remoteip", input.ip);
  try {
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = await response.json() as { success?: boolean };
    return payload.success === true ? "ok" : "failed";
  } catch {
    return "failed";
  }
}
