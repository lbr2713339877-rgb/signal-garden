import { test } from "node:test";
import assert from "node:assert/strict";
import { chineseLength, guardGenerated, readingLength, type Generated } from "./guard";
import type { Evidence } from "./evidence";

function evidence(over: Partial<Evidence> = {}): Evidence {
  return {
    fullName: "acme/tool",
    name: "tool",
    url: "https://github.com/acme/tool",
    description: "A React component library with OKLab colour support",
    topics: ["design", "tailwind"],
    license: "MIT",
    language: "TypeScript",
    stars: 1200,
    forks: 40,
    openIssues: 12,
    commits7d: 9,
    createdAt: "2026-08-01",
    pushedAt: "2026-09-20",
    skillType: "skill",
    supportedAgents: ["claude-code"],
    installCommands: [{ kind: "npm", command: "npm i acme-tool" }],
    requiresApiKey: false,
    requiresLocalRuntime: false,
    requiresDocker: false,
    difficulty: "simple_config",
    securityLevel: "review",
    riskFlags: [],
    skills: [{ name: "theming", description: "Provides a theme" }],
    readme: "Install with npm i acme-tool. Works with Claude Code and Cursor.",
    mentions: [],
    docSignals: {},
    ...over,
  };
}

/** A well-formed object that passes cleanly, as the baseline to mutate. */
function good(over: Partial<Generated> = {}): Generated {
  return {
    one_liner: "一个提供 OKLab 色彩支持的 React 组件库，可以用 Tailwind 主题快速搭建界面，并支持服务端渲染。",
    problem:
      "前端项目在搭建界面时，往往要自己处理配色、主题与组件样式的一致性，重复劳动很多，稍有偏差就会显得不统一。这个库把常见的界面元素和色彩体系做成可以直接复用的组件，让开发者把时间放在页面结构上，而不是反复调整颜色、间距和状态样式。",
    target_users: ["前端开发者"],
    why_now: ["近 7 天有 9 次提交"],
    not_for: ["不需要组件库的原生应用"],
    limits: ["需要 Tailwind 环境"],
    install_hint: "npm i acme-tool",
    risk_note: "静态扫描未发现明显风险，但不代表安全。",
    recommendation: "try",
    ...over,
  };
}

test("length counts Han characters and Latin words, not Han alone", () => {
  assert.equal(chineseLength("Claude Code 的 SEO 技能包"), 4);
  // "Claude" "Code" "SEO" = 3 words, plus 4 Han, plus the number 26 counts too.
  assert.equal(readingLength("Claude Code 的 SEO 技能包"), 7);
  assert.equal(readingLength("一条命令抓取任意网站的设计系统"), 15);
});

test("a good object passes the guard", () => {
  const r = guardGenerated(good(), evidence());
  assert.equal(r.passed, true, JSON.stringify(r.failures));
});

test("banned marketing words are rejected", () => {
  const r = guardGenerated(good({ one_liner: "这是最强的 React 组件库，必装神器，完美解决配色问题，绝对推荐。" }), evidence());
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.includes("banned word")));
});

test("a number absent from the evidence is rejected", () => {
  const r = guardGenerated(good({ one_liner: "支持 4821 个组件的 React 库，可以快速搭建界面。" }), evidence());
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.includes("not in evidence")), JSON.stringify(r.failures));
});

test("numbers that are present in the evidence are allowed", () => {
  const e = evidence({ readme: "Install with npm i acme-tool. It ships 4821 components." });
  const r = guardGenerated(good({ one_liner: "内置 4821 个组件的 React 库，可以用 Tailwind 主题快速搭建界面，支持服务端渲染与暗色模式。" }), e);
  assert.equal(r.passed, true, JSON.stringify(r.failures));
});

test("a licence the API did not report is rejected", () => {
  const r = guardGenerated(good({ limits: ["该项目以 AGPL-3.0 发布"] }), evidence({ license: null }));
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.includes("licence")), JSON.stringify(r.failures));
});

test("a licence that matches the API is allowed", () => {
  const r = guardGenerated(good({ limits: ["以 MIT 许可证发布"] }), evidence());
  assert.equal(r.passed, true, JSON.stringify(r.failures));
});

test("a platform named in the README is grounded even if the parser missed it", () => {
  const r = guardGenerated(good({ one_liner: "支持 Cursor 的 React 组件库，可以用 Tailwind 主题快速搭建界面，并支持服务端渲染与暗色模式。" }), evidence());
  assert.equal(r.passed, true, JSON.stringify(r.failures));

  // But a platform nobody mentioned is still invented.
  const bad = guardGenerated(good({ one_liner: "支持 Windsurf 的 React 组件库，可以用 Tailwind 主题快速搭建界面，并支持服务端渲染与暗色模式。" }), evidence());
  assert.equal(bad.passed, false);
  assert.ok(bad.failures.some((f) => f.includes("Windsurf")), JSON.stringify(bad.failures));
});

test("a high-severity scan finding must appear in the risk note", () => {
  const e = evidence({
    securityLevel: "risk",
    riskFlags: [{ id: "remote_script", label: "执行远程脚本", severity: "high", snippet: "curl x | bash" }],
  });
  const empty = guardGenerated(good({ risk_note: "" }), e);
  assert.equal(empty.passed, false);
  assert.ok(empty.failures.some((f) => f.includes("risk_note is empty")));

  const stated = guardGenerated(good({ risk_note: "文档中包含通过 curl 管道执行远程脚本的安装方式，建议先阅读脚本内容。" }), e);
  assert.equal(stated.passed, true, JSON.stringify(stated.failures));
});

test("a risk grounded in the README is allowed even if the scanner missed it", () => {
  const e = evidence({ readme: "This tool manages your files and can run shell commands for you." });
  const r = guardGenerated(good({ risk_note: "该工具会读写本地文件并执行 shell 命令，建议在受控环境中使用。" }), e);
  assert.equal(r.passed, true, JSON.stringify(r.failures));
});

test("a risk nobody described is rejected", () => {
  const e = evidence({ readme: "A pure CSS utility with no runtime." });
  const r = guardGenerated(good({ risk_note: "该工具会读取你的 API Key 并上传到服务器。" }), e);
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.includes("risk_note claims")), JSON.stringify(r.failures));
});

test("target users must come from the vocabulary", () => {
  const r = guardGenerated(good({ target_users: ["运维工程师"] }), evidence());
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.includes("vocabulary")));
});

test("not_for needs at least one entry and why_now at most three", () => {
  assert.equal(guardGenerated(good({ not_for: [] }), evidence()).passed, false);
  const four = guardGenerated(good({ why_now: ["a", "b", "c", "d"] }), evidence());
  assert.equal(four.passed, false);
  assert.ok(four.failures.some((f) => f.includes("why_now")));
});
