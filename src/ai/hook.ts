/**
 * Hooks — the one line that makes someone stop.
 *
 * V2 requires every item to carry one, drawn from four shapes: a number, a
 * counter-intuitive claim, a named audience, or a comparison.
 *
 * Two rules from the brief shape this module:
 *
 *   "Hook 必须双语各生成一次，不做机翻直译，按各自语言习惯重写"
 *
 * So a hook is generated in both languages in a single call, by asking for two
 * native lines rather than one line and a translation. Literal translation of a
 * hook reads like a translation; the shapes differ between languages anyway
 * ("做 X 的人今天都在传这个" has no natural English equivalent).
 *
 * A hook is still subject to the same evidence rule as every other generated
 * field: it may not contain a number, licence or platform that the parser did
 * not find. A hook that invents a striking figure is a lie with a bigger font.
 */

import { chatJson } from "./client";
import { renderEvidence, type Evidence } from "./evidence";

export type HookType = "number" | "effect" | "counterintuitive" | "audience" | "comparison";
export const HOOK_TYPES: HookType[] = ["number", "effect", "counterintuitive", "audience", "comparison"];

/**
 * Five shapes for the stop-line. The "effect" shape is the one the brief asked
 * for: a vivid, slightly exaggerated promise of what the project does to your
 * work ("把你的网页变得像德芙一样丝滑"). Every shape gets two examples so the
 * model stops collapsing onto a single template — an earlier version showed one
 * rhetorical example ("...凭什么") and the whole catalogue came out as "凭什么".
 */
export const HOOK_SHAPES: Record<HookType, { zh: string; en: string }> = {
  number: {
    zh: "数字型：用一个真实数字制造反差。例：3 天 8000 star，这个动画库把滚动做成了艺术 / 只有 300KB，却替掉了三个付费服务",
    en: 'Number: a concrete figure that surprises. e.g. "8,000 stars in 3 days and it is still one file" / "300KB and it replaces three paid services"',
  },
  effect: {
    zh: "效果型（首选）：把「它能帮你做成什么」写得具体、有画面感、可以适度夸张。例：2 万 star 的滚动库，能让你的网页滑得像德芙一样 / 一行代码，让长页面不再让人想关掉",
    en: 'Effect (prefer this): make the outcome vivid and a little exaggerated. e.g. "A 20k-star scroll library that makes your site feel like butter" / "One line and your long page stops losing readers"',
  },
  counterintuitive: {
    zh: "反常识型：说出与直觉相反的结论。例：不用写代码，10 分钟把独立站搭上线 / 越少的动画，用户越觉得快",
    en: 'Counter-intuitive: the opposite of what people assume. e.g. "No code, live in 10 minutes" / "Less animation makes it feel faster"',
  },
  audience: {
    zh: "人群型：点名一群具体的人。例：做独立站的人，最近都在换这个 / 前端在改滚动效果时第一个想到它",
    en: 'Audience: name a specific group. e.g. "Everyone shipping landing pages switched to this" / "The first thing front-end devs reach for when fixing scroll"',
  },
  comparison: {
    zh: "对比型：与一个熟悉的东西对比。例：Figma 的免费平替 / 像 Stripe 的文档，但用来做动画",
    en: 'Comparison: against something familiar. e.g. "The free alternative to Figma" / "Stripe-docs polish, but for animation"',
  },
};

export interface BilingualHook {
  hookZh: string;
  hookEn: string;
  hookType: HookType;
}

export interface EnglishCopy {
  oneLiner: string;
  problem: string;
  targetUsers: string[];
  whyNow: string[];
  notFor: string[];
  capabilities: string[];
  installHint: string;
  riskNote: string;
}

const SYSTEM = `你是「Signal Garden」的编辑，同时用中文和英文写作。

铁律：
1. 只能使用给定证据里的事实。证据里没有的数字、许可证、平台、依赖，一律不许出现。
2. hook 不是广告词。不要用「最强 / 神器 / 必装 / 完美 / 革命性 / 绝对」这类词，也不要用英文的 best / ultimate / must-have / revolutionary / game-changer。
3. 中英两句要各自成立，不要逐字翻译。英文按英文的习惯写。
4. 中文里保留项目名、产品名和 skill、AI、LLM、MCP、CLI、API、SDK、GitHub、TypeScript 等外来词；不要硬翻。
5. 只输出 JSON，不要解释。`;

