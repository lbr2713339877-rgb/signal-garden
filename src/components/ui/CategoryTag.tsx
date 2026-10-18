import { categoryMeta } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * Category chip. Colour appears as text and a 1px edge only — never a fill.
 * This is the rule that keeps the product from turning into a dashboard.
 */
export function CategoryTag({
  category,
  className,
  showName = false,
}: {
  category: string | null | undefined;
  className?: string;
  /** Show the Chinese name instead of the Latin label. */
  showName?: boolean;
}) {
  const meta = categoryMeta(category);
  if (!meta) return null;

  const text = showName ? meta.name : meta.label;

  return (
    <span
      data-category={meta.key}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border",
        "px-2.5 py-0.5 text-[length:var(--fs-tag)] tracking-[var(--ls-tag)] uppercase",
        "border-[rgba(var(--cat-rgb),0.28)] text-[var(--cat)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-[var(--r-pill)] bg-[var(--cat)]"
      />
      {text}
    </span>
  );
}
