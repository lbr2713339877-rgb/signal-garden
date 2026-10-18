'use client';

/**
 * Scroll-driven float-in wrapper for one archive slice.
 *
 * Extracted into its own client component because the parent (TodaySignals) is
 * an async server component that reads the database — hooks cannot live there.
 *
 * The number and body begin a touch apart so a list of slices has rhythm
 * without ever delaying the reader.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

export function SignalSlice({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // Slice visible window ~0.25–0.8; stagger each card within it.
  const offset = 0.3 + Math.min(index * 0.02, 0.14);
  const opacity = useTransform(scrollYProgress, [offset, offset + 0.14], [0, 1]);
  const y = useTransform(scrollYProgress, [offset, offset + 0.14], [24, 0]);
  const blur = useTransform(scrollYProgress, [offset, offset + 0.14], [6, 0]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);

  const motionOn = mounted && !reduce;
  return (
    <motion.div
      ref={ref}
      style={motionOn ? { opacity, y, filter } : undefined}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  );
}
