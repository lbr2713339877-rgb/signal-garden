/**
 * Focus parsing helpers shared by the parser (normalizers/analyze) and the
 * refocus job, so both decide "is this in scope" the same way.
 */

import { FOCUS_MIN, scoreFocus, type FocusTheme } from "./focus";

export interface FocusParse {
  themes: FocusTheme[];
  score: number;
  evidence: Record<string, string[]>;
  inFocus: boolean;
}

export function parseFocus(input: {
  name: string;
  description: string | null;
  topics: string[];
  readme?: string | null;
  skillTexts?: string[];
  queries?: string[];
}): FocusParse {
  const r = scoreFocus(input);
  return { themes: r.themes, score: r.score, evidence: r.evidence, inFocus: r.score >= FOCUS_MIN };
}
