import { LANG, UI } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * Pattern block (V2 §6) — "谁在用 / 适用场景".
 *
 * The brief asks for this to be the detail page's second visual focus, and is
 * equally clear about what it must not contain: real companies, real job
 * titles, or anything shaped like a user testimonial. The reference design
 * shows named people with titles and quotes; that is the visual treatment to
 * borrow, not the content model it was built from.
 *
 * So: abstract identities from a closed vocabulary, each with an illustrative
 * scenario, and a label on the block saying what it is. A person reading it
 * should never mistake a scenario for a customer quote.
 *
 * Visually it is a horizontal rail of offset cards rather than a grid — the
 * offset and slight rotation are what make it read as a distinct section
 * rather than more of the same list.
 */

export interface Persona {
  persona: string;
  scenario: string;
}

/** Deterministic offset so a given card sits at the same angle every render. */
const TILT = ["-rotate-[0.5deg]", "rotate-[0.4deg]", "rotate-0", "-rotate-[0.3deg]"];

export function PatternBlock({ personas }: { personas: Persona[] }) {
  if (!personas.length) return null;

  return (
    <section className="mt-[var(--s-10)]">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="kicker">
          <LANG zh="谁在用" en="Who uses it" />
        </p>
        {/* Labelled honestly: these are example scenarios, not customer voices. */}
        <p className="text-[length:var(--fs-xs)] text-[var(--ink-4)]">
          <LANG zh={UI.sampleNote.zh} en={UI.sampleNote.en} />
        </p>
      </div>

      <h2 className="mt-3 text-[length:var(--fs-h2)] tracking-[var(--ls-title)] text-[var(--ink-1)]">
        <LANG zh="它适合谁、用在什么场景" en="Who it fits, and where it fits" />
      </h2>

      {/* Horizontal rail: offset cards, scrolls on narrow screens. */}
      <div className="-mx-[var(--gutter)] mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
        {personas.map((p, i) => (
          <GlassCard
            key={`${p.persona}-${i}`}
            as="article"
            lift
            radius="lg"
            className={`min-w-[280px] shrink-0 snap-start p-6 md:min-w-0 ${TILT[i % TILT.length]} v2-enter`}
            style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}
          >
            {/* Abstract avatar: a generated geometric mark, never a photo of a
                person, because these are not people. */}
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-[var(--r-pill)] border border-[var(--hairline)]"
            >
              <span
                className="h-3.5 w-3.5 rounded-[var(--r-sm)]"
                style={{
                  background: `linear-gradient(135deg, var(--cat, var(--ink-3)), transparent)`,
                  transform: `rotate(${i * 45}deg)`,
                }}
              />
            </span>

            <p className="mt-4 text-[length:var(--fs-body)] text-[var(--ink-1)]">{p.persona}</p>
            <p className="mt-2 text-[length:var(--fs-sm)] leading-[var(--lh-body)] text-[var(--ink-3)]">
              {p.scenario}
            </p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
