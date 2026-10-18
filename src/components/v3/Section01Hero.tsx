/**
 * V3 Section 01 — 黑场与呼吸
 *
 * 加载编排（2.4s，6 层，全部纯 CSS，见 01-art-direction-v3.md §01）：
 *   1. 纯黑                 0–300ms    （默认态）
 *   2. 光带扫过             300–1500ms
 *   3. 标题字形轮廓出现     700–1200ms
 *   4. 标题填满             1200–2000ms，每字 +40ms
 *   5. 系统信息层上浮 12px  1900–2300ms
 *   6. 第一个信号对象进入   2300–2400ms
 *
 * 为什么不再用 useState 开关：上一版靠 useEffect 置 loaded 才播动画，
 * 结果是 JS 慢或水合失败时标题永远不会出现（初始 opacity: 0）。现在整套
 * 动画是 CSS，元素一上屏就开始按 delay 推进，不依赖 JS。
 *
 * 轮廓 → 填满是真的两层：先用 -webkit-text-stroke 画出描边字，再把描边
 * 收掉、把 color 从 transparent 变成 --ink-1。上一版只是把 opacity 从
 * 0 推到 1，看起来是"淡入"，不是"字形被填满"。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { T } from '@/lib/dict';

const LINE_1 = 'Something new';
const LINE_2 = 'is taking shape.';

/** 跨行连续编号，这样 stagger 不会被换行切断。 */
function chars(line: string, offset: number) {
  return Array.from(line).map((ch, i) => ({ ch, i: offset + i }));
}

const TOTAL = LINE_1.length + LINE_2.length;

export function Section01Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Parallax only: the hero rises slightly and softens as it leaves. The
     per-character fill animation is untouched — it is still pure CSS. */
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

        /* ── 3–4. 逐字轮廓 → 填满 ───────────────────────────────────── */
        .hero-char {
          display: inline-block;
          white-space: pre;
          color: transparent;
          -webkit-text-stroke: 1px rgba(242, 240, 234, 0.34);
          opacity: 0;
          /* 两层动画：先让描边字显形，再逐字把描边收掉、实心填满 */
          animation:
            hero-char-outline 0.32s ease-out
              calc(700ms + var(--i) * 20ms) both,
            hero-char-fill 0.82s var(--e-v3)
              calc(1200ms + var(--i) * 40ms) forwards;
        }
        @keyframes hero-char-outline {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes hero-char-fill {
          from {
            color: transparent;
            -webkit-text-stroke-color: rgba(242, 240, 234, 0.34);
          }
          to {
            color: var(--ink-1);
            -webkit-text-stroke-color: transparent;
          }
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

        /* ── Reduced-motion：全部压成一次 200ms 淡入 ─────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .hero-sweep { display: none; }
          .hero-char {
            animation: none;
            opacity: 1;
            color: var(--ink-1);
            -webkit-text-stroke-color: transparent;
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

        <h1 className="display-xl mt-10">
          <span className="sr-only">
            {LINE_1} {LINE_2}
          </span>
          <span aria-hidden className="block">
            {chars(LINE_1, 0).map(({ ch, i }) => (
              <span
                key={i}
                className="hero-char"
                style={{ ['--i' as string]: i }}
                data-total={TOTAL}
              >
                {ch}
              </span>
            ))}
          </span>
          <span aria-hidden className="block">
            {chars(LINE_2, LINE_1.length).map(({ ch, i }) => (
              <span key={i} className="hero-char" style={{ ['--i' as string]: i }}>
                {ch}
              </span>
            ))}
          </span>
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
