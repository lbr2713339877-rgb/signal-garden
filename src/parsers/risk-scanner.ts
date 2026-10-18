/**
 * Static risk scan over README, SKILL.md and manifests.
 *
 * What this is: pattern matching over documentation and declared tools, with
 * the matched line kept as evidence so a user can judge it themselves.
 *
 * What this is not: a security audit. Source code is not executed or
 * analysed. That is why a scan with no hits yields "unknown", never "safe" —
 * absence of evidence in a README is not evidence of safety.
 */

import type { RiskFlag, RiskId, RiskSeverity } from "./types";

interface Rule {
  id: RiskId;
  label: string;
  severity: RiskSeverity;
  re: RegExp;
}

const RULES: Rule[] = [
  { id: "remote_script", label: "执行远程脚本", severity: "high", re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z)?sh\b|\b(iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n]*\|\s*iex\b/i },
  { id: "unknown_binary", label: "下载未知二进制", severity: "high", re: /\b(curl|wget)\b[^\n]*\.(exe|dmg|pkg|msi|appimage|bin|deb|rpm)\b|chmod\s+\+x\s+\S+/i },
  { id: "system_privilege", label: "需要系统权限", severity: "high", re: /--privileged\b|full disk access|accessibility permissions?|辅助功能权限|完全磁盘访问/i },
  { id: "system_privilege", label: "需要系统权限", severity: "medium", re: /\bsudo\s+(?!apt(-get)?\s+install|brew|dnf\s+install|yum\s+install|pacman)\S+/i },
  { id: "shell_exec", label: "执行 Shell 命令", severity: "medium", re: /\b(child_process|subprocess\.(run|Popen|call)|os\.system|execSync)\b|\bspawn\(|executes? (arbitrary )?(shell|terminal) commands|runs? (shell|bash) commands|执行\s*(shell|终端)\s*命令/i },
  { id: "browser_control", label: "控制浏览器", severity: "medium", re: /\b(playwright|puppeteer|selenium|chrome devtools protocol|CDP)\b|controls? (your |the )?browser|浏览器(控制|自动化)/i },
  { id: "file_rw", label: "读写本地文件", severity: "medium", re: /\b(read|write|delete|modify|access)(s|es)?\b[^\n]{0,30}\b(local files?|files? on (your|the) (disk|machine|computer)|file ?system)\b|文件(读写|系统访问)/i },
  { id: "api_key_read", label: "读取 API Key", severity: "medium", re: /(reads?|loads?|uses?|access(es)?)\s[^\n]{0,20}(\.env\b|api[\s_-]?keys?|credentials|keychain)|process\.env\.[A-Z_]*(KEY|TOKEN|SECRET)|os\.environ\[?["'][A-Z_]*(KEY|TOKEN|SECRET)/i },
];

const TOOL_RISKS: [RegExp, RiskId, string][] = [
  [/^bash(\(|$)|^shell$|^terminal$/i, "shell_exec", "执行 Shell 命令"],
  [/^(write|edit|multiedit|notebookedit)$/i, "file_rw", "读写本地文件"],
  [/browser|playwright|puppeteer/i, "browser_control", "控制浏览器"],
];

export interface RiskInput {
  source: string;
  text: string;
  allowedTools?: string[];
}

export function scanRisks(
  inputs: RiskInput[],
  installScripts: { name: string; command: string }[] = [],
): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const perRule = new Map<string, number>();
  const add = (f: RiskFlag) => {
    const key = `${f.id}:${f.severity}`;
    const n = perRule.get(key) ?? 0;
    if (n >= 2) return; // two examples per rule are enough to make the point
    perRule.set(key, n + 1);
    flags.push({ ...f, snippet: f.snippet.slice(0, 140) });
  };

  for (const { source, text, allowedTools } of inputs) {
    const lines = text.slice(0, 60_000).split("\n");
    for (const rule of RULES) {
      const line = lines.find((l) => rule.re.test(l));
      if (line) add({ id: rule.id, label: rule.label, severity: rule.severity, source, snippet: line.trim() });
    }
    for (const tool of allowedTools ?? []) {
      for (const [re, id, label] of TOOL_RISKS) {
        if (re.test(tool.trim())) add({ id, label, severity: "medium", source, snippet: `allowed-tools: ${tool}` });
      }
    }
  }

  for (const s of installScripts) {
    add({ id: "install_script", label: "安装时执行脚本", severity: "medium", source: "package.json", snippet: `${s.name}: ${s.command}` });
  }

  const order: Record<RiskSeverity, number> = { high: 0, medium: 1 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * risk    — at least one high-severity pattern
 * review  — only medium patterns
 * unknown — nothing matched, or nothing scanned. Never "safe" from a doc scan.
 */
export function securityLevelFor(flags: RiskFlag[] | null): "risk" | "review" | "unknown" {
  if (!flags) return "unknown";
  if (flags.some((f) => f.severity === "high")) return "risk";
  if (flags.length) return "review";
  return "unknown";
}
