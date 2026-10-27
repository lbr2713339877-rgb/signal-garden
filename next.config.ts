import type { NextConfig } from "next";
import { HTML_LIMITED_BOTS } from "./src/lib/html-limited-bots";
import { latestPublishedWeeklyIssue } from "./src/lib/weekly-sample";

/**
 * Bare `/weekly` follows the newest frozen issue. A page under `(site)` would
 * sit inside loading.tsx, and Next would answer 200 with the redirect only in
 * the RSC payload. Config redirects run first, stay a real 301, and keep the
 * query string. Adding the next issue to PUBLISHED_WEEKLY_ISSUES retargets
 * this; the path is not hardcoded here.
 */
function weeklyIndexRedirects(): { source: string; destination: string; statusCode: 301 }[] {
  const latest = latestPublishedWeeklyIssue();
  if (latest < 1) return [];
  return [{ source: "/weekly", destination: `/weekly/${latest}`, statusCode: 301 }];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Replaces Next's default list. Googlebot, Bingbot, and the social/AI
  // crawlers in HTML_LIMITED_BOTS receive metadata in the initial HTML
  // instead of a streamed follow-up.
  htmlLimitedBots: HTML_LIMITED_BOTS,
  async redirects() {
    return [
      ...weeklyIndexRedirects(),
      { source: "/pricing", destination: "/sponsor", permanent: true },
      { source: "/pricing/:path*", destination: "/sponsor", permanent: true },
      { source: "/subscription", destination: "/sponsor", permanent: true },
      { source: "/subscription/:path*", destination: "/sponsor", permanent: true },
      { source: "/subscribe", destination: "/#subscribe", permanent: true },
      { source: "/subscribe/", destination: "/#subscribe", permanent: true },
      { source: "/newsletter", destination: "/#subscribe", permanent: true },
      { source: "/newsletter/", destination: "/#subscribe", permanent: true },
    ];
  },
  // A middleware rewrite used the public host and failed behind the https
  // proxy (EPROTO to localhost). This stays inside Next and does not build
  // that absolute URL. The route still checks k against INDEXNOW_KEY.
  async rewrites() {
    return [
      { source: "/:key([0-9a-f]{32}).txt", destination: "/api/indexnow-key?k=:key" },
    ];
  },
  // PGlite ships a WASM binary; keep it external so Next does not try to
  // bundle it into the server build.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // The styleguide and archive pages render long lists of static content.
    optimizePackageImports: ["motion"],

    // viewTransition 暂时没有打开，虽然 §7 的共享元素需要它。
    //
    // 原因是它要求 Next 走 experimental React 通道
    // (next/dist/lib/needs-experimental-react.js)，而本项目锁定的是稳定版
    // React 19.3.0 —— 那里的 React.ViewTransition 只是一个 symbol 占位，不是
    // 真组件。实测（webpack 与 turbo 各一次、177 次采样）客户端导航期间没有
    // 产生任何 ::view-transition 动画。
    //
    // 但 ::view-transition-* 的样式和两端的 view-transition-name 已经写好并
    // 验证过：手动调用 document.startViewTransition 能正确产出
    // ::view-transition-group(project-title-<slug>) 等伪元素，说明 CSS 与配对
    // 都是对的。等升级到 experimental React 后，只需把这里改成 true。
    // viewTransition: true,
  },
};

export default nextConfig;
