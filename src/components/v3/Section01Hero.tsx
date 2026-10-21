/**
 * V3 Section 01 — 黑场与呼吸
 *
 * 标题是首页的 LCP 元素，必须在首帧就可见：不能从 opacity: 0、transparent
 * 或屏外开始，也不能等 JS 水合。保留的入场只做 translateY，不改透明度。
 * prefers-reduced-motion 时这段位移也关掉。
 *
 * 光带和系统信息层仍是装饰性的 CSS 动画，不承担 LCP。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { T } from '@/lib/dict';

const LINE_1 = 'Something new';
const LINE_2 = 'is taking shape.';

export function Section01Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Parallax only, and only after mount, so the first paint is not a
     scroll-linked opacity or blur. The headline itself stays opaque. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);
  const blur = useTransform(scrollYProgress, [0, 1], [0, 4]);
  const filter = useTransform(blur, (b) => `blur(${b}px)`);
  const motionOn = mounted && !reduce;

  return (
    /* overflow-hidden 是必须的：display-xl 在 13vw 下极高，加上每字一个
       inline-block span，标题会溢出 section 边界，在下一屏顶部留下被截断的
       字（用户截图里的"残留大字"）。这里裁掉溢出。 */
    <section ref={sectionRef} className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-[var(--gutter)]">
      <style>{`
        /* ── 2. 光带扫过 ─────────────────────────────────────────────── */
        .hero-sweep {
          opacity: 0;
          animation: hero-sweep 1.2s var(--e-v3) 0.3s forwards;
        }
        @keyframes hero-sweep {
          0%   { opacity: 0; transform: translateX(-30vw) scaleX(0.4); }
          45%  { opacity: 0.9; }
          100% { opacity: 0; transform: translateX(130vw) scaleX(1); }
        }

        /* ── 标题：首帧即可见，只做位移 ─────────────────────────────── */
        .hero-headline {
          color: var(--ink-1);
          animation: hero-headline-in 0.7s var(--e-v3) both;
        }
        @keyframes hero-headline-in {
          from { transform: translateY(12px); }
          to   { transform: translateY(0); }
        }

        /* ── 5. 系统信息层 ──────────────────────────────────────────── */
        .hero-system {
          opacity: 0;
          transform: translateY(12px);
          animation: hero-rise 0.4s var(--e-v3) 1.9s forwards;
        }
        @keyframes hero-rise {
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── 6. 第一个信号对象 ──────────────────────────────────────── */
        /* 已删除：那个被裁切的玻璃多边形（.hero-first）就是用户说的
           "左上角的半透明几何碎块"。它是纯装饰，且会随着滚动留在视口里，
           现在这一屏的主体视觉交给 Section 02 的 3D 信号场。 */

        /* 滚动提示的呼吸 */
        .hero-scroll-pulse {
          animation: hero-pulse 2.6s ease-in-out 3s infinite;
        }
        @keyframes hero-pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.9; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-sweep { display: none; }
          .hero-headline {
            animation: none;
            color: var(--ink-1);
            transform: none;
          }
          .hero-system,
          .hero-first {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .hero-first { opacity: 0.6; }
          .hero-scroll-pulse { animation: none; opacity: 0.6; }
        }
      `}</style>

      {/* 光带 */}
      <div
        aria-hidden
        className="hero-sweep pointer-events-none absolute top-1/2 left-0 h-px w-[42vw] origin-left"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--light-cyan), transparent)',
          filter: 'blur(1.5px)',
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-[var(--container)] text-center"
        style={motionOn ? { y, opacity, filter } : undefined}
      >
        <T k="hero.system" as="p" className="system hero-system fade-in" fade={false} />

        <h1 className="display-xl hero-headline mt-10">
          <span className="block">{LINE_1}</span>
          <span className="block">{LINE_2}</span>
        </h1>

        <T
          k="hero.sub"
          as="p"
          className="editorial hero-system mt-8 text-[var(--ink-2)]"
        />
      </motion.div>

      {/* 系统信息层 */}
      <div className="hero-system absolute bottom-12 left-[var(--gutter)] flex items-center gap-8">
        <a href="#signals" className="system"><T k="home.seeSelection" as="span" fade={false} /> ↓</a>
        <a href="#tasks" className="data text-[var(--ink-2)]"><T k="home.findTool" as="span" fade={false} /> ↗</a>
      </div>
    </section>
  );
}
