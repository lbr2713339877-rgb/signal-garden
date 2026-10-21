import type { Metadata } from "next";
import { V3Shell } from "@/components/v3/V3Shell";
import { T, type DictKey } from "@/lib/dict";
import { inspectUnsubscribe } from "@/lib/newsletter/subscribe";

export const metadata: Metadata = {
  title: "退订 · Unsubscribe",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const COPY: Record<string, { title: DictKey; body: DictKey }> = {
  ready: { title: "nl.unsubTitle", body: "nl.unsubBody" },
  unsubscribed: { title: "nl.unsubDoneTitle", body: "nl.unsubDoneBody" },
  already: { title: "nl.unsubDoneTitle", body: "nl.unsubAlreadyBody" },
  rejected: { title: "nl.unsubDoneTitle", body: "nl.unsubSuppressedBody" },
  invalid: { title: "nl.invalidTitle", body: "nl.invalidBody" },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; status?: string }>;
}) {
  const params = await searchParams;
  const posted = params.status === "unsubscribed" || params.status === "invalid" ? COPY[params.status] : null;
  const view = !posted && params.t ? await inspectUnsubscribe(params.t) : null;
  const showButton = view?.state === "ready" && params.t;
  const fallback = view ? COPY[view.state] ?? COPY.invalid : COPY.invalid;

  return (
    <V3Shell>
      <main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(120px,16vh,200px)] pb-[var(--section-gap)]">
        <T k="nl.kicker" as="p" className="system" fade={false} />
        <T k={(posted ?? fallback).title} as="h1" className="page-title mt-4 max-w-[16ch]" />
        <T k={(posted ?? fallback).body} as="p" className="body mt-6 max-w-[58ch] text-[var(--ink-2)]" />
        {showButton ? (
          <form method="post" action={`/api/unsubscribe?t=${encodeURIComponent(params.t!)}&redirect=1`} className="mt-10">
            <button type="submit" className="action-primary">
              <T k="nl.unsubButton" as="span" fade={false} />
            </button>
          </form>
        ) : null}
      </main>
    </V3Shell>
  );
}
