/**
 * Connectivity check for the AI endpoint.
 *
 *   pnpm job ai-check
 *
 * Prints model, latency and token usage — never the key. Run this after
 * changing AI_MODEL or AI_BASE_URL.
 */

import { chat, aiConfig, aiUsage } from "@/ai/client";
import { log } from "./run";

export async function aiCheck(): Promise<boolean> {
  const cfg = aiConfig();
  log("ai-check", `endpoint ${cfg.base} · model ${cfg.model}`);

  const r = await chat({
    system: "你是技术编辑。只根据给定证据写作，证据里没有的内容不要写。",
    user:
      "证据：项目 browser-use/browser-use，116590 stars，许可证 MIT，语言 Python。README 写明用 pip install browser-use 安装，需要 LLM API Key。\n\n用一句 30-60 字的中文说明它是什么。",
    temperature: 0.2,
  });

  log("ai-check", `reply in ${(r.latencyMs / 1000).toFixed(1)}s · tokens in ${r.promptTokens} out ${r.completionTokens} · finish ${r.finishReason}`);
  console.log(`  model:     ${r.model}`);
  console.log(`  reply:     ${r.text.trim().slice(0, 200)}`);
  console.log(`  this run:  ${JSON.stringify(aiUsage())}`);
  return true;
}
