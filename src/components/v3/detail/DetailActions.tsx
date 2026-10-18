/**
 * 详情页第三屏 —— What it does（动作分镜）
 *
 * 规格（§9 第三屏）：3–5 个动作，每个一个小型动效，≤600ms
 *
 * ── 这一版重做（用户反馈：图形看不懂、整块"不明所以"）──────────────────
 *
 * 之前是一堆抽象线条（几条横线、一个虚线方框、一个三角形指针），用户看不出
 * 任何含义。现在每一步给三样东西：
 *   1. 一个能认出来的图标（读取=文段、理解=对齐网格、执行=指针点击、
 *      提取=框选、归位=收拢）
 *   2. 一句中文说明它做什么（一行以内）
 *   3. 一个 500ms 的小动效，直接演示这个动作本身
 *
 * 图标是内联 SVG 描边图形，不用颜色填充 —— 颜色只作为动效高亮出现。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { T } from '@/lib/dict';

type Act = 'read' | 'understand' | 'act' | 'extract' | 'return';

interface ActDef {
  key: Act;
  en: string;
  zh: string;
  /** 一句话说明这一步做什么 —— 走字典，保证中英各自成段 */
  descKey: 'pd.act.read.desc' | 'pd.act.understand.desc' | 'pd.act.act.desc' | 'pd.act.extract.desc' | 'pd.act.return.desc';
}

const ACTS: ActDef[] = [
  { key: 'read', en: 'READ', zh: '读取', descKey: 'pd.act.read.desc' },
  { key: 'understand', en: 'UNDERSTAND', zh: '理解', descKey: 'pd.act.understand.desc' },
  { key: 'act', en: 'ACT', zh: '执行', descKey: 'pd.act.act.desc' },
  { key: 'extract', en: 'EXTRACT', zh: '提取', descKey: 'pd.act.extract.desc' },
  { key: 'return', en: 'RETURN', zh: '归位', descKey: 'pd.act.return.desc' },
];

