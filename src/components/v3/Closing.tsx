'use client';

/**
 * V3 Section 07 — brand close.
 *
 * The page begins in black and ends in black. The only idea here is that the
 * scattered points gather back into the logo ring — driven by scroll progress
 * so it reads as the page "collecting itself" rather than a one-shot fade.
 *
 * Content is visible by default: motion styles apply only after mount, so a JS
 * failure or reduced-motion setting still shows the ring and the line.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react';
import { RingMark } from '@/components/brand/BrandLogo';
import { T } from '@/lib/dict';

/** Deterministic scatter for the gathering points. */
const DOTS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i * 137.508) * (Math.PI / 180);
  const radius = 60 + (i % 5) * 28;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
    d: (i % 5) * 0.04,
  };
});

function GatherDot({
  dot,
  index,
  progress,
}: {
  dot: (typeof DOTS)[number];
  index: number;
  progress: MotionValue<number>;
}) {
  // Each dot starts its travel slightly later than the last.
  const start = 0.2 + dot.d;
  const end = start + 0.4;
  const x = useTransform(progress, [start, end], [dot.x, 0]);
  const y = useTransform(progress, [start, end], [dot.y, 0]);
  const opacity = useTransform(progress, [start, end, 0.95], [0.5, 0.9, 0]);

  return (
    <motion.span
      aria-hidden
      className="absolute top-1/2 left-1/2 h-[4px] w-[4px] rounded-full"
      style={{
        x,
        y,
        opacity,
        translateX: '-50%',
        translateY: '-50%',
        background: 'var(--ink-1)',
      }}
    />
  );
}

export function Closing() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* This is the last section before the footer, so the page runs out of scroll
     well before 'end start' would complete. 'start end' → 'end center' finishes
     while the section is still comfortably on screen, and — unlike 'end end' —
     it does not overshoot past 1 and fade the line back out at the very bottom. */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end center'],
  });

  const ringScale = useTransform(scrollYProgress, [0.45, 0.85], [0.9, 1]);
  const ringOpacity = useTransform(scrollYProgress, [0.4, 0.75], [0, 1]);
  const lineOpacity = useTransform(scrollYProgress, [0.65, 0.9], [0, 1]);
  const lineY = useTransform(scrollYProgress, [0.65, 0.9], [12, 0]);

  const motionOn = mounted && !reduce;

  return (
    <section
      ref={ref}
      className="relative flex min-h-[70vh] flex-col items-center justify-center px-[var(--gutter)]"
    >
      <style>{`
        .close-ring, .close-line { will-change: transform, opacity; }
      `}</style>

      {/* Gathering points (scroll-driven). Hidden under reduced motion. */}
      {!reduce ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {DOTS.map((d, i) => (
            <GatherDot key={i} dot={d} index={i} progress={scrollYProgress} />
          ))}
        </div>
      ) : null}

      <motion.div
        className="close-ring"
        style={motionOn ? { scale: ringScale, opacity: ringOpacity } : undefined}
      >
        <RingMark color="#F2F0EA" size={56} />
      </motion.div>

      <motion.div
        className="close-line mt-10 text-center"
        style={motionOn ? { opacity: lineOpacity, y: lineY } : undefined}
      >
        <p className="system">08 / 08</p>
        <T k="cl.title" as="h2" className="editorial mt-5 max-w-[22ch] text-[var(--ink-1)]" />
      </motion.div>
    </section>
  );
}
