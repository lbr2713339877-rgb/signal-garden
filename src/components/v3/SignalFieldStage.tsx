'use client';

/**
 * V3 Section 02 — the signal field stage.
 *
 * The text beats are driven by scroll position rather than an
 * IntersectionObserver latch, so the two lines reveal as the reader moves
 * through the section and reverse cleanly when they scroll back. The 3D scene
 * keeps its own internal scroll progress (Three.js owns that loop) — motion is
 * only used for the DOM text, never for the WebGL frame.
 *
 * Content is visible by default: motion styles are applied only after mount, so
 * a JS failure or reduced-motion setting still shows the section.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { SignalField3D } from './SignalField3D';
import { T } from '@/lib/dict';

export function SignalFieldStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Two beats: the "detected" label arrives first, the headline follows.
  // Visible window for a min-h-screen section is ~0.25–0.8 of total progress.
  const beatOpacity = useTransform(scrollYProgress, [0.26, 0.4], [0, 1]);
  const beatY = useTransform(scrollYProgress, [0.26, 0.4], [10, 0]);
  const headOpacity = useTransform(scrollYProgress, [0.36, 0.52], [0, 1]);
  const headY = useTransform(scrollYProgress, [0.36, 0.52], [16, 0]);

  const motionOn = mounted && !reduce;

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-center px-[var(--gutter)] py-[var(--section-gap)]"
    >
      <style>{`
        .sf-beat, .sf-headline { will-change: transform, opacity; }
      `}</style>

      {/* 3D 信号场：14 个对象（移动端 8），4 个高亮聚拢，扫描波周期扫过。
          它自带滚动进度，不要用 motion 接管它的渲染循环。 */}
      <SignalField3D accent="var(--light-cyan)" />

      {/* 可读性遮罩 —— 场景铺满整屏，左侧文字区必须被压下去。 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'linear-gradient(90deg, rgba(3,3,3,0.94) 0%, rgba(3,3,3,0.82) 32%, rgba(3,3,3,0.32) 55%, rgba(3,3,3,0) 78%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[var(--container)] flex-col gap-10 lg:flex-row lg:items-center">
        <div className="lg:w-5/12">
          <motion.p
            className="sf-beat system"
            style={motionOn ? { opacity: beatOpacity, y: beatY } : undefined}
          >
            <T k="sf.kicker" as="span" fade={false} />
            <span className="mx-3 text-[var(--ink-4)]">·</span>
            <span style={{ color: 'var(--light-cyan)' }}>
              <T k="sf.detected" as="span" fade={false} />
            </span>
          </motion.p>

          <motion.div
            className="sf-headline"
            style={motionOn ? { opacity: headOpacity, y: headY } : undefined}
          >
            <T k="sf.title" as="h2" className="display-l mt-6 max-w-[18ch]" />
            <T k="sf.body" as="p" className="body mt-6 max-w-[46ch] text-[var(--ink-2)]" />
            <T k="sf.meta" as="p" className="data mt-6 text-[var(--ink-4)]" />
          </motion.div>
        </div>

        <div className="hidden lg:block lg:w-7/12" />
      </div>
    </section>
  );
}
