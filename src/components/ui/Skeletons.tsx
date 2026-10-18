/**
 * Skeletons (V2 §7.7).
 *
 * The brief's rule is that a skeleton must match the real layout pixel for
 * pixel, and that content should grow into it without a flash. That rules out
 * a generic grey block: if the skeleton is a different size than the thing it
 * replaces, the page jumps when data arrives.
 *
 * So each skeleton below reuses the same classes as its real counterpart —
 * same padding, same grid, same text sizes and line heights. The only
 * difference is that the text nodes are empty bars.
 *
 * The shimmer is a background position animation, not a width animation, so it
 * never triggers layout. Under reduced motion the bars stay static.
 */

import { GlassCard } from "@/components/ui/GlassCard";

function Bar({ w = "100%", h = "1em", className = "" }: { w?: string; h?: string; className?: string }) {
  return (
    <span
      className={`sk-bar block rounded-[var(--r-xs)] ${className}`}
      style={{ width: w, height: h }}
      aria-hidden
    />
  );
}

/** Matches HeadlineCard: same grid, same paddings, same text sizes. */
export function HeadlineSkeleton() {
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col justify-between p-7 md:p-9">
          <div>
            <div className="flex items-center gap-3">
              <Bar w="52px" h="10px" />
              <Bar w="86px" h="18px" />
            </div>
            <div className="mt-5 space-y-3">
              <Bar w="92%" h="clamp(1.5rem, 2.6vw, 2.25rem)" />
              <Bar w="64%" h="clamp(1.5rem, 2.6vw, 2.25rem)" />
            </div>
            <div className="mt-4 space-y-2">
              <Bar w="88%" h="1rem" />
              <Bar w="72%" h="1rem" />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-5">
            <Bar w="36px" h="36px" className="rounded-[var(--r-sm)]" />
            <Bar w="150px" h="0.875rem" />
            <Bar w="90px" h="0.875rem" />
          </div>
        </div>
        <div className="sk-block min-h-[220px] border-t border-[var(--hairline)] lg:border-l lg:border-t-0" />
      </div>
    </GlassCard>
  );
}

/** Matches FeatureCard. */
export function FeatureSkeleton() {
  return (
    <GlassCard className="flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <Bar w="36px" h="36px" className="rounded-[var(--r-sm)]" />
        <Bar w="96px" h="0.8125rem" />
      </div>
      <div className="mt-4 space-y-2">
        <Bar w="94%" h="1rem" />
        <Bar w="70%" h="1rem" />
      </div>
      <div className="mt-2 space-y-2">
        <Bar w="86%" h="0.875rem" />
        <Bar w="60%" h="0.875rem" />
      </div>
      <div className="mt-auto flex items-center gap-3 pt-4">
        <Bar w="70px" h="0.8125rem" />
        <Bar w="64px" h="18px" />
      </div>
    </GlassCard>
  );
}

/** Matches ProjectRow. */
export function RowSkeleton({ rank = false }: { rank?: boolean }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start gap-4">
        {rank ? <Bar w="20px" h="0.875rem" className="mt-1 shrink-0" /> : null}
        <Bar w="36px" h="36px" className="shrink-0 rounded-[var(--r-sm)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Bar w="140px" h="1rem" />
            <Bar w="70px" h="18px" />
          </div>
          <div className="mt-2 space-y-2">
            <Bar w="90%" h="1rem" />
            <Bar w="56%" h="1rem" />
          </div>
          <div className="mt-3 flex items-center gap-4">
            <Bar w="88px" h="0.8125rem" />
            <Bar w="76px" h="0.8125rem" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/** The headline plus the six-feature grid, as the homepage renders them. */
export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[var(--s-7)]">
      <HeadlineSkeleton />
      <div className="pt-[var(--s-7)]">
        <Bar w="180px" h="1.25rem" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <FeatureSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
