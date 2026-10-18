/**
 * OpenAI-compatible chat client over plain fetch.
 *
 * Works with any relay that exposes /v1/chat/completions. Model, endpoint and
 * key come from the environment, so switching model is a one-line .env change.
 *
 * Guard rails:
 *   - AI_MAX_CALLS_PER_RUN caps calls per process, so a bug cannot drain credit
 *   - max_tokens caps each reply (reasoning models otherwise ramble)
 *   - retries only on 429 / 5xx / network errors
 * The key is never logged.
 */

import { sleep } from "@/lib/concurrency";

export class AiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
    this.name = "AiError";
  }
}

export function aiConfig() {
  const base = (process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.AI_API_KEY ?? "";
  const model = process.env.AI_MODEL ?? "";
  if (!base || !key || !model) throw new AiError("AI_BASE_URL, AI_API_KEY and AI_MODEL must be set");
  return {
    base,
    key,
    model,
    temperature: Number(process.env.AI_TEMPERATURE ?? 0.2),
    maxCalls: Number(process.env.AI_MAX_CALLS_PER_RUN ?? 120),
  };
}

let calls = 0;
const usage = { promptTokens: 0, completionTokens: 0 };

export function aiUsage() {
  return { calls, ...usage };
}

export interface ChatOptions {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  /** "stop" normally; "length" means the reply was cut off by max_tokens. */
  finishReason: string | null;
}

/**
 * Reasoning models (kimi-k3 among them) spend hidden reasoning tokens out of
 * the same max_tokens budget as the visible reply. A budget sized for the
 * answer alone gets consumed by reasoning and returns empty content with
 * finish_reason "length" — observed: 797 of 800 tokens spent reasoning. The
 * default is sized for reasoning plus answer; cost follows actual use, not
 * the ceiling.
 */
const DEFAULT_MAX_TOKENS = 4000;
const RETRY_MAX_TOKENS = 8000;

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const cfg = aiConfig();
  if (calls >= cfg.maxCalls) throw new AiError(`AI call budget reached (${cfg.maxCalls} per run)`);
  calls++;

  const body = JSON.stringify({
    model: cfg.model,
    temperature: opts.temperature ?? cfg.temperature,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`${cfg.base}/chat/completions`, {
        method: "POST",
        body,
        signal: AbortSignal.timeout(120_000),
        headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      });
    } catch (err) {
      if (attempt === 2) throw new AiError(`AI request failed: ${err instanceof Error ? err.message : err}`);
      await sleep(2_000 * 2 ** attempt);
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 3_000 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AiError(`AI ${res.status}: ${text.slice(0, 300)}`, res.status);
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    const text: string = choice?.message?.content ?? "";
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    usage.promptTokens += promptTokens;
    usage.completionTokens += completionTokens;
    return {
      text,
      model: data.model ?? cfg.model,
      latencyMs: Date.now() - started,
      promptTokens,
      completionTokens,
      finishReason: choice?.finish_reason ?? null,
    };
  }
  throw new AiError("AI request failed after retries");
}

function parseJson<T>(text: string): T | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

/**
 * Chat in JSON mode and parse the reply. Tolerates a ```json fence.
 * A reply truncated by max_tokens is retried once with a larger budget;
 * any other unparseable reply is an error, not a retry.
 */
export async function chatJson<T>(opts: Omit<ChatOptions, "json">): Promise<{ data: T; result: ChatResult }> {
  let result = await chat({ ...opts, json: true });
  let data = parseJson<T>(result.text);

  if (data === null && result.finishReason === "length") {
    result = await chat({ ...opts, json: true, maxTokens: RETRY_MAX_TOKENS });
    data = parseJson<T>(result.text);
  }

  if (data === null) {
    const why = result.finishReason === "length" ? "truncated by max_tokens" : "non-JSON";
    throw new AiError(`AI reply ${why}: ${result.text.trim().slice(0, 160)}`);
  }
  return { data, result };
}
