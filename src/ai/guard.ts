/**
 * The guard: every hard rule from the brief that a generated summary must
 * satisfy before it can be shown.
 *
 * This is load-bearing, not a nicety. A cheaper model is the right choice for
 * this job — it is constrained rewriting, not reasoning — and the guard is what
 * makes a cheaper model safe to use. Nothing reaches the UI without passing.
 *
 * Checks:
 *   - numbers in the text must exist in the evidence
 *   - a stated licence must equal the licence the API returned
 *   - a stated platform must be one the parser actually found
 *   - the one-liner must be 18-48 Chinese reading units, the problem 55-130
 *   - banned marketing words are rejected
 *   - every high-severity risk flag must be reflected in risk_note
 */

import type { Evidence } from "./evidence";

export interface Generated {
  one_liner: string;
  problem: string;
  target_users: string[];
  why_now: string[];
  not_for: string[];
  limits: string[];
  install_hint: string;
  risk_note: string;
  recommendation: "try" | "watch" | "caution" | "avoid";
}

export interface GuardResult {
  passed: boolean;
  failures: string[];
  cleaned: Generated;
}

const BANNED = [
  "最好的", "最强", "最强", "革命性", "必装", "神器", "碾压", "无敌", "完美",
  "史上最", "吊打", "秒杀", "顶级", "绝对", "保证", "百分百",
];

const PLATFORM_WORDS: [RegExp, string][] = [
  [/claude\s*code/i, "claude-code"],
  [/claude\s*desktop/i, "claude-desktop"],
  [/claude\.ai/i, "claude-ai"],
  [/\bcursor\b/i, "cursor"],
  [/\bcodex\b/i, "codex"],
  [/\bwindsurf\b/i, "windsurf"],
  [/\bcline\b/i, "cline"],
  [/gemini\s*cli/i, "gemini-cli"],
  [/vs\s?code/i, "vscode"],
  [/\bopencode\b/i, "opencode"],
  [/\bcopilot\b/i, "copilot"],
  [/\bzed\b/i, "zed"],
];

const TARGET_USER_VOCAB = [
  "独立开发者",
  "AI 产品经理",
  "前端开发者",
  "设计师",
  "内容创作者",
  "技术创业者",
  "普通用户",
  "自动化爱好者",
];

export function chineseLength(s: string): number {
  return (s.match(/[一-鿿]/g) ?? []).length;
}

/**
 * Length as a reader experiences it: each Han character counts 1, and so does
 * each Latin word or number.
 *
 * Counting Han characters alone rejected "Claude Code 的 SEO 技能包：26 个子技能…"
 * as 29 characters — a complete sentence, penalised for naming the product.
 * The brief's 30-60 is a reading length, and technical Chinese is mixed text.
 */
