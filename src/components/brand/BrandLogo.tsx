/**
 * Signal Garden 品牌标识
 *
 * 圆环几何（对照品牌图重新推算过，不是随手画的弧）：
 * - viewBox 28×28，圆心 (14,14)，半径 10，描边 2.6
 * - 两段 130° 弧，两个 50° 角向缺口
 * - 缺口中心在右上 (-45°) 和左下 (135°)，即对角分布
 *
 * 为什么是 130° 而不是 140°：线端是圆帽，圆帽会向外多画半根描边
 * （1.3px，在 r=10 处约等于 7.4°），所以角向留 50° 才能得到视觉上
 * 约 35° 的缺口。直接按 40° 画，圆帽会把它吃掉一半。
 *
 * 字标用 HTML 文本，不用 SVG <text>。SVG 里没有 letter-spacing 的
 * 可靠跨浏览器行为，字体一旦加载失败两个字就会叠在一起 —— 之前那版
 * 就是这个毛病。HTML 文本 + CSS letter-spacing 没有这个问题。
 *
 * 尺寸：整组宽约 180px，图标 24px，图标与字标间距 22px。
 * 落在 brief 要求的 150–190px / 20–26px / 20–28px 区间内。
 */

const RING_VIEWBOX = '0 0 28 28';

/** 弧 A：右上缺口下沿 → 左下缺口上沿（经过右侧与底部） */
const ARC_A = 'M23.397 10.58A10 10 0 0 1 10.58 23.397';
/** 弧 B：左下缺口下沿 → 右上缺口上沿（经过左侧与顶部） */
const ARC_B = 'M4.603 17.42A10 10 0 0 1 17.42 4.603';

interface BrandLogoProps {
  variant?: 'full' | 'icon';
  /** dark = 深色底，用暖白标；light = 浅色底，用近黑标 */
  theme?: 'dark' | 'light';
  className?: string;
}

const COLOR = { dark: '#F2F0EA', light: '#050505' } as const;

/** 仅圆环。AnimatedBrandLogo 复用它。 */
export function RingMark({
  color,
  size = 24,
  animated = false,
}: {
  color: string;
  size?: number;
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={RING_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="brand-ring"
      aria-hidden
      focusable="false"
    >
      {[
        { d: ARC_A, delay: '0ms' },
        { d: ARC_B, delay: '120ms' },
      ].map((arc, i) => (
        <path
          key={i}
          d={arc.d}
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          {...(animated
            ? {
                pathLength: 1,
                strokeDasharray: 1,
                strokeDashoffset: 1,
                style: { animationDelay: arc.delay },
                className: 'brand-arc',
              }
            : {})}
        />
      ))}
    </svg>
  );
}

export function BrandLogo({
  variant = 'full',
  theme = 'dark',
  className = '',
}: BrandLogoProps) {
  const color = COLOR[theme];

  return (
    <span className={`inline-flex items-center gap-[22px] ${className}`}>
      <RingMark color={color} size={24} />

      {variant === 'full' && (
        <span
          className="brand-wordmark whitespace-nowrap uppercase"
          style={{
            color,
            fontSize: '11px',
            fontWeight: 300,
            letterSpacing: '0.34em',
            lineHeight: 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Signal Garden
        </span>
      )}
    </span>
  );
}

/**
 * 首屏加载用：先画弧，再出字标。
 *
 * 600–900ms ease-out；缺口全程保留 —— 因为画的是一条完整弧的路径长度，
 * 不是把圆环一点点擦出来。Reduced-motion 下直接给终态，不做描边动画。
 */
export function AnimatedBrandLogo(props: BrandLogoProps) {
  const color = COLOR[props.theme ?? 'dark'];

  return (
    <span className="brand-animated inline-flex items-center gap-[22px]">
      <style>{`
        @keyframes brand-draw {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes brand-wordmark-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .brand-animated .brand-arc {
          animation: brand-draw 0.75s var(--e-v3, cubic-bezier(0.22,1,0.36,1)) forwards;
        }
        .brand-animated .brand-wordmark {
          opacity: 0;
          animation: brand-wordmark-in 0.32s ease-out 0.6s forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .brand-animated .brand-arc {
            animation: none;
            stroke-dashoffset: 0;
          }
          .brand-animated .brand-wordmark {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>

      <RingMark color={color} size={24} animated />

      {props.variant !== 'icon' && (
        <span
          className="brand-wordmark whitespace-nowrap uppercase"
          style={{
            color,
            fontSize: '11px',
            fontWeight: 300,
            letterSpacing: '0.34em',
            lineHeight: 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Signal Garden
        </span>
      )}
    </span>
  );
}