export function DetailActions({ accent }: { accent: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-on={on} style={{ '--accent-color': accent } as React.CSSProperties}>
      <style>{`
        /* 每一步的图标动效，都在 500ms 内完成并停住 */
        .ia-scan {
          opacity: 0;
        }
        [data-on="true"] .ia-scan { animation: ia-scan 0.5s var(--e-v3) both; }
        @keyframes ia-scan {
          0%   { opacity: 0; transform: translateX(0); }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(26px); }
        }

        .ia-cell { transition: none; }
        [data-on="true"] .ia-cell {
          animation: ia-align 0.5s var(--e-v3) both;
          animation-delay: calc(var(--d) * 32ms);
        }
        @keyframes ia-align {
          from { transform: translate(var(--jx), var(--jy)); opacity: 0.4; }
          to   { transform: translate(0, 0); opacity: 1; }
        }

        .ia-pointer { opacity: 0; }
        [data-on="true"] .ia-pointer { animation: ia-move 0.5s var(--e-v3) both; }
        @keyframes ia-move {
          0%   { opacity: 0; transform: translate(-10px, 8px); }
          25%  { opacity: 1; }
          100% { opacity: 1; transform: translate(0, 0); }
        }

        .ia-marquee { opacity: 0; }
        [data-on="true"] .ia-marquee { animation: ia-marquee 0.5s var(--e-v3) both; }
        @keyframes ia-marquee {
          0%   { opacity: 0; transform: scale(1.3); }
          60%  { opacity: 1; transform: scale(1); }
          100% { opacity: 1; transform: scale(1) translate(6px, -6px); }
        }

        .ia-tidy { opacity: 0; }
        [data-on="true"] .ia-tidy { animation: ia-tidy 0.5s var(--e-v3) both; }
        @keyframes ia-tidy {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-on="true"] .ia-scan,
          [data-on="true"] .ia-cell,
          [data-on="true"] .ia-pointer,
          [data-on="true"] .ia-marquee,
          [data-on="true"] .ia-tidy {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .ia-scan { display: none; }
        }
      `}</style>

      <ol className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-5">
        {ACTS.map((a, i) => (
          <li key={a.key}>
            {/* 编号 + 名称 */}
            <div className="flex items-baseline gap-3">
              <span className="data text-[var(--ink-4)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="system text-[var(--ink-2)]">{a.en}</span>
              <span className="system text-[var(--ink-4)]">{a.zh}</span>
            </div>

            {/* 图标 + 动效 */}
            <div className="mt-5 border-t border-[var(--glass-1-border)] pt-5">
              <ActIcon act={a.key} />
            </div>

            {/* 一句话说明 —— 这是这一版加的核心内容 */}
            <T k={a.descKey} as="p" className="body mt-4 text-[var(--ink-2)]" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 每一步一个能认出来的图标（内联 SVG，描边，无填充）。 */
function ActIcon({ act }: { act: Act }) {
  const stroke = 'var(--ink-4)';
  const hot = 'var(--accent-color)';

  if (act === 'read') {
    // 文段 + 一条扫描线
    return (
      <div className="relative h-[52px] w-[52px]">
        <svg viewBox="0 0 52 52" className="h-full w-full" fill="none" aria-hidden>
          <rect x="8" y="10" width="36" height="32" rx="2" stroke={stroke} strokeWidth="1.2" />
          {[18, 25, 32].map((y, i) => (
            <line
              key={y}
              x1="14" y1={y} x2={i === 2 ? 30 : 38} y2={y}
              stroke={stroke} strokeWidth="1.2" strokeLinecap="round"
            />
          ))}
          <line className="ia-scan" x1="14" y1="10" x2="14" y2="42" stroke={hot} strokeWidth="1.4" />
        </svg>
      </div>
    );
  }

  if (act === 'understand') {
    // 散乱 → 对齐成 3×3 网格
    const cells: { x: number; y: number; jx: string; jy: string; d: number }[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const n = r * 3 + c;
        cells.push({
          x: 12 + c * 12,
          y: 12 + r * 12,
          jx: `${((n % 3) - 1) * 7}px`,
          jy: `${((n % 2) - 0.5) * 8}px`,
          d: n,
        });
      }
    }
    return (
      <svg viewBox="0 0 52 52" className="h-[52px] w-[52px]" fill="none" aria-hidden>
        {cells.map((c, i) => (
          <rect
            key={i}
            className="ia-cell"
            x={c.x} y={c.y} width="8" height="8" rx="1"
            stroke={hot} strokeWidth="1.2"
            style={{ '--jx': c.jx, '--jy': c.jy, '--d': c.d } as React.CSSProperties}
          />
        ))}
      </svg>
    );
  }

  if (act === 'act') {
    // 指针 + 一个按钮
    return (
      <svg viewBox="0 0 52 52" className="h-[52px] w-[52px]" fill="none" aria-hidden>
        <rect x="22" y="26" width="20" height="12" rx="2" stroke={stroke} strokeWidth="1.2" />
        <line x1="8" y1="32" x2="18" y2="32" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        <g className="ia-pointer">
          <path d="M14 18 L14 32 L18.5 28 L21 34 L24 32.5 L21.5 27 L26 26.5 Z" fill={hot} />
        </g>
      </svg>
    );
  }

  if (act === 'extract') {
    // 框选：四角选取框
    return (
      <svg viewBox="0 0 52 52" className="h-[52px] w-[52px]" fill="none" aria-hidden>
        {[16, 22, 28].map((y) => (
          <line key={y} x1="10" y1={y} x2="42" y2={y} stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        ))}
        <g className="ia-marquee">
          <path d="M18 12 h6 M18 12 v6" stroke={hot} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M34 12 h-6 M34 12 v6" stroke={hot} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M18 32 h6 M18 32 v-6" stroke={hot} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M34 32 h-6 M34 32 v-6" stroke={hot} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // return：三个散点收拢成对齐的三行
  return (
    <svg viewBox="0 0 52 52" className="h-[52px] w-[52px]" fill="none" aria-hidden>
      <g className="ia-tidy">
        <rect x="14" y="16" width="24" height="3" rx="1.5" fill={hot} />
        <rect x="14" y="24" width="18" height="3" rx="1.5" fill={stroke} />
        <rect x="14" y="32" width="21" height="3" rx="1.5" fill={stroke} />
      </g>
    </svg>
  );
}
