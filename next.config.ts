import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
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
