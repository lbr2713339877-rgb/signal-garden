/**
 * V3 Section 06 — 六个分类空间
 *
 * 六个分类各有自己的环境色，切换 800ms。环境色只作为穿过玻璃的光出现，
 * 永远不做填充。
 *
 * ── 这一版补上视觉（用户反馈：预览卡是空的渐变）────────────────────────
 *
 * 之前右侧预览卡只有一块暗色渐变 + 分类名，六个分类全都一样，看起来像没做完。
 *
 * 现在每张卡里是一面**真实项目的 owner 头像墙**：该分类下 star 最高的
 * 6–12 个项目的 GitHub owner 头像，错落排布、统一压低亮度。
 *
 * 为什么用头像而不是插画：头像是这个分类里真实存在的东西，比通用主题插画
 * 更能说明"今天有人在用的产品"。而且 GitHub 头像走公开图片 CDN，不需要
 * API key，也不涉及抓取。
 *
 * 头像加载有兜底：失败时退回一个几何色块，不会出现浏览器默认裂图。
 */

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { TAXONOMY } from '@/normalizers/taxonomy';
import { T, type DictKey } from '@/lib/dict';

/** 分类 → V3 环境色。TAXONOMY 自带的 cssVar 指向 V2 的 --c-*，这里不用。 */
const COLOR: Record<string, string> = {
  'ai-tools': 'var(--light-purple)',
  'indie-web': 'var(--light-cyan)',
  'dev-tools': 'var(--light-fog)',
  design: 'var(--light-coral)',
  'skill-agent': 'var(--light-mint)',
  productivity: 'var(--light-amber)',
};

const MATERIAL: Record<string, DictKey> = {
  'ai-tools': 'cs.mat.ai-tools',
  'indie-web': 'cs.mat.indie-web',
  'dev-tools': 'cs.mat.dev-tools',
  design: 'cs.mat.design',
  'skill-agent': 'cs.mat.skill-agent',
  productivity: 'cs.mat.productivity',
};

export interface CategoryOwner {
  owner: string;
  name: string;
  slug: string;
}

