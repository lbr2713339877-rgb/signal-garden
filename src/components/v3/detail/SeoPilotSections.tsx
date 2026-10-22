import Link from "next/link";
import { LANG } from "@/lib/i18n";
import { SEO_PILOT_COPY, SPARK_HEIGHT, SPARK_WIDTH, type SeoPilotView } from "@/lib/seo-pilot";

function MomentumSparkline({ points }: { points: { x: number; y: number }[] }) {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  return (
    <svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      aria-hidden="true"
      className="mt-6 text-[var(--ink-2)]"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
      <circle cx={last.x} cy={last.y} r="2" fill="currentColor" />
    </svg>
  );
}

/** Server-rendered pilot sections. Omitted blocks are not mounted. */
export function SeoPilotSections({ view }: { view: SeoPilotView }) {
  if (!view.momentum && !view.peers && !view.audience) return null;
  return (
    <div data-seo-pilot="">
      {view.momentum ? (
        <section id="seo-momentum" data-seo-section="momentum" className="px-[var(--gutter)] py-10">
          <div className="mx-auto max-w-[var(--container)]">
            <p className="system">
              <LANG zh={SEO_PILOT_COPY.momentumKicker.zh} en={SEO_PILOT_COPY.momentumKicker.en} />
            </p>
            <h2 className="display-l mt-4">
              <LANG zh={SEO_PILOT_COPY.momentumTitle.zh} en={SEO_PILOT_COPY.momentumTitle.en} />
            </h2>
            <LANG as="p" zh={view.momentum.summaryZh} en={view.momentum.summaryEn} className="body mt-6 max-w-[62ch] text-[var(--ink-2)]" />
            <MomentumSparkline points={view.momentum.sparkline} />
            <LANG as="p" zh={view.momentum.captionZh} en={view.momentum.captionEn} className="data mt-2 text-[var(--ink-4)]" />
            {view.momentum.noteZh && view.momentum.noteEn ? (
              <LANG as="p" zh={view.momentum.noteZh} en={view.momentum.noteEn} className="data mt-3 text-[var(--ink-4)]" />
            ) : null}
            <ul className="mt-6 max-w-[720px]">
              {view.momentum.rows.map((row) => (
                <li key={row.date} className="border-t border-[var(--glass-1-border)] py-3">
                  <LANG zh={row.lineZh} en={row.lineEn} className="data text-[var(--ink-2)]" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {view.peers ? (
        <section id="seo-peers" data-seo-section="peers" className="px-[var(--gutter)] py-10">
          <div className="mx-auto max-w-[var(--container)]">
            <p className="system">
              <LANG zh={SEO_PILOT_COPY.peerKicker.zh} en={SEO_PILOT_COPY.peerKicker.en} />
            </p>
            <h2 className="display-l mt-4">
              <LANG zh={SEO_PILOT_COPY.peerTitle.zh} en={SEO_PILOT_COPY.peerTitle.en} />
            </h2>
            <LANG as="p" zh={view.peers.introZh} en={view.peers.introEn} className="body mt-6 max-w-[62ch] text-[var(--ink-2)]" />
            <ul className="mt-6 max-w-[720px]">
              {view.peers.peers.map((peer) => (
                <li key={peer.slug} className="border-t border-[var(--glass-1-border)] py-4">
                  <Link
                    href={peer.href}
                    className="body text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-3)]"
                  >
                    {peer.name}
                  </Link>
                  <LANG as="p" zh={peer.detailZh} en={peer.detailEn} className="data mt-2 text-[var(--ink-4)]" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {view.audience ? (
        <section id="seo-audience" data-seo-section="audience" className="px-[var(--gutter)] py-10">
          <div className="mx-auto max-w-[var(--container)]">
            <p className="system">
              <LANG zh={SEO_PILOT_COPY.audienceKicker.zh} en={SEO_PILOT_COPY.audienceKicker.en} />
            </p>
            <h2 className="display-l mt-4">
              <LANG zh={SEO_PILOT_COPY.audienceTitle.zh} en={SEO_PILOT_COPY.audienceTitle.en} />
            </h2>
            <LANG as="p" zh={view.audience.zh} en={view.audience.en} className="body mt-6 max-w-[62ch] text-[var(--ink-2)]" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
