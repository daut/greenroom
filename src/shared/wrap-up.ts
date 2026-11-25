/**
 * Ends a timed voice session the way a real interviewer would: a quiet heads-up before the
 * limit, a "time is up" note at the limit (the interviewer closes after your current answer),
 * and a hang-up only after some overtime, and then not mid-sentence.
 */

const MIN = 60_000;
/** Silence before we ask the interviewer to say goodbye instead of waiting for a turn. */
const QUIET_BEFORE_PROMPT_MS = 4_000;
/** Past the overtime we wait for you to finish your sentence, but not forever. */
const SENTENCE_ALLOWANCE_MS = MIN;

export type WrapUpStep = "none" | "warn" | "time-up" | "prompt-goodbye" | "hang-up";

export interface WrapUpDone {
  warned: boolean;
  timeUp: boolean;
  prompted: boolean;
}

export interface WrapUpInput {
  elapsedMs: number;
  limitMs: number;
  youSpeaking: boolean;
  /** How long neither side has been speaking or generating. */
  quietMs: number;
  /** False while the voice only listens (presentation before Q&A). */
  canPrompt: boolean;
  done: WrapUpDone;
}

export function nextWrapUpStep({
  elapsedMs,
  limitMs,
  youSpeaking,
  quietMs,
  canPrompt,
  done,
}: WrapUpInput): WrapUpStep {
  const overtime = elapsedMs - limitMs - graceMs(limitMs);
  if (overtime >= SENTENCE_ALLOWANCE_MS || (overtime >= 0 && !youSpeaking)) return "hang-up";
  if (elapsedMs >= limitMs) {
    if (!done.timeUp) return "time-up";
    if (!done.prompted && canPrompt && quietMs >= QUIET_BEFORE_PROMPT_MS) return "prompt-goodbye";
    return "none";
  }
  if (!done.warned && elapsedMs >= limitMs - leadMs(limitMs)) return "warn";
  return "none";
}

/** Heads-up ahead of the limit: 15% of the session, one to three minutes. */
export function leadMs(limitMs: number): number {
  return clamp(limitMs * 0.15, MIN, 3 * MIN);
}

/** Overtime for the last answer and the goodbye: 20% of the session, two to five minutes. */
export function graceMs(limitMs: number): number {
  return clamp(limitMs * 0.2, 2 * MIN, 5 * MIN);
}

/** What the interviewer is told at each step (as system notes, never spoken). */
export function wrapUpNote(step: "warn" | "time-up", limitMs: number): string {
  const minutes = Math.round(leadMs(limitMs) / MIN);
  return step === "warn"
    ? `About ${minutes} minute${minutes === 1 ? "" : "s"} left. Don't start anything long: at most one more short question, then close. Never cut the candidate off.`
    : "Time is up. Let the candidate finish what they are saying, then close in one short, natural sentence and call end_session. Do not ask another question.";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
