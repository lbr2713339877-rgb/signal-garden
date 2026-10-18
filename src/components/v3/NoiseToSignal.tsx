'use client';

/**
 * V3 Section 04 — The Signal / The Noise
 *
 * The product's core idea is "filter signal out of noise", so this section is
 * driven by the reader's own scroll rather than by a timer. As the section
 * moves through the viewport the wall of noise dims, thins, collapses toward
 * the centre and finally resolves into the conclusion line.
 *
 * Why scroll-position instead of a CSS animation:
 *   - the effect is reversible for free — scrolling back up replays it backward
 *   - the reader controls the pace, which is what makes the metaphor land
 *   - no timers, no state updates per frame: every value is a MotionValue and
 *     React never re-renders while scrolling
 *
 * Safety: content is visible by default. If JS never runs, or the user prefers
 * reduced motion, the wall is dimmed and the conclusion is readable.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react';
import { T } from '@/lib/dict';

/** Words that stand in for the flood of "new thing" announcements. */
const WORDS = [
  'NEW TOOL', 'NEW MCP', 'NEW AGENT', 'NEW SKILL', 'NEW FRAMEWORK',
  'NEW WORKFLOW', 'NEW LAUNCH', 'NEW LIBRARY', 'NEW SDK', 'NEW API',
  'NEW PLUGIN', 'NEW RUNTIME',
] as const;

/**
 * Deterministic scatter. Fixed constants (not Math.random) so server and client
 * render identically and the layout never shifts between reloads.
 */
const POSITIONS: { x: number; y: number; r: number; scale: number }[] = Array.from(
  { length: 36 },
  (_, i) => {
    const angle = (i * 137.508) * (Math.PI / 180); // golden-angle spiral
    const radius = 12 + (i % 9) * 8;
    return {
      x: Math.round(Math.cos(angle) * radius * 8),
      y: Math.round(Math.sin(angle) * radius * 6),
      r: ((i * 37) % 13) - 6,
      scale: 0.7 + ((i * 17) % 7) / 12,
    };
  },
);

/** One noise word. Each has its own opacity ramp keyed on its index so the
 *  wall thins in batches instead of all at once. */
function NoiseWord({
  text,
  pos,
  index,
  total,
  progress,
}: {
  text: string;
  pos: (typeof POSITIONS)[number];
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Staggered extinction: items drop out progressively between 0.15 and 0.7.
  // Batch extinction spans progress 0.12 → 0.46, i.e. while the section is
  // still arriving, so the wall is already thinned by the time it is centred.
  const threshold = 0.12 + (index / total) * 0.34;
  const opacity = useTransform(
    progress,
    [threshold - 0.08, threshold],
    [0.9, 0.06],
  );
  const color = useTransform(
    progress,
    [threshold - 0.08, threshold],
    ['var(--ink-3)', 'var(--ink-4)'],
  );

  return (
    <motion.span
      className="nw system"
      aria-hidden
      style={{
        x: pos.x,
        y: pos.y,
        rotate: pos.r,
        scale: pos.scale,
        opacity,
        color,
        fontSize: 'clamp(0.8rem, 1.9vw, 1.25rem)',
        letterSpacing: '0.2em',
        willChange: 'transform, opacity',
      }}
    >
      {text}
    </motion.span>
  );
}

export function NoiseToSignal() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  /* Hydration guard. On the server (and before hydration) no inline motion
     styles are emitted, so the section renders in its fully readable state.
     Only after mount do the scroll-driven MotionValues take over. Without this
     a JS failure would leave the conclusion frozen at opacity 0. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Whole-wall treatments.
  /* Timing note: with a min-h-screen section and offset
     ['start end','end start'], progress 0.5 = the section exactly fills the
     viewport. The old ramps finished around 0.75–0.8, so a reader who scrolled
     the section into view saw an unresolved wall and had to keep scrolling
     before "We kept the signal." appeared. The whole sequence now resolves by
     ~0.55 so the payoff is on screen when the section is. */
  const wallOpacity = useTransform(scrollYProgress, [0.08, 0.2, 0.42, 0.55], [1, 1, 0.35, 0.08]);
  const wallScale = useTransform(scrollYProgress, [0.08, 0.55], [1, 0.72]);
  const wallBlur = useTransform(scrollYProgress, [0.38, 0.55], [0, 3]);
  const wallFilter = useTransform(wallBlur, (b) => `blur(${b}px)`);

  // The conclusion resolves late in the traversal.
  const lineOpacity = useTransform(scrollYProgress, [0.34, 0.5], [0, 1]);
  const lineBlur = useTransform(scrollYProgress, [0.34, 0.5], [8, 0]);
  const lineFilter = useTransform(lineBlur, (b) => `blur(${b}px)`);

  /* Reduced motion: skip every scroll link and show the resolved state. */
  if (reduce) {
    return (
      <section
        ref={sectionRef}
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-[var(--gutter)]"
      >
        <div aria-hidden className="noise-wall absolute inset-0" style={{ opacity: 0.08 }}>
          {POSITIONS.slice(0, 8).map((pos, i) => (
            <span
              key={i}
              className="nw system"
              style={{
                transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
                color: 'var(--ink-4)',
                fontSize: '1rem',
                letterSpacing: '0.2em',
              }}
            >
              {WORDS[i % WORDS.length]}
            </span>
          ))}
        </div>
        <div className="conclusion relative z-10 text-center">
          <h2 className="display-l">We kept the signal.</h2>
          <T k="nz.sub" as="p" className="editorial mt-6 text-[var(--ink-2)]" />
        </div>
        <div className="absolute bottom-12 left-[var(--gutter)]">
          <span className="system">02 / SIGNAL</span>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-[var(--gutter)]"
    >
      <style>{`
        .nw {
          position: absolute;
          top: 50%;
          left: 50%;
          white-space: nowrap;
          translate: -50% -50%;
          will-change: transform, opacity;
        }
        .noise-wall {
          will-change: transform, opacity, filter;
        }
        .conclusion {
          will-change: transform, opacity, filter;
        }
      `}</style>

      {/* The noise wall: fixed scatter, individually faded by scroll progress. */}
      <motion.div
        aria-hidden
        className="noise-wall absolute inset-0"
        style={mounted ? { opacity: wallOpacity, scale: wallScale, filter: wallFilter } : undefined}
      >
        {POSITIONS.map((pos, i) => (
          <NoiseWord
            key={i}
            text={WORDS[i % WORDS.length]}
            pos={pos}
            index={i}
            total={POSITIONS.length}
            progress={scrollYProgress}
          />
        ))}
      </motion.div>

      <motion.div
        className="conclusion relative z-10 text-center"
        style={mounted ? { opacity: lineOpacity, filter: lineFilter } : undefined}
      >
        <h2 className="display-l">We kept the signal.</h2>
        <T k="nz.sub" as="p" className="editorial mt-6 text-[var(--ink-2)]" />
      </motion.div>

      <div className="absolute bottom-12 left-[var(--gutter)]">
        <span className="system">02 / SIGNAL</span>
      </div>
    </section>
  );
}