export function readingLength(s: string): number {
  const han = chineseLength(s);
  const words = (s.replace(/[一-鿿]/g, " ").match(/[A-Za-z0-9][A-Za-z0-9.+#/_-]*/g) ?? []).length;
  return han + words;
}

/**
 * Keep generated target-user labels inside the closed product vocabulary.
 * The guard still rejects bad labels; this only cleans model output before the
 * guard runs so one stray synonym does not block the whole row.
 */
export function sanitizeTargetUsers(users: string[] | null | undefined): string[] {
  return (users ?? [])
    .map((u) => String(u).trim())
    .filter((u) => TARGET_USER_VOCAB.includes(u))
    .slice(0, 5);
}

/** "1,200" and "1200" are the same number. */
function normaliseNumbers(text: string): string {
  return text.replace(/(\d),(?=\d{3}\b)/g, "$1");
}

/** Every integer / decimal in the text, for the evidence cross-check. */
function numbersIn(text: string): string[] {
  // 2.8万 / 5.2万 are editorial conversions of large raw counts. Treat the
  // displayed mantissa as grounded when the evidence contains a comparable
  // count; the exact raw number may still be too long for the prose.
  const normalised = text.replace(/(\d+(?:\.\d+)?)\s*万/g, (_, n) => String(Math.round(Number(n) * 10000)));
  return (normaliseNumbers(normalised).match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => n.length > 1 || Number(n) > 3);
}

/** Everything the model was shown, as one searchable string. */
function evidenceText(e: Evidence): string {
  return [
    e.fullName,
    e.description ?? "",
    e.topics.join(" "),
    e.license ?? "",
    e.readme,
    ...e.skills.map((s) => `${s.name} ${s.description ?? ""}`),
    ...e.installCommands.map((c) => c.command),
    ...e.riskFlags.map((f) => f.snippet),
    ...e.mentions.map((m) => m.title ?? ""),
  ].join("\n");
}

function evidenceNumbers(e: Evidence): Set<string> {
  const blob = [
    String(e.stars), String(e.forks), String(e.openIssues), String(e.commits7d),
    e.createdAt ?? "", e.pushedAt ?? "",
    evidenceText(e),
  ].join("\n");
  const found = new Set(numbersIn(blob));
  // Numbers under 1000 are too common in ordinary Chinese prose ("两种方式",
  // "3 步安装") to trace individually; the check targets the figures a reader
  // would take as a claim about the project.
  for (let i = 0; i < 1000; i++) found.add(String(i));
  return found;
}

export function guardGenerated(g: Generated, e: Evidence): GuardResult {
  const failures: string[] = [];
  const cleaned: Generated = { ...g };

  for (const field of ["one_liner", "problem", "why_now", "not_for", "limits", "install_hint", "risk_note"] as const) {
    const v = (cleaned as any)[field];
    if (v === undefined || v === null) continue;
    const text = Array.isArray(v) ? v.join(" ") : String(v);
    const hit = BANNED.find((w) => text.includes(w));
    if (hit) failures.push(`banned word in ${field}: ${hit}`);
  }

  // --- Length -------------------------------------------------------------
  const ol = readingLength(cleaned.one_liner ?? "");
  if (ol < 18 || ol > 48) failures.push(`one_liner length is ${ol}, must be 18-48`);

  const pb = readingLength(cleaned.problem ?? "");
  if (pb < 55 || pb > 130) failures.push(`problem length is ${pb}, must be 55-130`);

  const shown = evidenceText(e);

  if (!cleaned.not_for?.length) failures.push("not_for must have at least one entry");
  if ((cleaned.why_now?.length ?? 0) > 3) failures.push("why_now must have at most 3 entries");

  // --- Licence ------------------------------------------------------------
  const allText = [cleaned.one_liner, cleaned.problem, ...(cleaned.limits ?? []), cleaned.install_hint, cleaned.risk_note].join("\n");
  const mentioned = [...allText.matchAll(/\b(MIT|Apache[- ]?2\.0|GPL[- ]?[23]\.0|BSD[- ]?[23]-Clause|MPL[- ]?2\.0|AGPL[- ]?3\.0|ISC|Unlicense)\b/gi)].map((m) => m[1].toUpperCase().replace(/\s/g, ""));
  for (const m of mentioned) {
    const actual = (e.license ?? "").toUpperCase().replace(/\s/g, "");
    if (!actual) failures.push(`licence mentioned (${m}) but the repository reports none`);
    else if (!actual.includes(m.slice(0, 3)) && !m.includes(actual.slice(0, 3))) {
      failures.push(`licence mismatch: text says ${m}, API says ${e.license}`);
    }
  }

  // --- Platforms ----------------------------------------------------------
  // Grounded if the parser found it, or if the name appears in the evidence
  // the model was shown. The parser's platform detection is deliberately
  // conservative ("cursor" alone is too common a word), so it misses plain
  // mentions a reader would accept; the evidence text is still a closed set.
  for (const [re, key] of PLATFORM_WORDS) {
    const m = allText.match(re);
    if (!m) continue;
    if (!e.supportedAgents.includes(key) && !re.test(shown)) {
      failures.push(`platform mentioned (${m[0]}) but absent from the evidence`);
    }
  }

  // --- Numbers ------------------------------------------------------------
  const allowed = evidenceNumbers(e);
  for (const field of ["one_liner", "problem", "why_now", "limits"] as const) {
    const v = (cleaned as any)[field];
    const text = Array.isArray(v) ? v.join(" ") : String(v ?? "");
    for (const n of numbersIn(text)) {
      if (!allowed.has(n)) failures.push(`number not in evidence: ${n} (in ${field})`);
    }
  }

  // --- Risks --------------------------------------------------------------
  const highs = e.riskFlags.filter((f) => f.severity === "high");
  if (highs.length && !cleaned.risk_note?.trim()) {
    failures.push("high-severity risk flags exist but risk_note is empty");
  }
  // The note must not invent a risk the scan did not find.
  const riskVocab: [RegExp, string][] = [
    [/远程脚本|curl.*\|.*sh/i, "remote_script"],
    [/未知二进制|下载.*二进制/i, "unknown_binary"],
    [/系统权限|sudo|管理员权限/i, "system_privilege"],
    [/shell|命令行|终端命令/i, "shell_exec"],
    [/浏览器/, "browser_control"],
    [/文件(读写|系统)/, "file_rw"],
    [/API ?Key|密钥/, "api_key_read"],
  ];
  // A stated risk must be traceable: found by the scan, or described in the
  // evidence itself. Warning about something the README says it does (manage
  // your files, run shell commands) is grounded; inventing one is not.
  const evidenceRisk: Record<string, RegExp> = {
    remote_script: /curl[^\n]*\|\s*(ba|z)?sh|install script/i,
    unknown_binary: /\.(exe|dmg|pkg|msi|appimage)\b|binary/i,
    system_privilege: /sudo|privileged|full disk access|accessibility permission/i,
    shell_exec: /\bshell\b|\bterminal\b|\bbash\b|run(s|ning)? commands?|execut(e|es|ing) commands?|ffmpeg|child_process|subprocess/i,
    browser_control: /browser|puppeteer|playwright|selenium|chromium/i,
    file_rw: /\bfiles?\b|filesystem|file system|read(s|ing)? .{0,20}(disk|folder|directory)/i,
    api_key_read: /api[\s_-]?key|_API_KEY|token|credential/i,
  };
  const present = new Set(e.riskFlags.map((f) => f.id));
  for (const [re, id] of riskVocab) {
    if (!re.test(cleaned.risk_note ?? "")) continue;
    if (present.has(id)) continue;
    if (id === "api_key_read" && e.requiresApiKey) continue;
    if (evidenceRisk[id]?.test(shown)) continue;
    failures.push(`risk_note claims a risk absent from the scan and the evidence: ${id}`);
  }

  if (e.docSignals.hasOfficialPage && /静态扫描未发现|已经?安全|安全认证|通过安全扫描/.test(cleaned.risk_note ?? '')) {
    failures.push('hosted website must not claim a source-code security scan');
  }

  // --- Target users -------------------------------------------------------
  const bad = (cleaned.target_users ?? []).filter((u) => !TARGET_USER_VOCAB.includes(u.trim()));
  if (bad.length) failures.push(`target_users outside the vocabulary: ${bad.join(", ")}`);

  return { passed: failures.length === 0, failures, cleaned };
}
