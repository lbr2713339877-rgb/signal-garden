"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useLang } from "@/components/ui/Lang";
import { T, t } from "@/lib/dict";
import { newsletterFormEnabled } from "@/lib/newsletter/flags";
import { currentUtmSource, trackEvent } from "@/components/analytics/track";

export function NewsletterSignup({ source }: { source: "home" | "today" | "footer" }) {
  const enabled = newsletterFormEnabled();
  if (!enabled && source !== "home") return null;
  const frame = source === "home"
    ? "mx-auto max-w-[var(--container)] px-[var(--gutter)] pb-[clamp(48px,8vh,96px)]"
    : source === "today"
      ? "mt-16 max-w-[520px] border-t border-[var(--glass-1-border)] pt-10"
      : "mt-8 max-w-[360px]";
  return (
    <section id={source === "home" ? "subscribe" : undefined} className={frame}>
      {enabled ? <NewsletterForm source={source} /> : null}
    </section>
  );
}

function NewsletterForm({ source }: { source: "home" | "today" | "footer" }) {
  const lang = useLang();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState<"idle" | "ok" | "invalid_email" | "too_fast" | "turnstile" | "rate_limited">("idle");
  const [pending, setPending] = useState(false);
  const [started] = useState(() => Date.now());
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const token = document.querySelector<HTMLInputElement>("[name='cf-turnstile-response']")?.value ?? "";
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          company,
          locale: lang,
          source,
          formStartedAt: started,
          turnstileToken: token,
        }),
      });
      if (response.ok) {
        setMessage("ok");
        trackEvent("subscribe_submit", { page: source, source: currentUtmSource() });
      } else if (response.status === 429) {
        setMessage("rate_limited");
        trackEvent("subscribe_error", { reason: "rate_limited" });
      } else {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        const error = body?.error;
        const reason = error === "too_fast" || error === "turnstile" ? error : "invalid_email";
        setMessage(reason);
        trackEvent("subscribe_error", { reason: error === reason ? reason : `${reason}:${String(error ?? response.status).slice(0, 20)}` });
      }
    } catch {
      setMessage("invalid_email");
      trackEvent("subscribe_error", { reason: "network" });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[520px]">
      <T k="newsletter.title" as="h2" className="system" fade={false} />
      <T k="newsletter.body" as="p" className="body mt-3 text-[var(--ink-2)]" />
      <div className="absolute left-[-10000px] h-0 overflow-hidden" aria-hidden="true">
        <label>
          <T k="newsletter.company" as="span" fade={false} />
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
        </label>
      </div>
      <label htmlFor={`newsletter-email-${source}`} className="sr-only">{t(lang, "newsletter.placeholder")}</label>
      <div className="glass-2 mt-5 flex items-center gap-3 p-1.5">
        <input
          id={`newsletter-email-${source}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t(lang, "newsletter.placeholder")}
          className="body min-w-0 flex-1 bg-transparent px-4 py-3 text-[var(--ink-1)] placeholder:text-[var(--ink-3)]"
        />
        <button type="submit" className="action-primary" disabled={pending}>
          <T k="newsletter.submit" as="span" fade={false} />
        </button>
      </div>
      {siteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile mt-4" data-sitekey={siteKey} />
        </>
      ) : null}
      <p className="data mt-3 text-[var(--ink-3)]">
        <T k="newsletter.privacy" as="span" fade={false} />{" "}
        <Link href="/privacy" className="underline">
          <T k="privacy.title" as="span" fade={false} />
        </Link>
      </p>
      {message === "ok" ? <T k="newsletter.success" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "invalid_email" ? <T k="newsletter.invalid" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "too_fast" ? <T k="newsletter.tooFast" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "turnstile" ? <T k="newsletter.turnstile" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "rate_limited" ? <T k="newsletter.rate" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
    </form>
  );
}
