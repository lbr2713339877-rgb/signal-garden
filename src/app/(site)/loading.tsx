/**
 * 路由级骨架屏。
 *
 * 这里原本渲染 V2 的 PageShell + HomeSkeleton（顶栏 + 卡片网格）。V3 成为首页
 * 之后，每次客户端导航都会先闪一下那个 V2 骨架，再换成 V3 的黑场 —— 视觉上
 * 是一次明显的跳变。
 *
 * 现在换成一个与两种视觉都能共存的极简骨架：深色底 + 一层极淡的呼吸。
 * V2 页面本身就是深色，V3 更是纯黑场，所以这个骨架对两边都不突兀。
 *
 * 不做成"像真内容的占位卡片"是有意的：V3 的第一屏本来就是纯黑 300ms，
 * 骨架屏跟着黑场比跟着卡片更接近真实观感。
 *
 * 这个文件放在 (site) 而不是 app 根上：根上的 loading.tsx 会包住 /p 和
 * /feedback。Next 这时把 permanentRedirect / notFound 渲成 HTTP 200，只在
 * RSC payload 里放 NEXT_REDIRECT。旧 slug 必须是真正的 308，未知 slug 必须是
 * 真正的 404，所以那两条路由留在这个 Suspense 边界外面。
 */

export default function Loading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-void,#030303)]">
      <style>{`
        .route-skeleton-pulse {
          animation: rs-breathe 1.8s ease-in-out infinite;
        }
        @keyframes rs-breathe {
          0%, 100% { opacity: 0.18; }
          50%      { opacity: 0.42; }
        }
        @media (prefers-reduced-motion: reduce) {
          .route-skeleton-pulse { animation: none; opacity: 0.3; }
        }
      `}</style>

      <span
        aria-hidden
        className="route-skeleton-pulse block h-[2px] w-[72px]"
        style={{ background: 'var(--ink-3, rgba(242,240,234,0.32))' }}
      />
      <span className="sr-only">加载中</span>
    </div>
  );
}
