"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLang } from "@/components/ui/Lang";
import { T, t } from "@/lib/dict";
import { newsletterFormEnabled } from "@/lib/newsletter/flags";
import { subscribeAck, subscribeAnalyticsProps, type SubscribeLocation } from "@/lib/newsletter/placement";
import { currentUtmSource, trackEvent } from "@/components/analytics/track";
import { loadTurnstile, scheduleTurnstileRender } from "./turnstile-widget";
import { SUBSCRIBE_ID, SUBSCRIBE_SCROLL_MARGIN_PX } from "@/lib/subscribe-scroll";

function subscribeErrorCode(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9-]{1,48}$/.test(raw) ? raw : "failed";
}

function signupFrame(location: SubscribeLocation): string {
  if (location === "home") return "mx-auto max-w-[var(--container)] px-[var(--gutter)] pb-[clamp(48px,8vh,96px)]";
  if (location === "today_inline") return "my-2 max-w-[640px] border-y border-[var(--glass-1-border)] py-10";
  if (location === "project_bottom") return "max-w-[520px]";
  if (location === "project_cta") return "w-full min-w-0 lg:max-w-[520px] lg:flex-1";
  return "mt-8 max-w-[360px]";
}

export function NewsletterSignup({ location }: { location: SubscribeLocation }) {
  const enabled = newsletterFormEnabled();
  if (!enabled && location !== "home") return null;
  const frame = signupFrame(location);
  const inline = location === "project_cta";
  const Region = inline ? "div" : "section";
  return (
    <Region
      id={location === "home" ? SUBSCRIBE_ID : undefined}
      className={frame}
      style={location === "home" ? { scrollMarginTop: SUBSCRIBE_SCROLL_MARGIN_PX } : undefined}
    >
      {enabled ? <NewsletterForm location={location} /> : null}
    </Region>
  );
}