export function CategorySpaces({
  owners,
  counts = {},
}: {
  /** 分类 key → 该分类下的代表项目 owner */
  owners: Record<string, CategoryOwner[]>;
  /** 分类 key → 该分类下通过门槛的项目总数 */
  counts?: Record<string, number>;
}) {
  /* useState 会把初始值收窄成字面量联合类型，这里显式标成 string，
     否则 switchTo 传进来的任意 key 不匹配。 */
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* One gentle lift as the section enters. The 800ms category switch animation
     is untouched — this only nudges the whole block. */
  /* Near the end of the page the scrollable range is short, so finish the
     entrance well before the section leaves. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'center center'],
  });
  const lift = useTransform(scrollYProgress, [0.15, 0.5], [24, 0]);
  const liftOpacity = useTransform(scrollYProgress, [0.15, 0.5], [0.4, 1]);
  const motionOn = mounted && !reduce;

  const [active, setActive] = useState<string>(TAXONOMY[0].key);
  const [fading, setFading] = useState(false);
  const current = TAXONOMY.find((t) => t.key === active) ?? TAXONOMY[0];
  const color = COLOR[current.key];

  /** 切换：先淡出 140ms，换内容，再淡入 —— 总计 ~300ms，落在 200–400ms 区间 */
  const switchTo = (key: string) => {
    if (key === active || fading) return;
    setFading(true);
    setTimeout(() => {
      setActive(key);
      setFading(false);
    }, 140);
  };

  const list = owners[current.key] ?? [];

  return (
    <motion.section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden px-[var(--gutter)] py-[var(--section-gap)]"
      style={motionOn ? { y: lift, opacity: liftOpacity } : undefined}
    >
      <style>{`
        .cs-glow {
          transition:
            opacity 800ms var(--e-v3),
            transform 800ms var(--e-v3),
            background 800ms var(--e-v3);
        }

        .cs-panel {
          opacity: 1;
          transform: translateY(0);
          transition:
            opacity 140ms ease-out,
            transform 140ms ease-out;
        }
        .cs-panel[data-fading="true"] {
          opacity: 0;
          transform: translateY(6px);
        }

        .cs-item {
          transition:
            color 260ms var(--e-v3),
            padding-left 260ms var(--e-v3);
        }

        /* 头像墙：错落入场 */
        .cs-avatar {
          animation: cs-avatar-in 420ms var(--e-v3) both;
          animation-delay: calc(var(--i) * 38ms);
        }
        @keyframes cs-avatar-in {
          from { opacity: 0; transform: scale(0.86) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cs-glow, .cs-panel, .cs-item { transition: none; }
          .cs-panel[data-fading="true"] { opacity: 1; transform: none; }
          .cs-avatar { animation: none; }
        }
      `}</style>

      {/* 环境光斑 —— 唯一的彩色来源 */}
      <div
        aria-hidden
        className="cs-glow ambient-light pointer-events-none absolute top-[-10%] left-[-10%] h-[620px] w-[620px]"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 68%)`,
          opacity: 0.16,
        }}
      />
      <div
        aria-hidden
        className="cs-glow ambient-light pointer-events-none absolute right-[-14%] bottom-[-16%] h-[520px] w-[520px]"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 70%)`,
          opacity: 0.1,
        }}
      />

      <div className="relative mx-auto grid max-w-[var(--container)] gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        {/* 左：六个分类 */}
        <div>
          <T k="cs.kicker" as="p" className="system" fade={false} />
          <T k="cs.title" as="h2" className="display-l mt-6 mb-12" />

          <ul className="flex flex-col">
            {TAXONOMY.map((t) => {
              const on = t.key === active;
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onMouseEnter={() => switchTo(t.key)}
                    onFocus={() => switchTo(t.key)}
                    onClick={() => switchTo(t.key)}
                    aria-pressed={on}
                    className="cs-item w-full cursor-pointer border-t border-[var(--glass-1-border)] py-5 text-left"
                    style={{
                      color: on ? 'var(--ink-1)' : 'var(--ink-3)',
                      paddingLeft: on ? '14px' : '0px',
                    }}
                  >
                    <span className="flex items-baseline justify-between gap-6">
                      <span className="editorial">{t.label}</span>
                      <span className="system">{t.en}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 右：当前空间的预览卡 */}
        <div className="lg:pl-10">
          <div className="cs-panel" data-fading={fading}>
            <div className="glass-2 relative aspect-[4/3] w-full overflow-hidden">
              {/* 底色光 */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 28% 22%, color-mix(in srgb, ${color} 22%, transparent), transparent 62%)`,
                }}
              />

              {/* 真实 owner 头像墙 */}
              <div className="absolute inset-0 p-6">
                {list.length ? (
                  <div className="grid h-full grid-cols-4 content-start gap-3">
                    {list.slice(0, 12).map((o, i) => (
                      <Avatar key={o.owner} owner={o.owner} name={o.name} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <T
                      k="cs.empty"
                      as="span"
                      className="system text-[var(--ink-4)]"
                      fade={false}
                    />
                  </div>
                )}
              </div>

              {/* 底部信息：压在头像墙上，用一层渐变保证可读 */}
              <div
                className="absolute inset-x-0 bottom-0 p-7"
                style={{
                  background:
                    'linear-gradient(to top, rgba(3,3,3,0.94) 0%, rgba(3,3,3,0.78) 55%, transparent 100%)',
                }}
              >
                <span className="system">{current.en.toUpperCase()}</span>
                <h3 className="display-l mt-3">{current.label}</h3>
                <T k={MATERIAL[current.key]} as="p" className="body mt-3 text-[var(--ink-2)]" />

                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link
                    href={`/c/${current.key}`}
                    className="data inline-flex items-center gap-2 text-[var(--ink-2)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
                    style={{ borderBottom: `1px solid ${color}`, paddingBottom: '2px' }}
                  >
                    <T k="cs.enter" as="span" fade={false} />
                    <span aria-hidden>→</span>
                  </Link>
                  {counts[current.key] ? (
                    <span className="data text-[var(--ink-4)]">
                      <T k="cs.reps" as="span" fade={false} vars={{ n: counts[current.key] }} />
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <p className="body mt-6 max-w-[46ch] text-[var(--ink-2)]">{current.tagline}</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** 头像：加载失败退回几何色块，不出现裂图。 */
function Avatar({ owner, name, index }: { owner: string; name: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const hue = index * 37;

  if (failed) {
    return (
      <span
        className="cs-avatar glass-1 flex aspect-square items-center justify-center"
        style={{ '--i': index } as React.CSSProperties}
        title={name}
      >
        <span
          className="block h-4 w-4 rounded-[2px]"
          style={{ background: `hsl(${hue} 18% 42%)`, transform: `rotate(${hue}deg)` }}
        />
      </span>
    );
  }

  return (
    <span
      className="cs-avatar glass-1 flex aspect-square items-center justify-center overflow-hidden"
      style={{ '--i': index } as React.CSSProperties}
      title={name}
    >
      <img
        src={`https://github.com/${owner}.png?size=96`}
        alt=""
        loading="lazy"
        decoding="async"
        width={48}
        height={48}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
        /* 压低亮度：这是背景墙，不是主角 */
        style={{ opacity: 0.72, filter: 'saturate(0.5)' }}
      />
    </span>
  );
}
