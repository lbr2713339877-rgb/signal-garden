"use client";

/**
 * V2 card hierarchy (brief §3).
 *
 * Fixed element order, identical on every card so the eye learns it in one
 * glance:  icon -> name -> hook (largest) -> one-line description ->
 * heat badge + source platform.
 *
 * The hook is deliberately the largest text on the card. In v1 the project
 * name was largest, which made a list of names rather than a list of reasons
 * to click. The name is still present and still a link, just not the thing
 * competing for attention.
 *
 * Motion is applied with the house curve from tokens.css (--e-v2), which has a
 * slight overshoot: cards lift rather than stopping dead. Everything degrades
 * under prefers-reduced-motion, where the lift is dropped but the colour
 * feedback survives.
 */

import Link from "next/link";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { HeatNumber } from "@/components/ui/HeatNumber";
import { firstSentence, Fallback, LANG } from "@/lib/i18n";

/**
 * Vendor (GitHub) descriptions are used verbatim as an English fallback.
 * A repository whose own description is Chinese would otherwise leak Chinese
 * into the English slot, which the site's bilingual contract forbids.
 */
const HAN = /[\u4e00-\u9fff]/;
function enOrNull(s?: string | null): string | null {
  if (!s) return null;
  return HAN.test(s) ? null : s;
}
import { taxonomy, secondaryLabel } from "@/normalizers/taxonomy";
import { DIFFICULTY_LABEL, DIFFICULTY_LABEL_EN } from "@/lib/categories";
import { cn, formatCount } from "@/lib/utils";
import type { ProjectCard as Card } from "@/db/queries";

/** The real growth figure, honest about which measurement it came from. */
function GrowthBadge({ card }: { card: Card }) {
  if (card.stars24h !== null && card.stars24h > 0) {
    return (
      <span className="num text-[var(--risk-safe)]">
        +{formatCount(card.stars24h)} <span className="text-[var(--ink-4)]">stars / 24h</span>
      </span>
    );
  }
  if (card.forks7d !== null && card.forks7d > 0) {
    return (
      <span className="num text-[var(--ink-2)]">
        +{formatCount(card.forks7d)} <span className="text-[var(--ink-4)]">forks / 7d</span>
      </span>
    );
  }
  return <span className="num text-[var(--ink-4)]">{formatCount(card.stars)} stars</span>;
}

/** Which condition admitted the project — the brief's gate is visible, not hidden. */
function GateReason({ card }: { card: Card }) {
  const reason =
    card.stars24h !== null && card.stars24h >= 50
      ? { zh: `24 小时 +${card.stars24h} stars`, en: `+${card.stars24h} stars in 24h` }
      : card.forks7d !== null && card.forks7d >= 15
        ? { zh: `7 天 +${card.forks7d} forks`, en: `+${card.forks7d} forks in 7d` }
        : card.stars >= 500
          ? { zh: `${formatCount(card.stars)} stars`, en: `${formatCount(card.stars)} stars` }
          : null;
  if (!reason) return null;
  return (
    <span className="kicker">
      <LANG zh={reason.zh} en={reason.en} />
    </span>
  );
}

function Icon({ card }: { card: Card }) {
  const meta = taxonomy(card.primaryCategory);
  const initial = (card.name ?? "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 1).toUpperCase() || "?";
  return (
    <span
      data-category={card.category ?? undefined}
      aria-hidden
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-sm)] border text-[length:var(--fs-sm)]"
      style={{
        borderColor: meta ? "rgba(var(--cat-rgb), 0.3)" : "var(--hairline)",
        color: meta ? "var(--cat)" : "var(--ink-3)",
        background: meta ? "rgba(var(--cat-rgb), 0.06)" : "transparent",
      }}
    >
      {initial}
    </span>
  );
}

/**
 * The headline card. Full width, carries the project image, and holds more than
 * half the first screen's visual weight (§3).
 */
