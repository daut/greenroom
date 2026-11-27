import { z } from "zod";
import type { Clip } from "./clips";
import type { SpokenLine } from "./metrics";
import type { Finding, RubricCriterion } from "./report";

export const AUDIO_REVIEW_MODEL_SUGGESTIONS = ["gpt-audio-1.5"];

export const UNDERSTANDABILITY: RubricCriterion = {
  id: "understandability",
  label: "Understandability",
  description:
    "Easy to understand by ear: clear sounds, word stress and endings, no mumbling or rushing. Scored from the recording.",
  fromAudio: true,
};

export const PRONUNCIATION_SYSTEM =
  "You are a speech coach listening to recordings of a professional speaking English. You judge how easy they are to understand from the audio itself, not from the transcript. Be specific and kind.";

const MAX_WORDS = 5;

export const pronunciationSchema = z.object({
  understandability: z.number().int().min(0).max(100),
  summary: z.string(),
  words: z.array(
    z.object({
      /** 1-based transcript line number, as in the clip labels. */
      line: z.number().int().min(0),
      word: z.string(),
      heard: z.string(),
      target: z.string(),
      tip: z.string(),
      severity: z.number().int().min(1).max(3),
      habit: z.string(),
      recurring: z.boolean(),
    }),
  ),
});
export type PronunciationReply = z.infer<typeof pronunciationSchema>;

/** What the report keeps from the audio review. */
export interface PronunciationReview {
  understandability: number;
  summary: string;
  /** Flagged words, for underlining in the replay. `line` indexes the run's lines. */
  words: { line: number | null; word: string; heard: string; target: string }[];
  costUsd: number;
}

/** What an audio model said about some clips, or why it wasn't asked. */
export type AudioCheck<T> = { ok: true; reply: T; costUsd: number } | { ok: false; reason: string };

/** The review's outcome when scoring: a reply, or why there is none. */
export type AudioReview = AudioCheck<PronunciationReply>;

export function pronunciationPrompt(lines: SpokenLine[], clips: Clip[], context: string): string {
  return `Context: ${context}.

You will hear ${clips.length} clip${clips.length === 1 ? "" : "s"} of the speaker, each labelled with its transcript line. The transcript shows what a speech recogniser understood; it may have silently corrected words that were actually unclear, so trust your ears over it:
${clips.map((c) => `${clipLabel(c)}: "${lines[c.line]?.text.trim() ?? ""}"`).join("\n")}

Rate understandability from 0 to 100 for a typical listener in a work setting:
- 90-100: effortless; the listener never has to work to understand.
- 75-89: clear overall; a few words take a moment or need context.
- 50-74: understandable with effort; several words are unclear or would be misheard without context.
- 25-49: hard to follow; the listener often has to guess.
- 0-24: mostly not understandable.
An accent is not an error. Only flag what makes a word hard to understand: wrong or missing sounds, misplaced word stress, swallowed endings, mumbling or rushing.

Then fill in:
- summary: one or two sentences on how clear they are and the main reason it's not higher.
- words: up to ${MAX_WORDS}, the ones that hurt understanding most. For each:
  - line: the #number of the clip it's in
  - word: the word or short phrase as it should be
  - heard: what it sounded like, in plain spelling (e.g. "tink" for think)
  - target: how to say it, in plain words (stressed syllable in capitals, e.g. "deVELopment")
  - tip: one sentence on how to make the sound or stress
  - severity: 1 minor, 2 noticeable, 3 a listener would likely mishear it
  - habit: a short reusable label for the pattern, e.g. "th said as t" or "stress on the first syllable"
  - recurring: true if the same pattern shows up in more than one place
Return an empty list if nothing gets in the way.`;
}

export function clipLabel(clip: Clip): string {
  return `Clip #${clip.line + 1}`;
}

/** Same bands as the prompt, on the rubric's 1-5 scale. */
export function scoreFromUnderstandability(understandability: number): number {
  if (understandability >= 90) return 5;
  if (understandability >= 75) return 4;
  if (understandability >= 50) return 3;
  if (understandability >= 25) return 2;
  return 1;
}

export function pronunciationFindings(
  reply: PronunciationReply,
  lines: SpokenLine[],
  criterion: string,
): Finding[] {
  return reply.words.map((w, i) => ({
    id: `p${i + 1}`,
    kind: "pronunciation",
    criterion,
    severity: w.severity,
    habit: w.habit,
    line: w.line >= 1 && w.line <= lines.length ? w.line - 1 : null,
    quote: w.word,
    better: w.target,
    why: `Sounded like "${w.heard}". ${w.tip}`,
    recurring: w.recurring,
  }));
}

export function pronunciationReview(
  reply: PronunciationReply,
  lines: SpokenLine[],
  costUsd: number,
): PronunciationReview {
  return {
    understandability: reply.understandability,
    summary: reply.summary,
    words: pronunciationFindings(reply, lines, "").map((f, i) => ({
      line: f.line,
      word: f.quote,
      heard: reply.words[i]?.heard ?? "",
      target: f.better,
    })),
    costUsd,
  };
}

/** Splits a line so flagged words can be underlined. Whole words, any case. */
export function markWords(text: string, words: string[]): { text: string; word?: string }[] {
  const wanted = words.map((w) => w.trim()).filter(Boolean);
  if (wanted.length === 0) return [{ text }];
  const pattern = new RegExp(`\\b(${wanted.map(escapeRegExp).join("|")})\\b`, "gi");
  const parts: { text: string; word?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at) });
    const found = match[0];
    const word = wanted.find((w) => w.toLowerCase() === found.toLowerCase()) ?? found;
    parts.push({ text: found, word });
    last = at + found.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** USD per million tokens. */
const RATES: Record<string, { textIn: number; audioIn: number; textOut: number }> = {
  "gpt-audio-1.5": { textIn: 2.5, audioIn: 32, textOut: 10 },
};
const FALLBACK_RATES = RATES["gpt-audio-1.5"] as (typeof RATES)[string];

/** Audio input tokens per second of speech (estimate; actual usage is recorded after). */
const AUDIO_TOKENS_PER_SECOND = 10;
const ESTIMATED_TEXT_IN = 2_000;
const ESTIMATED_TEXT_OUT = 800;

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { audio_tokens?: number };
}

export function reviewCostUsd(model: string, usage: ChatUsage): number {
  const rates = RATES[model] ?? FALLBACK_RATES;
  const audioIn = usage.prompt_tokens_details?.audio_tokens ?? 0;
  const textIn = Math.max(0, (usage.prompt_tokens ?? 0) - audioIn);
  const out = usage.completion_tokens ?? 0;
  return (audioIn * rates.audioIn + textIn * rates.textIn + out * rates.textOut) / 1_000_000;
}

export function estimateReviewCostUsd(model: string, audioMs: number): number | null {
  const rates = RATES[model];
  if (!rates) return null;
  const audioTokens = (audioMs / 1000) * AUDIO_TOKENS_PER_SECOND;
  return (
    (audioTokens * rates.audioIn +
      ESTIMATED_TEXT_IN * rates.textIn +
      ESTIMATED_TEXT_OUT * rates.textOut) /
    1_000_000
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
