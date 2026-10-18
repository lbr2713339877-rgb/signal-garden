/**
 * V3 Section 03 — 四个源汇入一个信号
 *
 * 四个数据源用不同材质沿曲线轨道飞行，汇入中央实体，实体从模糊变清晰。
 * GitHub 的粒子密度是其他源的两倍（§03）。
 *
 * ── 实现说明 ───────────────────────────────────────────────────────────
 * 原稿建议这一段用 WebGL（14 个平面 + 折射）。这里用分层 DOM + transform
 * 实现，原因有两个：
 *   1. 项目里没有装 three（也没装任何 3D 库），为一段进场动画引入 ~150KB
 *      gzip 的运行时，会直接吃掉 §performance 里"Three.js ≤150KB 且懒加载"
 *      的预算，而这一段并不真的需要折射 —— 它需要的是"四种材质在暗场里
 *      沿弧线收拢"，用描边、圆点、1px 线就能表达。
 *   2. 焦点实体只是从 blur(14px) 收到 blur(0)，DOM 的 filter 过渡已经足够，
 *      而且天然支持 reduced-motion。
 *
 * ── 为什么几何是模块级常量 ─────────────────────────────────────────────
 * 这些点的坐标来自 Math.cos/sin，是不循环小数（-39.000000000000036 这类），
 * 而透明度算式 0.28 + (i%3)*0.14 会算出 0.42000000000000004 这种值。
 * React 在服务端把 style 序列化进 HTML 时会规整这些数字，客户端却按原值
 * 比较，两边字符串不一致 → hydration mismatch（"This won't be patched up"）。
 *
 * 所以：所有几何在这里算一次，并量化到 2 位小数。服务端和客户端拿到的是
 * 同一组普通常量，不可能产生分歧；顺带也省掉了每次渲染重算 48 个点。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from 'motion/react';
import { T } from '@/lib/dict';

/** 量化到 2 位小数 —— 消除浮点尾数导致的服务端/客户端字符串差异。 */
const q = (n: number) => Math.round(n * 100) / 100;

interface Source {
  key: string;
  label: string;
  /** 材质 */
  material: 'particles' | 'lines' | 'blocks' | 'dots';
  color: string;
  /** 轨道起点（相对中心的百分比偏移） */
  from: { x: number; y: number };
  /** 粒子/线段密度 */
  density: number;
}

const SOURCES: Source[] = [
  {
    key: 'github',
    label: 'GITHUB',
    material: 'particles',
    color: 'var(--light-cyan)',
    from: { x: -38, y: -30 },
    density: 24, // 2× —— 主源
  },
  {
    key: 'hn',
    label: 'HACKER NEWS',
    material: 'lines',
    color: 'var(--light-amber)',
    from: { x: 38, y: -28 },
    density: 12,
  },
  {
    key: 'ph',
    label: 'PRODUCT HUNT',
    material: 'blocks',
    color: 'var(--light-coral)',
    from: { x: -34, y: 32 },
    density: 12,
  },
  {
    key: 'community',
    label: 'COMMUNITY',
    material: 'dots',
    color: 'var(--light-mint)',
    from: { x: 36, y: 30 },
    density: 12,
  },
];

const BASE = 46;

/** 点：极坐标 → 直角坐标，量化后固定下来。 */
const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  const r = BASE + (i % 4) * 11;
  return {
    x: q(Math.cos(a) * r),
    y: q(Math.sin(a) * r),
    o: q(0.28 + (i % 3) * 0.14),
  };
});

/** 线：绕中心旋转一圈，长度递变。 */
const LINES = Array.from({ length: 12 }, (_, i) => ({
  rot: q((i / 12) * 360),
  w: BASE + (i % 5) * 12,
}));

/** 块：小矩形，自身也带一点旋转。 */
const BLOCKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  const r = BASE + (i % 3) * 16;
  return {
    x: q(Math.cos(a) * r),
    y: q(Math.sin(a) * r),
    rot: q(a * 40),
    w: 8 + (i % 3) * 6,
    h: 4 + (i % 2) * 4,
  };
});

/** 点环：一圈同心点。 */
const DOTS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: q(Math.cos(a) * (BASE + 22)), y: q(Math.sin(a) * (BASE + 22)) };
});

