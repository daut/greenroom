import { z } from "zod";
import { type Clip, type ClipOptions, DEFAULT_CLIP_OPTIONS, pickClips } from "./clips";
import type { Habit } from "./habits";
import type { SpokenLine } from "./metrics";
import { clipLabel } from "./pronunciation";
import { type Finding, formatTranscript, habitKey, type Report } from "./report";
import {
  phasesOf,
  type ReportPhase,
  type TrainingDefinition,
  type TrainingSession,
  type VoiceRun,
} from "./training";

/** Something to practise: a finding from this session or a habit still open from before. */
export interface DrillTarget {
  key: string;
  habit: string;
  kind: Finding["kind"];
  quote: string;
  better: string;
  why: string;
  /** One of the report's "work on first" findings. */
  focus: boolean;
  /** Carried over from an earlier session rather than found in this one. */
  earlier: boolean;
}

export interface DrillResult {
  correct: number;
  total: number;
  notes: string;
}

interface DrillBase {
  id: string;
  /** The habit label it practised; matched to habits with `habitKey`. */
  habit: string;
  at: string;
  result?: DrillResult;
}

export interface TypedItem {
  id: string;
  /** The instruction, e.g. "Fix the sentence". */
  task: string;
  prompt: string;
}

export interface TypedFeedback {
  id: string;
  correct: boolean;
  feedback: string;
  model: string;
}

export interface TypedDrill extends DrillBase {
  mode: "typed";
  items: TypedItem[];
  answers: Record<string, string>;
  feedback?: TypedFeedback[];
}

export interface SpokenAttempt {
  /** What you said on this try, as transcribed. */
  said: string;
  ok: boolean;
  /** What the target sounded like or what went wrong; empty when right. */
  heard: string;
  why: string;
}

/** How a spoken round gets scored: by ear, from the transcript, or not at all. */
export type SpokenCheckMethod = "audio" | "transcript" | "none";

/** Always has `recordingPath` (maybe null) so sync treats it like a run with files. */
export type DrillRecording = Pick<
  VoiceRun,
  "recordingPath" | "micRecordingPath" | "recordingOffsetMs"
>;

export interface SpokenDrill extends DrillBase, Partial<DrillRecording> {
  mode: "spoken";
  lines: VoiceRun["lines"];
  costUsd: number;
  attempts?: SpokenAttempt[];
  checkedBy?: Exclude<SpokenCheckMethod, "none">;
  /** Why the round couldn't be scored. */
  unchecked?: string;
  /** Rounds checked before per-try verdicts. */
  slips?: { quote: string; better: string }[];
}

export type DrillEntry = TypedDrill | SpokenDrill;

export const typedDrillSchema = z.object({
  items: z.array(z.object({ id: z.string(), task: z.string(), prompt: z.string() })).min(1),
});

export const typedCheckSchema = z.object({
  results: z.array(
    z.object({ id: z.string(), correct: z.boolean(), feedback: z.string(), model: z.string() }),
  ),
  notes: z.string(),
});

export const spokenCheckSchema = z.object({
  attempts: z.array(
    z.object({ said: z.string(), ok: z.boolean(), heard: z.string(), why: z.string() }),
  ),
  notes: z.string(),
});

export const SPOKEN_DRILL_FRAME =
  "You are a speaking coach running a short, focused practice drill with the user. Unlike a rehearsal, here you correct them on the spot.";

const PASS_RATIO = 0.8;

const TARGET_HINTS: Partial<Record<Finding["kind"], string>> = {
  content: " (for this one, ask them to re-answer the moment with the fix)",
  pronunciation:
    " (for this one, listen to the sound itself: have them say the word alone, then in short phrases, and model it when it's off)",
};

/** One-word tries ("Lunch.") are well under the run review's minimum clip. */
const DRILL_CLIP_OPTIONS: ClipOptions = {
  ...DEFAULT_CLIP_OPTIONS,
  maxTotalMs: 3 * 60_000,
  minClipMs: 300,
};