function NewsletterForm({ location }: { location: SubscribeLocation }) {
  const lang = useLang();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<"idle" | "ok" | "already" | "invalid_email" | "too_fast" | "turnstile" | "rate_limited">("idle");
  const [pending, setPending] = useState(false);
  const [started] = useState(() => Date.now());
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const done = message === "ok" || message === "already";

  useEffect(() => {
    if (!siteKey) return;
    let active = true;
    const job = scheduleTurnstileRender({
      getHost: () => widgetRef.current,
      render: (host) => {
        if (!active || widgetIdRef.current) return;
        loadTurnstile()
          .then((turnstile) => {
            if (!active || widgetIdRef.current || widgetRef.current !== host) return;
            widgetIdRef.current = turnstile.render(host, {
              sitekey: siteKey,
              callback: setToken,
              "expired-callback": () => setToken(""),
              "error-callback": () => setToken(""),
            });
          })
          .catch((error) => {
            console.error("[turnstile] widget failed", error);
            setToken("");
          });
      },
    });
    return () => {
      active = false;
      job.cancel();
      const widgetId = widgetIdRef.current;
      widgetIdRef.current = null;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          /* widget already removed */
        }
      }
    };
  }, [siteKey]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlightRef.current || done) return;
    if (siteKey && !token) return;
    inFlightRef.current = true;
    setPending(true);
    let succeeded = false;
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          company,
          locale: lang,
          source: location,
          formStartedAt: started,
          turnstileToken: token,
        }),
      });
      const analytics = subscribeAnalyticsProps(location, currentUtmSource());
      if (response.ok) {
        succeeded = true;
        const body = await response.json().catch(() => null) as { sent?: unknown } | null;
        setMessage(subscribeAck(body) === "already" ? "already" : "ok");
        trackEvent("subscribe_submit", analytics);
      } else if (response.status === 429) {
        setMessage("rate_limited");
        trackEvent("subscribe_error", { ...analytics, reason: "rate_limited" });
      } else {
        const body = await response.json().catch(() => null) as { error?: string; code?: string } | null;
        const error = body?.error;
        if (error === "turnstile") {
          setMessage("turnstile");
          trackEvent("subscribe_error", { ...analytics, reason: `turnstile:${subscribeErrorCode(body?.code)}` });
        } else {
          const reason = error === "too_fast" ? "too_fast" : "invalid_email";
          setMessage(reason);
          trackEvent("subscribe_error", { ...analytics, reason: error === reason ? reason : `${reason}:${String(error ?? response.status).slice(0, 20)}` });
        }
      }
    } catch {
      setMessage("invalid_email");
      trackEvent("subscribe_error", { ...subscribeAnalyticsProps(location, currentUtmSource()), reason: "network" });
    } finally {
      setToken("");
      const widgetId = widgetIdRef.current;
      if (!succeeded && widgetId && window.turnstile) {
        try {
          window.turnstile.reset(widgetId);
        } catch {
          /* widget already removed */
        }
      }
      inFlightRef.current = false;
      setPending(false);
    }
  }

  const needsToken = siteKey.length > 0 && token.length === 0;
  const locked = pending || done;
  const compact = location === "project_cta";

  return (
    <form onSubmit={onSubmit} className={compact ? "w-full min-w-0" : "max-w-[520px]"}>
      {compact ? (
        <T k="newsletter.body" as="p" className="body text-[var(--ink-2)]" fade={false} />
      ) : (
        <>
          <T k="newsletter.title" as="h2" className="system" fade={false} />
          <T k="newsletter.body" as="p" className="body mt-3 text-[var(--ink-2)]" />
          <Link href="/weekly/1" className="data mt-3 inline-flex text-[var(--ink-2)] underline decoration-[var(--glass-2-border)] underline-offset-4 transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]">
            <T k="newsletter.sample" as="span" fade={false} />
          </Link>
        </>
      )}
      <div className="absolute left-[-10000px] h-0 overflow-hidden" aria-hidden="true">
        <label>
          <T k="newsletter.company" as="span" fade={false} />
          <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
        </label>
      </div>
      <label htmlFor={`newsletter-email-${location}`} className="sr-only">{t(lang, "newsletter.placeholder")}</label>
      <div className={compact ? "mt-3 flex w-full min-w-0 items-center gap-3" : "glass-2 mt-5 flex items-center gap-3 p-1.5"}>
        <input
          id={`newsletter-email-${location}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          readOnly={locked}
          placeholder={t(lang, "newsletter.placeholder")}
          className={compact
            ? "body min-w-0 flex-1 border border-[var(--glass-2-border)] bg-transparent px-4 py-3 text-[var(--ink-1)] placeholder:text-[var(--ink-3)]"
            : "body min-w-0 flex-1 bg-transparent px-4 py-3 text-[var(--ink-1)] placeholder:text-[var(--ink-3)]"}
        />
        <button type="submit" className={compact ? "action-primary shrink-0" : "action-primary"} disabled={locked || needsToken} aria-disabled={locked || needsToken}>
          <T
            k={message === "already" ? "newsletter.already" : message === "ok" ? "newsletter.sent" : "newsletter.submit"}
            as="span"
            fade={false}
          />
        </button>
      </div>
      <div role="status" aria-live="polite">
        {message === "ok" ? <T k="newsletter.success" as="p" className="body mt-4 text-[var(--ink-1)]" fade={false} /> : null}
        {message === "already" ? <T k="newsletter.alreadyBody" as="p" className="body mt-4 text-[var(--ink-1)]" fade={false} /> : null}
      </div>
      {siteKey ? <div ref={widgetRef} className="mt-4" hidden={done} /> : null}
      <p className="data mt-3 text-[var(--ink-3)]">
        <T k="newsletter.privacy" as="span" fade={false} />{" "}
        <Link href="/privacy" className="underline">
          <T k="privacy.title" as="span" fade={false} />
        </Link>
      </p>
      {message === "invalid_email" ? <T k="newsletter.invalid" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "too_fast" ? <T k="newsletter.tooFast" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "turnstile" ? <T k="newsletter.turnstile" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
      {message === "rate_limited" ? <T k="newsletter.rate" as="p" className="body mt-4 text-[var(--ink-1)]" /> : null}
    </form>
  );
}
