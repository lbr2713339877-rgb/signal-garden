import Link from "next/link";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { DIFFICULTY_LABEL, DIFFICULTY_LABEL_EN, DIFFICULTY_STARS, STATUS_LABEL, STATUS_LABEL_EN } from "@/lib/categories";
import { firstSentence, Fallback } from "@/lib/i18n";
import { formatCount, formatRank } from "@/lib/utils";
import type { ProjectCard as Card } from "@/db/queries";

function Stars({ level, className = "" }: { level: number; className?: string }) {
  return (
    <span className={`num text-[length:var(--fs-xs)] tracking-tight ${className}`} aria-label={`难度 ${level} / 5`}>
      <span className="text-[var(--ink-3)]">{"★".repeat(level)}</span>
      <span className="text-[var(--ink-4)]">{"★".repeat(5 - level)}</span>
    </span>
  );
}

/**
 * The ranked card. Whatever else it shows, it must show the four different
 * kinds of judgement separately — heat is not quality.
 */
export function SignalCard({
  card,
  rank,
  showRank = false,
}: {
  card: Card;
  rank?: number;
  showRank?: boolean;
}) {
  const difficulty = card.difficulty ? DIFFICULTY_STARS[card.difficulty] ?? null : null;

  return (
    <GlassCard as="article" category={card.category} lift className="group relative p-6">
      <div className="flex items-start gap-4">
        {showRank && rank !== undefined ? (
          <span className="num mt-1 shrink-0 text-[length:var(--fs-sm)] text-[var(--ink-4)]">
            {formatRank(rank)}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <CategoryTag category={card.category} />
            {card.focusThemes.slice(0, 2).map((t) => (
              <span key={t} className="kicker">
                {t}
              </span>
            ))}
          </div>

          <h3 className="mt-4 text-[length:var(--fs-h3)] leading-[var(--lh-tight)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
            <Link href={`/p/${card.slug}`} className="hover:text-[var(--ink-1)]">
              {card.fullName ?? card.name}
            </Link>
          </h3>

          <p className="mt-2 text-[var(--ink-2)]">
            <Fallback zh={card.oneLiner} en={card.oneLinerEn ?? card.description} />
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--fs-xs)] text-[var(--ink-3)]">
            {card.stars > 0 ? (
              <span className="num">
                {formatCount(card.stars)} <span className="text-[var(--ink-4)]">stars</span>
              </span>
            ) : null}
            {card.skillCount > 0 ? (
              <span className="num">
                {card.skillCount} <span className="text-[var(--ink-4)]">skills</span>
              </span>
            ) : null}
            {difficulty !== null ? <Stars level={difficulty} /> : null}
            {card.status ? <span><Fallback zh={STATUS_LABEL[card.status] ?? card.status} en={STATUS_LABEL_EN[card.status] ?? card.status} marker={false} /></span> : null}
            <RiskBadge level={card.securityLevel} />
          </div>

          {difficulty !== null && card.difficulty ? (
            <p className="mt-2 text-[length:var(--fs-xs)] text-[var(--ink-4)]">
              <Fallback zh={DIFFICULTY_LABEL[card.difficulty]} en={DIFFICULTY_LABEL_EN[card.difficulty] ?? card.difficulty} marker={false} />
            </p>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}

/** Compact row used inside category and theme grids. */
export function ProjectTile({ card }: { card: Card }) {
  return (
    <GlassCard as="article" category={card.category} lift className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <CategoryTag category={card.category} />
        {card.stars > 0 ? (
          <span className="num text-[length:var(--fs-xs)] text-[var(--ink-3)]">{formatCount(card.stars)}</span>
        ) : null}
      </div>
      <h3 className="mt-4 truncate text-[length:var(--fs-body)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
        <Link href={`/p/${card.slug}`}>{card.name}</Link>
      </h3>
      <p className="mt-2 line-clamp-3 text-[length:var(--fs-sm)] text-[var(--ink-3)]">
        <Fallback zh={card.oneLiner} en={card.oneLinerEn ?? card.description} />
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 pt-1 text-[length:var(--fs-xs)] text-[var(--ink-4)]">
        {card.skillCount > 0 ? <span className="num">{card.skillCount} skills</span> : null}
        {card.difficulty ? <span><Fallback zh={DIFFICULTY_LABEL[card.difficulty]} en={DIFFICULTY_LABEL_EN[card.difficulty] ?? card.difficulty} marker={false} /></span> : null}
      </div>
    </GlassCard>
  );
}
