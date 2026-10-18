import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Noto Sans SC Regular, subset to Latin, punctuation, and GB2312
 * (~1.3MB, ~7.8k glyphs). One process-wide buffer so OG routes do not
 * re-read a full CJK face on a small VPS.
 */
let cached: Buffer | null = null;

export function ogFont(): Buffer {
  cached ??= readFileSync(join(process.cwd(), "src/lib/og/NotoSansSC-Regular.subset.woff"));
  return cached;
}