interface RawHook {
  hook_zh: string;
  hook_en: string;
  hook_type: string;
}

/**
 * Generates both hooks in one call. Returns null when the reply is unusable,
 * so the caller can ship a project without a hook rather than with a bad one.
 */
/** Templates that made the catalogue read as one repeated sentence. */
const BANNED_HOOK_TEMPLATE = /凭什么|今天都在传|免费平替/;

export async function generateHook(e: Evidence): Promise<BilingualHook | null> {
  const shapes = HOOK_TYPES.map(
    (k) => `- ${k}\n  中文写法：${HOOK_SHAPES[k].zh}\n  English: ${HOOK_SHAPES[k].en}`,
  ).join("\n");

  try {
    const { data } = await chatJson<RawHook>({
      system: SYSTEM,
      user: `${renderEvidence(e)}

任务：给这个项目写一句 hook，让人想点进去。

先从下面五种里选最合适的一种：
${shapes}

选择偏好：
- 如果一个库/工具能带来直观的效果，优先用 effect 型，把效果写得有画面感。
- 只有证据里有真实数字时才用 number 型。
- 不要默认使用「凭什么」这种反问句式；一句里最多一次修辞，不要每句都一个模板。

要求：
- hook_zh：不超过 40 个汉字，用一句自然的中文说清「它能帮你做成什么」，不夸张；不要把作者的效果宣称写成本站验证的结论
- hook_en：不超过 120 字符，用英文母语者的表达习惯写，不要翻译中文那句
- hook_type：上面五个 key 之一

输出 JSON: {"hook_zh":"...","hook_en":"...","hook_type":"effect"}`,
      temperature: 0.5,
    });

    const type = (HOOK_TYPES as string[]).includes(data.hook_type)
      ? (data.hook_type as HookType)
      : "number";

    let hookZh = (data.hook_zh ?? "").trim();
    const hookEn = (data.hook_en ?? "").trim();
    if (!hookZh || !hookEn) return null;

    /* A templated hook is a failed hook. Re-ask once, naming the banned shape
       and pointing at the effect style, then keep whatever comes back. */
    if (BANNED_HOOK_TEMPLATE.test(hookZh)) {
      try {
        const retry = await chatJson<RawHook>({
          system: SYSTEM,
          user: `${renderEvidence(e)}

刚才那句用了「${hookZh.match(BANNED_HOOK_TEMPLATE)?.[0]}」这种被用滥的模板，换一种写法重写。

优先用 effect 型：一句话说清「它能帮你做成什么」，具体、有画面感，不夸张，不用比喻替代实际用途。
不要用「凭什么」「今天都在传」「免费平替」这三个句式。

要求：hook_zh 不超过 40 个汉字；hook_en 不超过 120 字符，用英文习惯写；只输出 JSON。
输出 JSON: {"hook_zh":"...","hook_en":"...","hook_type":"effect"}`,
          temperature: 0.8,
        });
        const retryZh = (retry.data.hook_zh ?? "").trim();
        const retryEn = (retry.data.hook_en ?? "").trim();
        if (retryZh && retryEn && !BANNED_HOOK_TEMPLATE.test(retryZh)) {
          hookZh = retryZh;
          return {
            hookZh,
            hookEn: retryEn,
            hookType: (HOOK_TYPES as string[]).includes(retry.data.hook_type)
              ? (retry.data.hook_type as HookType)
              : "effect",
          };
        }
      } catch {
        // fall through and keep the original
      }
    }

    return { hookZh, hookEn, hookType: type };
  } catch {
    return null;
  }
}

/**
 * English copy for the same project, written natively rather than translated.
 * The v1 pipeline only produced Chinese; V2 stores both locales per item.
 */
const EN_BANNED_CAPABILITY = /\b(agents?|workflows?|providers?|mcp|sdk|framework|api|cli|middleware|orchestrat\w*|end-to-end|skills?|routers?)\b/i;