export function Convergence() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  /* Hydration guard: server HTML renders everything at its settled position, so
     a JS failure never hides the section. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* Continuous progress instead of three discrete phases. The four sources
     travel in one after another (each offset by 0.1), then the core settles. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const motionOn = mounted && !reduce;

  // The copy resolves as the entity settles.
  const labelOpacity = useTransform(scrollYProgress, [0.42, 0.66], [0, 1]);
  const labelY = useTransform(scrollYProgress, [0.42, 0.66], [8, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-[var(--gutter)]"
    >
      <style>{`
        /* The four sources and the label are driven by MotionValues; only
           static material styling and the reduced-motion fallback live here. */
        .cv-source,
        .cv-label,
        .cv-core {
          will-change: transform, opacity;
        }
        .cv-source { filter: blur(0.6px); }

        /* 汇聚环：实体成形时向外扩一次（由 ConvergeArt 的进度控制透明度） */
        @keyframes cv-ring-out {
          0%   { opacity: 0.5; transform: translate(-50%, -50%) scale(0.7); }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(1.6); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cv-source { display: none; }
          .cv-ring { display: none; }
        }
      `}</style>

      {/* 四个源 —— 逐个进入（各错开 0.1 进度），不是同时动 */}
      {SOURCES.map((s, i) => (
        <ConvergeSource key={s.key} source={s} index={i} progress={scrollYProgress} motionOn={motionOn} />
      ))}

      {/* 中央实体 —— 移到文字上方，不再压住标题 */}
      <div className="relative z-10 flex w-full flex-col items-center">
        <ConvergeArt progress={scrollYProgress} motionOn={motionOn} />

        <motion.div
          className="cv-label relative mt-14 text-center"
          style={motionOn ? { opacity: labelOpacity, y: labelY } : undefined}
        >
          <T k="cv.kicker" as="p" className="system" fade={false} />
          <T k="cv.title" as="h2" className="display-l mt-6" />
          <T
            k="cv.body"
            as="p"
            className="body mt-5 max-w-[46ch] text-[var(--ink-2)]"
          />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {SOURCES.map((s) => (
              <span key={s.key} className="data flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-[6px] w-[6px] rounded-full"
                  style={{ background: s.color }}
                />
                <span className="text-[var(--ink-3)]">{s.label}</span>
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/** One source node: travels toward the centre on its own slice of progress. */
function ConvergeSource({
  source,
  index,
  progress,
  motionOn,
}: {
  source: Source;
  index: number;
  progress: MotionValue<number>;
  motionOn: boolean;
}) {
  // Each source owns a 0.1-wide window, so they arrive in sequence.
  const start = 0.26 + index * 0.06;
  const end = start + 0.22;
  const x = useTransform(progress, [start, end], [source.from.x, 0]);
  const y = useTransform(progress, [start, end], [source.from.y, 0]);
  const opacity = useTransform(progress, [start, (start + end) / 2, end], [0, 0.5, 0]);

  return (
    <motion.div
      aria-hidden
      className="cv-source absolute top-1/2 left-1/2"
      style={
        motionOn
          ? { x, y, opacity, translateX: '-50%', translateY: '-50%' }
          : {
              transform: `translate(-50%, -50%) translate(${source.from.x}%, ${source.from.y}%)`,
              opacity: 0,
            }
      }
    >
      <SourceMaterial material={source.material} color={source.color} />
    </motion.div>
  );
}

/**
 * 收敛动画：四个来源色点沿四个方向飞向中心，合成为一个点，然后中心点扩散
 * 成一个环。这是"四个源汇成一个信号"的字面可视化 —— 之前那里是一个空心的
 * 灰色圆圈压在标题上，什么也没表达。
 *
 * 尺寸 220px，完全位于标题上方，不与任何文字重叠。
 */
function ConvergeArt({
  progress,
  motionOn,
}: {
  progress: MotionValue<number>;
  motionOn: boolean;
}) {
  /* A slow breathe once the entity has formed (progress > 0.7). */
  const breathe = useTransform(progress, [0.62, 0.8], [1, 1.06]);
  const coreOpacity = useTransform(progress, [0.45, 0.68], [0.25, 1]);
  const R = 78;

  return (
    <motion.div
      className="relative h-[160px] w-[220px]"
      aria-hidden
      style={motionOn ? { scale: breathe } : undefined}
    >
      <style>{`
        .cv-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          height: 9px;
          width: 9px;
          border-radius: 50%;
          margin: -4.5px 0 0 -4.5px;
          opacity: 0;
          transition:
            transform 1.2s var(--e-v3),
            opacity 0.5s var(--e-v3);
        }
        /* idle：四色点停在各自的远端方向上，不可见 */
        [data-phase="idle"] .cv-dot {
          transform: translate(calc(var(--dx) * 1px), calc(var(--dy) * 1px));
          opacity: 0;
        }
        /* travel：飞向中心 */
        [data-phase="travel"] .cv-dot,
        [data-phase="settle"] .cv-dot {
          transform: translate(0, 0);
          opacity: 0.85;
        }
        [data-phase="settle"] .cv-dot { opacity: 0; }

        /* 合成后的中心点 */
        .cv-core-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          height: 11px;
          width: 11px;
          border-radius: 50%;
          margin: -5.5px 0 0 -5.5px;
          background: var(--ink-1);
          opacity: 0;
          transform: scale(0.5);
          transition:
            opacity 0.6s var(--e-v3) 1.1s,
            transform 0.6s var(--e-v3) 1.1s;
        }
        [data-phase="settle"] .cv-core-dot {
          opacity: 1;
          transform: scale(1);
        }

        /* 中心点扩散出的环 */
        .cv-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          height: 30px;
          width: 30px;
          border-radius: 50%;
          border: 1px solid var(--ink-3);
          margin: -15px 0 0 -15px;
          opacity: 0;
        }
        [data-phase="settle"] .cv-ring {
          animation: cv-ring-out 1.6s var(--e-v3) 1.2s infinite;
        }
        @keyframes cv-ring-out {
          0%   { opacity: 0.5; transform: scale(0.6); }
          100% { opacity: 0;   transform: scale(3); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cv-dot { display: none; }
          .cv-core-dot { opacity: 1; transform: none; transition: none; }
          .cv-ring { display: none; }
        }
      `}</style>

      {/* 四个来源色点 */}
      {SOURCES.map((s, i) => {
        const a = (i / SOURCES.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <span
            key={s.key}
            className="cv-dot"
            style={
              {
                background: s.color,
                '--dx': Math.round(Math.cos(a) * R),
                '--dy': Math.round(Math.sin(a) * R),
              } as React.CSSProperties
            }
          />
        );
      })}

      <span className="cv-ring" />
      <motion.span className="cv-core-dot" style={motionOn ? { opacity: coreOpacity } : undefined} />
    </motion.div>
  );
}

/** 四种材质。几何全部来自模块级常量。 */
function SourceMaterial({
  material,
  color,
}: {
  material: Source['material'];
  color: string;
}) {
  if (material === 'particles') {
    return (
      <div className="relative h-0 w-0">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute block h-[3px] w-[3px] rounded-full"
            style={{
              background: color,
              opacity: p.o,
              transform: `translate(${p.x}px, ${p.y}px)`,
            }}
          />
        ))}
      </div>
    );
  }

  if (material === 'lines') {
    return (
      <div className="relative h-0 w-0">
        {LINES.map((l, i) => (
          <span
            key={i}
            className="absolute block h-px origin-left"
            style={{
              width: `${l.w}px`,
              background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
              opacity: 0.4,
              transform: `rotate(${l.rot}deg)`,
            }}
          />
        ))}
      </div>
    );
  }

  if (material === 'blocks') {
    return (
      <div className="relative h-0 w-0">
        {BLOCKS.map((b, i) => (
          <span
            key={i}
            className="absolute block"
            style={{
              width: `${b.w}px`,
              height: `${b.h}px`,
              border: `1px solid ${color}`,
              opacity: 0.3,
              transform: `translate(${b.x}px, ${b.y}px) rotate(${b.rot}deg)`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative h-0 w-0">
      {DOTS.map((d, i) => (
        <span
          key={i}
          className="absolute block h-[5px] w-[5px] rounded-full"
          style={{
            background: color,
            opacity: 0.32,
            transform: `translate(${d.x}px, ${d.y}px)`,
          }}
        />
      ))}
    </div>
  );
}