export function HeadlineCard({ card }: { card: Card }) {
  const meta = taxonomy(card.primaryCategory);
  return (
    <GlassCard as="article" category={card.category} lift className="group overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col justify-between p-7 md:p-9">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="kicker">
                <LANG zh="今日头条" en="Today's headline" />
              </span>
              {meta ? <CategoryTag category={card.category} /> : null}
              {card.isRising ? (
                <span className="kicker text-[var(--risk-safe)]">
                  <LANG zh="🔥 飙升上榜" en="🔥 Rising" />
                </span>
              ) : null}
            </div>

            {/* Hook is the largest element on the card. */}
            <h2 className="mt-5 text-[length:var(--fs-h2)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
              {card.hook ? (
                <Fallback zh={card.hook} en={card.hookEn} />
              ) : (
                // No hook yet: the vendor's own description is the fallback, and
                // it gets the marker because it is not our copy.
                <Fallback zh={null} en={card.oneLinerEn ?? enOrNull(card.description)} />
              )}
            </h2>

            {card.hook && (card.oneLiner || card.oneLinerEn) ? (
              <p className="mt-4 max-w-[54ch] text-[var(--ink-2)]">
                <Fallback zh={card.oneLiner} en={card.oneLinerEn} />
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--fs-xs)] text-[var(--ink-3)]">
            <Icon card={card} />
            <Link
              href={`/p/${card.slug}`}
              className="num text-[var(--ink-2)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
            >
              {card.fullName ?? card.name}
            </Link>
            <GrowthBadge card={card} />
            <GateReason card={card} />
            <RiskBadge level={card.securityLevel} />
          </div>

          <div className="mt-6">
            <Link
              href={`/p/${card.slug}`}
              className="inline-flex items-center gap-2 rounded-[var(--r-sm)] border border-[var(--hairline-strong)] px-4 py-2 text-[length:var(--fs-sm)] text-[var(--ink-1)] transition-colors duration-[var(--d-fast)] hover:bg-[var(--glass-2)]"
            >
              <LANG zh="查看详情" en="View details" />
            </Link>
          </div>
        </div>

        {/* GitHub's own card image: generated by GitHub, so nothing is scraped. */}
        {card.previewImageUrl ? (
          <div className="relative min-h-[220px] overflow-hidden border-t border-[var(--hairline)] lg:border-l lg:border-t-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.previewImageUrl}
              alt=""
              loading="eager"
              className="h-full w-full object-cover opacity-90 transition-transform duration-[var(--d-base)] ease-[var(--e-v2)] group-hover:scale-[1.02]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-transparent to-transparent" />
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}

/** The six feature cards. Smaller, same element order, hook still the largest text. */
export function FeatureCard({ card, index = 0 }: { card: Card; index?: number }) {
  return (
    <GlassCard
      as="article"
      category={card.category}
      lift
      className={cn("group flex h-full flex-col p-5", "v2-enter")}
      style={{ animationDelay: `${index * 80}ms` } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <Icon card={card} />
        <Link
          href={`/p/${card.slug}`}
          className="num min-w-0 truncate text-[length:var(--fs-xs)] text-[var(--ink-3)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
        >
          {card.name}
        </Link>
        {card.isRising ? <span className="kicker ml-auto text-[var(--risk-safe)]">🔥</span> : null}
      </div>

      {/* Hook, largest text on the card. */}
      <h3 className="mt-4 text-[length:var(--fs-body)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)] transition-colors duration-[var(--d-fast)] group-hover:text-[var(--ink-1)]">
        <Link href={`/p/${card.slug}`} className="v2-hook-link">
          {card.hook ? (
            <Fallback zh={card.hook} en={card.hookEn} />
          ) : (
            <Fallback zh={null} en={card.oneLinerEn ?? enOrNull(card.description)} />
          )}
        </Link>
      </h3>

      {card.hook && (card.oneLiner || card.oneLinerEn) ? (
        <p className="mt-2 line-clamp-2 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
          <Fallback zh={card.oneLiner} en={card.oneLinerEn} />
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-[length:var(--fs-xs)]">
        <GrowthBadge card={card} />
        <CategoryTag category={card.category} />
      </div>
    </GlassCard>
  );
}

/** Compact row for category and archive listings. */
export function ProjectRow({ card, rank }: { card: Card; rank?: number }) {
  const sub = secondaryLabel(card.primaryCategory ?? "", card.secondaryCategory);
  return (
    <GlassCard as="article" category={card.category} lift className="group p-5">
      <div className="flex items-start gap-4">
        {rank !== undefined ? (
          <span className="num mt-1 shrink-0 text-[length:var(--fs-sm)] text-[var(--ink-4)]">
            {String(rank).padStart(2, "0")}
          </span>
        ) : null}
        <Icon card={card} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={`/p/${card.slug}`}
              className="text-[length:var(--fs-body)] tracking-[var(--ls-title)] text-[var(--ink-1)]"
            >
              {card.name}
            </Link>
            {sub ? <span className="kicker">{sub}</span> : null}
            {card.isRising ? (
              <span className="kicker text-[var(--risk-safe)]">
                <LANG zh="🔥 飙升上榜" en="🔥 Rising" />
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-[var(--ink-2)]">
            {card.hook || card.hookEn ? (
              <Fallback zh={card.hook} en={card.hookEn} />
            ) : (
              <Fallback zh={card.oneLiner} en={card.oneLinerEn ?? enOrNull(card.description)} />
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[length:var(--fs-xs)] text-[var(--ink-3)]">
            <GrowthBadge card={card} />
            {card.difficulty ? <span><Fallback zh={DIFFICULTY_LABEL[card.difficulty]} en={DIFFICULTY_LABEL_EN[card.difficulty] ?? card.difficulty} marker={false} /></span> : null}
            <RiskBadge level={card.securityLevel} />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/** Trending numbers use the count-up, so the figure registers as movement. */
export function StatNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  return <HeatNumber value={value} decimals={decimals} />;
}
