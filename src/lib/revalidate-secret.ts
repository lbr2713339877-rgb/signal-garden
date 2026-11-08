import { createHash, timingSafeEqual } from "node:crypto";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/**
 * The caller default and the production target are this URL.
 * `REVALIDATE_ORIGIN` is unset there. A wider loopback check would still
 * accept userinfo, another port, or a path, and those must not receive the
 * token. The secret remains the authorization check.
 */
export const TRUSTED_REVALIDATE_ORIGIN = "http://127.0.0.1:3000";

/**
 * Runtime process env only. Next 15.5 inlines `NEXT_PUBLIC_*` and `next.config`
 * `env`, not a bracket read, and this is not a module-level constant.
 */
export function revalidateSecretFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env["REVALIDATE_SECRET"];
  return typeof raw === "string" ? raw.trim() : "";
}

/** SHA-256 both sides so a short or missing token still compares in constant time. */
export function revalidateTokenMatches(secret: string, presented: string | null): boolean {
  if (!secret) return false;
  const left = createHash("sha256").update(secret, "utf8").digest();
  const right = createHash("sha256").update(presented ?? "", "utf8").digest();
  return timingSafeEqual(left, right);
}

export function redactRevalidateSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}

/**
 * Exact loopback hostname, optional numeric port. Proxy headers are not an input.
 * `127.0.0.1.evil`, a trailing dot, userinfo, and unbracketed `::1` are refused.
 */
export function isStrictLoopbackHost(raw: string | null | undefined): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 255) return false;
  if (/[\s,@\\/]/.test(raw)) return false;
  let hostname: string;
  let port: string | null;
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    if (end < 0) return false;
    hostname = raw.slice(1, end);
    const rest = raw.slice(end + 1);
    if (rest === "") port = null;
    else if (/^:[0-9]+$/.test(rest)) port = rest.slice(1);
    else return false;
  } else if (raw.includes(":")) {
    const split = raw.indexOf(":");
    if (raw.indexOf(":", split + 1) !== -1) return false;
    hostname = raw.slice(0, split);
    port = raw.slice(split + 1);
    if (!/^[0-9]+$/.test(port)) return false;
  } else {
    hostname = raw;
    port = null;
  }
  if (!LOOPBACK_HOSTS.has(hostname)) return false;
  if (port === null) return true;
  if (port.length > 1 && port.startsWith("0")) return false;
  const n = Number(port);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

/**
 * Accepts only `http://127.0.0.1:3000`, plus trailing slashes that strip back
 * to that exact origin. Userinfo, a non-http scheme, a public or disguised
 * host, another port, and a path, query, or fragment are refused.
 */
export function trustedRevalidateOrigin(raw: string | undefined): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 256) return null;
  if (/[^a-z0-9:./]/.test(raw)) return null;
  const normalized = raw.replace(/\/+$/, "");
  if (normalized !== TRUSTED_REVALIDATE_ORIGIN) return null;
  const authority = normalized.slice("http://".length);
  if (!isStrictLoopbackHost(authority)) return null;
  return normalized;
}

export function hostForRevalidate(request: Request): string | null {
  const fromHeader = request.headers.get("host");
  if (fromHeader) return fromHeader;
  try {
    return new URL(request.url).host || null;
  } catch {
    return null;
  }
}

/**
 * Secret match and a strict loopback host are both required. X-Forwarded-For,
 * X-Real-IP, and X-Forwarded-Host neither grant nor veto.
 */
export function authorizeRevalidateRequest(request: Request, secret = revalidateSecretFromEnv()): boolean {
  if (!secret) return false;
  const tokenOk = revalidateTokenMatches(secret, request.headers.get("x-revalidate-token"));
  const hostOk = isStrictLoopbackHost(hostForRevalidate(request));
  return tokenOk && hostOk;
}
