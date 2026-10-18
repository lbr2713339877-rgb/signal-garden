/**
 * V3 Section 05 — 项目档案切片
 *
 * 每个项目按 7 步递进出现（0 / 120 / 260 / 420 / 560 / 700 / 840ms）：
 *   1. 编号  2. 项目名  3. 视觉  4. 一句话  5. 热度  6. 为什么值得看  7. 查看项目
 *
 * ── 这一版修掉的两个问题（用户截图反馈）────────────────────────────────
 *
 * 1. 「绿紫背景太丑、和前后屏衔接生硬」
 *    原来整屏铺了一层 color-mix 的线性渐变（分类色 16%），它把整个 article
 *    染成绿/紫，而且四个角是硬切的，所以屏与屏之间是"啪"地换色。
 *    现在：整屏底色一律回到 --bg-void，颜色只以两种受控形式出现 ——
 *    一条 1px 分类色细线（页眉位置）+ 右上角一团很淡的径向光。
 *    屏与屏之间用 200px 的暗色渐隐带过渡，不再出现色块硬边。
 *
 * 2. 「preview 图片显示不对」
 *    原来 imageUrl 为空时只显示一个 "PREVIEW" 灰字，看起来像加载失败。
 *    现在三层兜底：真实 opengraph 图 → 由 fullName 推出的 opengraph 图 →
 *    由项目名确定性生成的抽象封面（几何，不是文字占位）。图片加载失败
 *    也会退回抽象封面，所以这个框永远不会是空的。
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useReveal } from './useReveal';
import { T } from '@/lib/dict';
import { Fallback, firstSentence } from '@/lib/i18n';

export interface ProjectSliceData {
  id: string;
  slug: string;
  rank: number;
  name: string;
  /** 用于推导 opengraph 图 */
  fullName?: string | null;
  /**
   * 中英各一份。之前这里只有中文字段，所以英文模式漏中文；
   * 而 oneLiner 又会被 GitHub 的英文原文兜底，中文模式漏英文。
   * 现在两种语言都带着，由 Fallback 决定显示哪个、缺哪个。
   */
  hook: { zh: string | null; en: string | null };
  oneLiner: { zh: string | null; en: string | null };
  metric: number;
  metricUnit: string;
  categoryKey: string;
  categoryLabel: string;
  color: string;
  imageUrl?: string | null;
}

const STEPS = [0, 60, 120, 200, 280, 350, 420];

function useCountUp(target: number, run: boolean, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;

    if (
      target === 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);

  return value;
}