/** Pronunciation can't be practised on paper. */
export function canTypeDrill(target: DrillTarget): boolean {
  return target.kind !== "pronunciation";
}
export const SPOKEN_DRILL_MINUTES = 3;

/** The phase whose scorer coaches drills and discussions: the training's first report. */
export function coachPhase(
  def: TrainingDefinition,
  session: TrainingSession,
): ReportPhase | undefined {
  return phasesOf(def, session).find((p): p is ReportPhase => p.kind === "report");
}

/** This session's findings (focus first, newest example per habit), then earlier open habits. */
export function drillTargets(reports: Report[], earlier: Habit[]): DrillTarget[] {
  const byKey = new Map<string, DrillTarget>();
  const newestFirst = [...reports].sort((a, b) => b.runAt.localeCompare(a.runAt));
  for (const report of newestFirst) {
    const focus = new Set(report.focus ?? []);
    for (const f of report.findings ?? []) {
      const key = habitKey(f.habit);
      const known = byKey.get(key);
      if (known) {
        known.focus ||= focus.has(f.id);
        continue;
      }
      byKey.set(key, { ...fromFinding(f), key, focus: focus.has(f.id), earlier: false });
    }
  }
  const severity = new Map(
    reports.flatMap((r) => r.findings ?? []).map((f) => [habitKey(f.habit), f.severity]),
  );
  const current = [...byKey.values()].sort(
    (a, b) =>
      Number(b.focus) - Number(a.focus) || (severity.get(b.key) ?? 0) - (severity.get(a.key) ?? 0),
  );
  const carried = earlier
    .filter((h) => h.status !== "fixed" && !byKey.has(h.key))
    .map(
      (h): DrillTarget => ({
        key: h.key,
        habit: h.label,
        kind: h.kind,
        quote: h.quote,
        better: h.better,
        why: h.why,
        focus: false,
        earlier: true,
      }),
    );
  return [...current, ...carried];
}

export function drillPassed(result: DrillResult): boolean {
  return result.total > 0 && result.correct / result.total >= PASS_RATIO;
}

export function typedResult(check: z.infer<typeof typedCheckSchema>): DrillResult {
  return {
    correct: check.results.filter((r) => r.correct).length,
    total: check.results.length,
    notes: check.notes,
  };
}

export function spokenResult(check: z.infer<typeof spokenCheckSchema>): DrillResult {
  return {
    correct: check.attempts.filter((a) => a.ok).length,
    total: check.attempts.length,
    notes: check.notes,
  };
}

/** A transcript spells a word right however it was said, so sounds need the recording. */
export function spokenCheckMethod(
  target: DrillTarget,
  recording: Partial<DrillRecording>,
): SpokenCheckMethod {
  if (target.kind !== "pronunciation") return "transcript";
  return recording.micRecordingPath || recording.recordingPath ? "audio" : "none";
}

export function drillClips(lines: SpokenLine[], recordingOffsetMs: number): Clip[] {
  return pickClips(lines, recordingOffsetMs, DRILL_CLIP_OPTIONS);
}

export function typedDrillPrompt(background: string, target: DrillTarget): string {
  return `${background}

${describeTarget(target)}

Write 5 short written exercises that make the learner practise exactly this, getting a little harder each time. Mix the types that fit:
- "Fix the sentence": a new sentence with the same mistake in a different context.
- "Rephrase": a correct but weak sentence to say the better way.
- "Fill the gap": a sentence with ___ where the target form goes.
- "Answer": a short question or situation where they must use the target, in one or two sentences.
Use contexts from their work and this session. Never reveal the answer in the prompt. Give each an id (1…5), the instruction as "task", and the exercise as "prompt".`;
}

