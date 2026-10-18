/**
 * 详情页第二屏 —— Why now（数据分布，不是卡片）
 *
 * 规格（§9 第二屏）：
 *   FIRST SEEN   24 SEP 2026   贴在左边缘，垂直排列
 *   GROWTH       +328% / 24H   沿一条线，线随数值长度绘制
 *   DISCUSSION   3 SOURCES     沿轨道排列的 3 个点
 *   STATUS       ACTIVE        一个 4s 周期的呼吸点
 *   滚动时依次激活（间隔 140ms）
 *
 * 明确要求"数据不是四张卡片，是分布在空间里的四个观测值"。所以这里是四个
 * 观测值各自带一个专属的可视记号，横向铺开，而不是网格。
 *
 * 这条线不是装饰：它的长度就是数值本身。没有历史数据时不画线，直接说没有 ——
 * 不能编一个增长出来。
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { LANG } from '@/lib/i18n';

/** 中英一对。详情页是服务端组件，渲染时不知道客户端语言，
 *  所以数据必须两种语言都带着，由 CSS 决定显示哪个。 */
export interface Bi {
  zh: string;
  en: string;
}

export interface Observation {
  key: string;
  label: Bi;
  value: Bi;
  note?: Bi;
  /** growth 用它决定线的长度（0–1） */
  magnitude?: number;
  /** sources 用它画几个点 */
  dots?: number;
}

export function DetailObservations({
  items,
  accent,
}: {
  items: Observation[];
  accent: string;
}) {
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
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative" data-on={on}>
      <style>{`
        .ob {
          opacity: 0;
          transform: translateY(10px);
          transition:
            opacity 620ms var(--e-v3) calc(var(--i) * 140ms),
            transform 620ms var(--e-v3) calc(var(--i) * 140ms);
        }
        [data-on="true"] .ob {
          opacity: 1;
          transform: translateY(0);
        }

        /* growth：线随数值长度绘制 */
        .ob-line {
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 900ms var(--e-v3) calc(var(--i) * 140ms + 200ms);
        }
        [data-on="true"] .ob-line {
          transform: scaleX(1);
        }

        /* status：4s 呼吸点 */
        .ob-pulse {
          animation: ob-breathe 4s ease-in-out infinite;
        }
        @keyframes ob-breathe {
          0%, 100% { opacity: 0.35; transform: scale(0.82); }
          50%      { opacity: 1;    transform: scale(1); }
        }

        /* sources：点沿轨道错落 */
        .ob-dot {
          animation: ob-dot-in 520ms var(--e-v3) both;
          animation-delay: calc(var(--i) * 140ms + var(--d) * 90ms + 240ms);
        }
        @keyframes ob-dot-in {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ob, .ob-line { opacity: 1; transform: none; transition: none; }
          .ob-pulse, .ob-dot { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((o, i) => (
          <div
            key={o.key}
            className="ob relative"
            style={{ '--i': i } as React.CSSProperties}
          >
            <LANG zh={o.label.zh} en={o.label.en} as="p" className="system" />

            {/* 主值 */}
            <LANG
              zh={o.value.zh}
              en={o.value.en}
              as="p"
              className="data mt-3 text-[var(--ink-1)]"
              style={{ fontSize: '0.875rem' }}
            />

            {/* 专属记号 */}
            <div className="mt-4 h-4">
              {o.key === 'growth' && o.magnitude !== undefined ? (
                <div className="relative h-px w-full bg-[var(--ink-4)]">
                  <span
                    className="ob-line absolute inset-y-0 left-0 block"
                    style={{
                      width: `${Math.max(0.06, Math.min(1, o.magnitude)) * 100}%`,
                      background: accent,
                    }}
                  />
                </div>
              ) : null}

              {o.key === 'sources' && o.dots ? (
                <div className="flex h-4 items-center gap-2">
                  {Array.from({ length: o.dots }).map((_, d) => (
                    <span
                      key={d}
                      className="ob-dot block h-[5px] w-[5px] rounded-full"
                      style={
                        {
                          background: accent,
                          opacity: 0.7,
                          '--d': d,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              ) : null}

              {o.key === 'status' ? (
                <span
                  className="ob-pulse block h-[6px] w-[6px] rounded-full"
                  style={{ background: accent }}
                />
              ) : null}
            </div>

            {o.note ? (
              <LANG
                zh={o.note.zh}
                en={o.note.en}
                as="p"
                className="system mt-3 text-[var(--ink-4)]"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
