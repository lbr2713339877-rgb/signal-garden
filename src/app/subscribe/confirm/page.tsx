import type { Metadata } from "next";
import { V3Shell } from "@/components/v3/V3Shell";
import { T, type DictKey } from "@/lib/dict";
import { inspectConfirm } from "@/lib/newsletter/subscribe";
import { TrackOnLoad } from "@/components/analytics/TrackOnLoad";

export const metadata: Metadata = {
  title: "确认订阅 · Confirm",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const COPY: Record<string, { title: DictKey; body: DictKey }> = {
  pending: { title: "nl.confirmTitle", body: "nl.confirmBody" },
  confirmed: { title: "nl.confirmedTitle", body: "nl.confirmedBody" },
  already: { title: "nl.alreadyTitle", body: "nl.alreadyBody" },
  expired: { title: "nl.expiredTitle", body: "nl.expiredBody" },
  rejected: { title: "nl.rejectedTitle", body: "nl.rejectedBody" },
  invalid: { title: "nl.invalidTitle", body: "nl.invalidBody" },
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; status?: string }>;
}) {
  const params = await searchParams;
  const posted = params.status && COPY[params.status] ? COPY[params.status] : null;
  const view = !posted && params.t ? await inspectConfirm(params.t) : null;
  const showButton = view?.state === "pending" && params.t;
  const fallback = view ? COPY[view.state] ?? COPY.invalid : COPY.invalid;

  return (
    <V3Shell>
      <main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(120px,16vh,200px)] pb-[var(--section-gap)]">
        {params.status === "confirmed" ? <TrackOnLoad event="subscribe_confirmed" /> : null}
        <T k="nl.kicker" as="p" className="system" fade={false} />
        <T k={(posted ?? fallback).title} as="h1" className="page-title mt-4 max-w-[16ch]" />
        <T k={(posted ?? fallback).body} as="p" className="body mt-6 max-w-[58ch] text-[var(--ink-2)]" />
        {showButton ? (
          <form method="post" action="/api/subscribe/confirm" className="mt-10">
            <input type="hidden" name="t" value={params.t} />
            <button type="submit" className="action-primary">
              <T k="nl.confirmButton" as="span" fade={false} />
            </button>
          </form>
        ) : null}
      </main>
    </V3Shell>
  );
}