export function typedCheckPrompt(
  background: string,
  target: DrillTarget,
  items: TypedItem[],
  answers: Record<string, string>,
): string {
  return `${background}

${describeTarget(target)}

Check the learner's answers. An answer is correct if it fixes the target and introduces no new serious error; ignore typos. For each item give: id, correct, one-sentence feedback (what's right or what's still wrong and why) and "model", a natural correct answer. Then "notes": one or two sentences on what they've got and what to watch.

${items
  .map((i) => `[${i.id}] ${i.task}: ${i.prompt}\nAnswer: ${answers[i.id]?.trim() || "(blank)"}`)
  .join("\n\n")}`;
}

export function spokenDrillTask(background: string, target: DrillTarget): string {
  return `${background}

${describeTarget(target)}

Run about ${SPOKEN_DRILL_MINUTES} minutes of quick spoken reps on this one thing. Say in one sentence what you'll practise, then:
- Set up short situations or questions that make them use the target naturally${TARGET_HINTS[target.kind] ?? ""}.
- After each answer: if they slipped, say the correct version in one short sentence and ask them to say it again; if they got it right, say so in a few words and move on.
- Vary the situations and make them a little harder as they get it right.${target.kind === "pronunciation" ? soundLadder(target) : ""}
Keep your turns short so they do most of the talking. Correct only this target, not every other slip.
Keep the reps coming until the app tells you time is nearly up, even once they get it right: don't close or call end_session before that note.`;
}

export function spokenCheckPrompt(
  background: string,
  target: DrillTarget,
  lines: VoiceRun["lines"],
): string {
  return `${background}

${describeTarget(target)}

This is the transcript of a spoken drill on that target. ${ATTEMPT_RULES}

${formatTranscript(lines, "Coach")}`;
}

/** For the audio model: your tries as clips, judged on the target sound only. */
export function spokenAudioCheckPrompt(
  target: DrillTarget,
  lines: SpokenLine[],
  clips: Clip[],
): string {
  return `${describeTarget(target)}

You will hear ${clips.length} clip${clips.length === 1 ? "" : "s"} of the learner in a pronunciation drill on that target, each labelled with what a speech recogniser wrote. The recogniser spells words correctly even when they were said wrong, so trust your ears:
${clips.map((c) => `${clipLabel(c)}: "${lines[c.line]?.text.trim() ?? ""}"`).join("\n")}

Judge only the target sound in "${target.quote}", not other words, the accent or the rhythm. An accent is not an error. ${ATTEMPT_RULES}
For "heard", write what the target sounded like in plain spelling (e.g. "lanch"); leave it empty when it was right.`;
}

const ATTEMPT_RULES = `List the learner's tries in order, one entry per turn where the target came up (skip turns where it didn't). For each give "said" (their words), "ok" (whether the target was right on that try, judged on that try alone, including repeats after a correction), "heard" (what was off, empty when right) and "why" (one short sentence). The coach can be wrong: judge the learner, not the coach's reaction. Then "notes": two or three sentences on how it went and what to keep doing; they must agree with the verdicts.`;

/** Small steps for a sound, and no saying the same line over and over. */
function soundLadder(target: DrillTarget): string {
  return `
- Steps: the word alone; then next to a word that differs only in this sound, if there is one; then three or four different short phrases; then a short question they answer in their own words using it.
- Never ask for the same sentence more than twice: after two good tries, move to the next step.
- Comment only on the sound in "${target.quote}". Other words are fine as they are; don't correct them.`;
}

function describeTarget(t: DrillTarget): string {
  if (t.kind === "pronunciation")
    return `Practice target: ${t.habit}
Word: "${t.quote}"
How to say it: "${t.better}"
${t.why}`;
  return `Practice target: ${t.habit}
They said: "${t.quote}"
Better: "${t.better}"
Why: ${t.why}`;
}

function fromFinding(f: Finding): Omit<DrillTarget, "key" | "focus" | "earlier"> {
  return { habit: f.habit, kind: f.kind, quote: f.quote, better: f.better, why: f.why };
}