function softenEnglishCapability(x: string): string {
  return x
    .replace(/\bagents?\b/gi, 'helpers')
    .replace(/\bworkflows?\b/gi, 'steps')
    .replace(/\bproviders?\b/gi, 'model sources')
    .replace(/\bMCP\b/g, 'the shared setup')
    .replace(/\bSDKs?\b/g, 'toolkits')
    .replace(/\bframeworks?\b/gi, 'toolkit')
    .replace(/\bAPIs?\b/g, 'interface')
    .replace(/\bCLIs?\b/g, 'command line')
    .replace(/\bskills?\b/gi, 'helpers')
    .replace(/\brouters?\b/gi, 'switching')
    .replace(/\bsupports\b/gi, 'lets you')
    .replace(/\bbased on\b/gi, 'using')
    .replace(/\bpowered by\b/gi, 'using')
    .replace(/\bend-to-end\b/gi, 'complete');
}

function cleanEnglishCapabilities(raw: unknown): string[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x) => softenEnglishCapability(String(x).trim()))
    .filter(Boolean)
    .filter((x) => !EN_BANNED_CAPABILITY.test(x))
    .filter((x) => x.split(/\s+/).length <= 12)
    .slice(0, 5);
}



export async function generateEnglishCapabilities(e: Evidence): Promise<string[]> {
  try {
    const { data } = await chatJson<{ capabilities: string[] }>({
      system: SYSTEM,
      user: `${renderEvidence(e)}

Task: write "What it helps you do" in plain English.
- Write 3-5 short results only, one line each.
- Start with a verb, say what the user can do, never describe implementation.
- Do not use: agent, workflow, provider, MCP, SDK, framework, API, CLI, middleware, orchestration, end-to-end, skill, router, supports, based on, powered by, seamless, unlock. Use everyday words instead.
- Only use facts from the evidence. Do not invent features.

Output JSON: {"capabilities":["...","...","..."]}`,
      temperature: 0.35,
    });
    return cleanEnglishCapabilities(data.capabilities);
  } catch {
    return [];
  }
}

export async function generateEnglish(e: Evidence, hookEn: string | null): Promise<EnglishCopy | null> {
  try {
    const { data } = await chatJson<{
      one_liner: string;
      problem: string;
      target_users: string[];
      why_now: string[];
      not_for: string[];
      capabilities: string[];
      install_hint: string;
      risk_note: string;
    }>({
      system: SYSTEM,
      user: `${renderEvidence(e)}

Task: write plain-English copy for this project. Write native English prose — do not translate from another language. Sound like a knowledgeable friend, not a product page.

- one_liner: 40-160 characters. One sentence saying what it is and who it helps.
- problem: 200-600 characters. What it helps someone do, and who needs it.
- target_users: 1-5 short plain-English phrases. Who would actually use this?
- why_now: 1-3 short plain-English facts from the evidence.
- not_for: 1-3 short plain-English phrases. Who should skip it?
- capabilities: 3-5 short results, one line each, <= 12 English words. Start with a verb. Say what the user can do; never describe the implementation.
  For capabilities only, do not use these words: agent, workflow, provider, MCP, SDK, framework, API, CLI, middleware, orchestration, end-to-end, skill, router, supports, based on, powered by, seamless, unlock. Use everyday words instead.
- install_hint: one plain-English sentence based only on the evidence's install commands.
- risk_note: one or two plain-English sentences about the static scan result. If no risk was found, say the scan found no obvious risk, but that does not prove it is safe.
${hookEn ? `\nThe hook line already written for this project is: "${hookEn}" — the copy should feel consistent with it but not repeat it.` : ""}

Output JSON: {"one_liner":"...","problem":"...","target_users":[],"why_now":[],"not_for":[],"capabilities":[],"install_hint":"...","risk_note":"..."}`,
      temperature: 0.3,
    });

    const oneLiner = (data.one_liner ?? "").trim();
    const problem = (data.problem ?? "").trim();
    if (!oneLiner || !problem) return null;
    return {
      oneLiner,
      problem,
      targetUsers: (data.target_users ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 5),
      whyNow: (data.why_now ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3),
      notFor: (data.not_for ?? []).map((x) => String(x).trim()).filter(Boolean).slice(0, 5),
      capabilities: cleanEnglishCapabilities(data.capabilities),
      installHint: (data.install_hint ?? "").trim(),
      riskNote: (data.risk_note ?? "").trim(),
    };
  } catch {
    return null;
  }
}