export function ProjectArchiveSlice({
  project,
  reverse = false,
}: {
  project: ProjectSliceData;
  reverse?: boolean;
}) {
  /* 双向 reveal：往下滚出现，往上滚收回，再从任一侧滚回来都会重新播。
     之前这里 observer 触发一次就 disconnect，所以往回滚什么都没有。 */
  const [articleRef, visible] = useReveal<HTMLElement>({ threshold: 0.15 });
  /* 两级失败计数：第 1 次失败退回"由 fullName 推导的 opengraph 图"，
     第 2 次失败才退回抽象封面。
     之前只有一个布尔量，而 imageUrl 为空时推导出来的 URL 和原 URL 是同一个 ——
     失败后重算得到同样的地址，于是永远停在裂图状态（例如仓库不存在，
     opengraph 返回 404）。 */
  const [imgStage, setImgStage] = useState<0 | 1 | 2>(0);
  const count = useCountUp(project.metric, visible);

  // 预览图三级兜底：项目自带图 → 由 fullName 推导的 opengraph 图 → 抽象封面
  const primarySrc = imgStage === 0 ? project.imageUrl : null;
  const derivedSrc =
    imgStage <= 1 && project.fullName
      ? `https://opengraph.githubassets.com/1/${project.fullName}`
      : null;
  const src = primarySrc ?? derivedSrc;

  return (
    <article
      ref={articleRef}
      id={`signal-${project.slug}`}
      className="relative flex min-h-screen items-center px-[var(--gutter)] py-[var(--section-gap)]"
      data-visible={visible}
      style={{ '--accent': project.color } as React.CSSProperties}
    >
      <style>{`
        .step {
          opacity: 0;
          transform: translateY(8px);
          transition:
            opacity 0.28s var(--e-v3) calc(var(--s) * 1ms),
            transform 0.28s var(--e-v3) calc(var(--s) * 1ms);
        }
        [data-visible="true"] .step {
          opacity: 1;
          transform: translateY(0);
        }

        /* 收回时错落方向反过来（最后出现的先收回），看起来像"退场"而不是
           所有东西一起消失 */
        [data-visible="false"] .step {
          transition-delay: calc((7 - var(--s) / 70) * 30ms);
        }

        .slice-body {
          opacity: 0.3;
          transition: opacity 0.9s var(--e-v3);
        }
        [data-visible="true"] .slice-body { opacity: 1; }

        @media (prefers-reduced-motion: reduce) {
          .step { opacity: 1; transform: none; transition: none; }
          .slice-body { opacity: 1; transition: none; }
        }
      `}</style>

      {/* 顶部分类色细线 —— 取代原来那层整屏渐变 */}
      <span
        aria-hidden
        className="absolute top-0 left-[var(--gutter)] right-[var(--gutter)] h-px"
        style={{ background: `color-mix(in srgb, ${project.color} 45%, transparent)` }}
      />

      {/* 右上角一团很淡的光，是这一屏唯一的彩色面积 */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[8%] right-[-8%] h-[520px] w-[520px]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${project.color} 12%, transparent), transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      <div className="slice-body relative mx-auto grid w-full max-w-[var(--container)] gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div className={`flex flex-col ${reverse ? 'lg:order-2' : 'lg:order-1'}`}>
          <div className="flex gap-6">
            <div className="step shrink-0" style={{ '--s': STEPS[0] } as React.CSSProperties}>
              <span
                className="data text-[var(--ink-4)]"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                {String(project.rank).padStart(2, '0')}
              </span>
            </div>

            <div className="flex min-w-0 flex-col">
              <h2
                className="step display-l"
                style={
                  {
                    '--s': STEPS[1],
                    viewTransitionName: `project-title-${project.slug}`,
                  } as React.CSSProperties
                }
              >
                <Link href={`/p/${project.slug}`} data-discovery-target={project.slug} data-discovery-placement="grid">{project.name}</Link>
              </h2>

              {/* 6. Hook —— step 包一层，保留原来的 700ms 入场错峰 */}
              <div className="step" style={{ '--s': STEPS[5] } as React.CSSProperties}>
                <Fallback
                  as="h3"
                  zh={firstSentence(project.hook.zh)}
                  en={firstSentence(project.hook.en)}
                  className="editorial text-[var(--ink-1)]"
                />
              </div>

              {/* 4. 一句话说明 */}
              <div className="step" style={{ '--s': STEPS[3] } as React.CSSProperties}>
                <Fallback
                  as="p"
                  zh={firstSentence(project.oneLiner.zh)}
                  en={firstSentence(project.oneLiner.en)}
                  className="body max-w-[52ch] text-[var(--ink-2)]"
                />
              </div>

              <div
                className="step mt-9 flex flex-wrap items-center gap-x-6 gap-y-3"
                style={{ '--s': STEPS[4] } as React.CSSProperties}
              >
                {project.metric > 0 ? <span className="data" style={{ color: project.color }}>+{count.toLocaleString('en-US')} {project.metricUnit}</span> : null}
                <span className="system">{project.categoryLabel}</span>
              </div>

              <div
                className="step mt-10 flex flex-wrap items-center gap-x-6 gap-y-3"
                style={{ '--s': STEPS[6] } as React.CSSProperties}
              >
                <Link
                  href={`/p/${project.slug}`}
                  data-discovery-target={project.slug}
                  data-discovery-placement="grid"
                  className="body min-h-11 inline-flex items-center gap-2 border-b border-[var(--glass-2-border)] pb-1 text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:border-[var(--ink-1)] hover:text-[var(--ink-1)]"
                >
                  <T k="ts.open" as="span" fade={false} />
                  <span aria-hidden>→</span>
                </Link>
                <a href="#edition-index" className="data inline-flex min-h-11 items-center text-[var(--ink-3)]"><T k="ts.backToList" as="span" fade={false} /> ↑</a>
              </div>
            </div>
          </div>
        </div>

        {/* 视觉 */}
        <div
          className={`step relative ${reverse ? 'lg:order-1' : 'lg:order-2'}`}
          style={{ '--s': STEPS[2] } as React.CSSProperties}
        >
          {/* 关键：GitHub 的 opengraph 卡片是 1200×600，即 2:1。
              之前容器是 16/10（1.6:1），object-cover 会把左右各裁掉约
              10%，仓库名两端正好被切掉（"heygen-com/hyperframes" 变成
              "eygen-com/ /yperframes"）—— 这就是用户看到的截图切字。
              容器改成 2:1 后，任何视口宽度下都不会再裁。 */}
          <Link href={`/p/${project.slug}`} aria-label={project.name} data-discovery-target={project.slug} data-discovery-placement="grid" className="glass-1 block aspect-[2/1] w-full overflow-hidden">
            {src ? (
              <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setImgStage((s) => (s < 2 ? ((s + 1) as 1 | 2) : 2))}
                className="h-full w-full object-cover object-center"
                style={{ opacity: 0.92 }}
              />
            ) : (
              <AbstractCover seed={project.slug} color={project.color} />
            )}
          </Link>

          {/* 图注：说清这是什么，而不是让它悬空 */}
          <p className="system mt-3 text-[var(--ink-4)]">
            <T k={src ? 'ts.preview' : 'ts.abstract'} as="span" fade={false} />
          </p>
        </div>
      </div>
    </article>
  );
}

/**
 * 抽象封面：用 slug 的字符码生成确定性的几何构图。
 * 同一个项目每次渲染都一样，不同项目不一样。不是随机噪点。
 */
function AbstractCover({ seed, color }: { seed: string; color: string }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 9973;

  const bars = 5;
  const values = Array.from({ length: bars }, (_, i) => {
    const v = ((h >> (i * 2)) % 64) / 64;
    return 0.25 + v * 0.6;
  });

  return (
    <div className="relative h-full w-full">
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${color} 18%, transparent), transparent 62%)`,
        }}
      />
      <div className="relative flex h-full items-end gap-[6%] px-[10%] pb-[12%]">
        {values.map((v, i) => (
          <span
            key={i}
            className="flex-1"
            style={{
              height: `${Math.round(v * 100)}%`,
              background: `color-mix(in srgb, ${color} ${18 + i * 6}%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
