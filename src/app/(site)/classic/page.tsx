import Link from "next/link";
import { PageShell, Ambient } from "@/components/ui/Chrome";
import { HeadlineCard, FeatureCard, ProjectRow } from "@/components/ui/SignalCardV2";
import { GlassCard } from "@/components/ui/GlassCard";
import { LANG, UI } from "@/lib/i18n";
import { getFeatures, getHeadline, getRising, getTaxonomyCounts } from "@/db/queries";
import { TAXONOMY } from "@/normalizers/taxonomy";
import { formatRank } from "@/lib/utils";

/**
 * V2 homepage.
 *
 * The brief's structural demand (§3) is a hierarchy, not a grid: one headline
 * carrying over half the first screen's weight, six feature cards beneath it,
 * and everything else behind a link. A flat list of equal cards is explicitly
 * ruled out, so the layout enforces the asymmetry rather than leaving it to
 * the content.
 *
 * The three acceptance criteria this page answers directly:
 *   1. "understand in 3 seconds what today's single best thing is" — the
 *      headline sits above the fold with its hook as the largest text.
 *   2. "no item without a hook" — getHeadline only returns projects with one.
 *   4. "unqualified projects appear nowhere" — every query goes through gated().
 */
export const revalidate = 0;

export default async function HomePage() {
  const [headline, features, rising, counts] = await Promise.all([
    getHeadline(),
    getFeatures(6), // classic strip, not the daily edition. See src/lib/edition.ts.
    getRising(3),
    getTaxonomyCounts(),
  ]);

  const countOf = (k: string) => counts.find((c) => c.k === k)?.n ?? 0;

  // The headline is excluded from the feature row so no project appears twice.
  const featureCards = headline ? features.filter((f) => f.id !== headline.id).slice(0, 6) : features.slice(0, 6);

  return (
    <PageShell ambient="var(--c-skill)">
      {/* --- Headline ------------------------------------------------------ */}
      <section className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[var(--s-7)]">
        <div className="v2-enter">
          {headline ? (
            <HeadlineCard card={headline} />
          ) : (
            <GlassCard className="p-10">
              <p className="text-[var(--ink-3)]">
                <LANG
                  zh="今日还没有具备 hook 的内容。采集与摘要任务生成后这里会出现头条。"
                  en="No item with a hook yet. The headline appears once the pipeline has run."
                />
              </p>
            </GlassCard>
          )}
        </div>
      </section>

      {/* --- Six features -------------------------------------------------- */}
      <section className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[var(--s-7)]">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[length:var(--fs-h3)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
            <LANG zh="今天另外值得看的" en="Also worth your time today" />
          </h2>
          <Link
            href="/today"
            className="shrink-0 text-[length:var(--fs-sm)] text-[var(--ink-3)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
          >
            <LANG zh={UI.viewAll.zh} en={UI.viewAll.en} />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((c, i) => (
            <FeatureCard key={c.id} card={c} index={i} />
          ))}
        </div>
      </section>

      {/* --- Rising (V2 §2 回溯机制) --------------------------------------- */}
      {rising.length ? (
        <section className="v2-section mx-auto max-w-[var(--container)] px-[var(--gutter)]">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[length:var(--fs-h3)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
              <LANG zh="🔥 飙升上榜" en="🔥 Rising" />
            </h2>
            <p className="text-[length:var(--fs-sm)] text-[var(--ink-3)]">
              <LANG
                zh="我们追踪了一段时间，热度刚刚达标"
                en="Tracked for a while; momentum only just qualified"
              />
            </p>
          </div>
          <div className="mt-6 space-y-3">
            {rising.map((c) => (
              <ProjectRow key={c.id} card={c} />
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Taxonomy ------------------------------------------------------ */}
      <section className="v2-section mx-auto max-w-[var(--container)] px-[var(--gutter)]">
        <h2 className="text-[length:var(--fs-h2)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
          <LANG zh="按分类浏览" en="Browse by category" />
        </h2>
        <p className="mt-3 max-w-[56ch] text-[length:var(--fs-sm)] text-[var(--ink-3)]">
          <LANG
            zh="只有通过编辑门槛的内容才会出现在这里。"
            en="Only projects that clear the editorial floor appear here."
          />
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TAXONOMY.map((t) => (
            <GlassCard key={t.key} as="article" lift category={undefined} className="p-6">
              <Link href={`/c/${t.key}`} className="block">
                <p className="kicker">{t.en.toUpperCase()}</p>
                <h3 className="mt-3 text-[length:var(--fs-h3)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
                  <LANG zh={t.label} en={t.en} />
                </h3>
                <p className="mt-2 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
                  <LANG zh={t.tagline} en={t.en} />
                </p>
                <p className="num mt-4 text-[length:var(--fs-sm)] text-[var(--ink-4)]">
                  {countOf(t.key)} <LANG zh="个项目" en="projects" />
                </p>
              </Link>
            </GlassCard>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)] py-10">
        <div className="mx-auto flex max-w-[var(--container)] flex-wrap items-center gap-x-6 gap-y-2 px-[var(--gutter)] text-[length:var(--fs-xs)] text-[var(--ink-4)]">
          <span className="wordmark text-[var(--ink-3)]">Signal Garden</span>
          <span>
            <LANG zh="所有内容来自自动采集，不由用户提交" en="Everything here is collected automatically, never submitted" />
          </span>
          <Link href="/status" className="ml-auto hover:text-[var(--ink-2)]">
            <LANG zh="系统状态" en="Status" />
          </Link>
        </div>
      </footer>
    </PageShell>
  );
}
