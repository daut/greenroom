import { z } from "zod";
import { type SpeechMetrics, type SpokenLine, speechMetrics } from "./metrics";
import {
  type AudioReview,
  type PronunciationReply,
  type PronunciationReview,
  pronunciationFindings,
  pronunciationReview,
  scoreFromUnderstandability,
} from "./pronunciation";
import {
  type PhaseContext,
  phasesOf,
  type ReportPhase,
  type TrainingDefinition,
  type TrainingSession,
  type VoiceRun,
} from "./training";

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
  /** Scored from the audio review of the recording, not by the transcript scorer. */
  fromAudio?: boolean;
}

export const FINDING_KINDS = ["correction", "habit", "content"] as const;
export const HABIT_REVIEW = ["recurred", "improved", "not-heard"] as const;

const findingSchema = z.object({
  id: z.string(),
  kind: z.enum(FINDING_KINDS),
  criterion: z.string(),
  severity: z.number().int().min(1).max(3),
  habit: z.string(),
  /** 1-based transcript line number as shown to the model; 0 for the whole run. */
  line: z.number().int().min(0),
  quote: z.string(),
  better: z.string(),
  why: z.string(),
  recurring: z.boolean(),
});

const habitReviewSchema = z.object({
  habit: z.string(),
  status: z.enum(HABIT_REVIEW),
  note: z.string(),
});

export const scoringSchema = z.object({
  scores: z.array(
    z.object({
      criterion: z.string(),
      score: z.number().int().min(1).max(5),
      comment: z.string(),
    }),
  ),
  summary: z.string(),
  strengths: z.array(z.string()),
  findings: z.array(findingSchema),
  focus: z.array(z.string()),
  habitReview: z.array(habitReviewSchema),
});
export type ScoringReply = z.infer<typeof scoringSchema>;

/** One specific thing to fix, quoted from the run. */
export interface Finding extends Omit<z.infer<typeof findingSchema>, "line" | "kind"> {
  /** "pronunciation" findings come from the audio review, the rest from the scorer. */
  kind: (typeof FINDING_KINDS)[number] | "pronunciation";
  /** Index into the run's lines, or null when it's about the whole run. */
  line: number | null;
}
export type HabitReview = z.infer<typeof habitReviewSchema>;

export interface ChatTurn {
  role: "you" | "coach";
  text: string;
  at: string;
  /** Which conversation it belongs to: `threadKey` of the finding, or "" for the whole report. */
  thread?: string;
  /** Older turns only: the finding the question was about (ids change when re-scored). */
  findingId?: string;
  via?: "text" | "voice";
}

export interface Report {
  runAt: string;
  scores: ScoringReply["scores"];
  /** Mean of the criterion scores, 1..5. */
  overall: number;
  summary: string;
  strengths: string[];
  findings?: Finding[];
  /** Ids of the findings to work on first. */
  focus?: string[];
  /** How the learner's known habits showed up in this run. */
  habitReview?: HabitReview[];
  /** Reports scored before findings existed: "You said … → Better: …" lines. */
  improvements?: string[];
  /** Conversation with the coach about this report. */
  discussion?: ChatTurn[];
  metrics: SpeechMetrics;
  /** Audio review of the recording: understandability and flagged words. */
  pronunciation?: PronunciationReview;
  /** Why the audio review didn't run, when the rubric wanted one. */
  pronunciationSkipped?: string;
}

/** Reports keyed by the voice run they score (`VoiceRun.at`). */
export type ReportArtifact = Record<string, Report>;

/** A habit the learner already has, so the scorer can say whether it came back. */
export interface KnownHabit {
  label: string;
  quote: string;
  better: string;
}

/** Every report of a session, across all its report phases. */
export function sessionReports(def: TrainingDefinition, session: TrainingSession): Report[] {
  return phasesOf(def, session).flatMap((p) =>
    p.kind === "report"
      ? Object.values((session.artifacts[p.id] as ReportArtifact | undefined) ?? {})
      : [],
  );
}

const DEFAULT_MAX_FINDINGS = 6;

export function scoringPrompt(
  phase: ReportPhase,
  ctx: PhaseContext,
  run: VoiceRun,
  known: KnownHabit[],
  audio?: PronunciationReply,
): string {
  const max = phase.maxFindings ?? DEFAULT_MAX_FINDINGS;
  return [
    phase.background(ctx),
    `Score the candidate on each criterion from 1 to 5 with a one-to-two sentence comment:\n${rubricText(transcriptCriteria(phase.rubric))}`,
    phase.guidance,
    findingInstructions(max),
    audio ? audioReviewSection(audio, run.lines) : "",
    known.length ? knownHabitsSection(known) : "",
    `Transcript (lines are numbered; the "Candidate" is the learner):\n${formatTranscript(run.lines)}`,
    run.scratchpad?.trim()
      ? `The candidate's scratchpad when the call ended (their code or notes; findings about it use line 0):\n${run.scratchpad}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildReport(
  run: VoiceRun,
  rubric: RubricCriterion[],
  reply: ScoringReply,
  audio?: AudioReview,
): Report {
  const known = new Set(transcriptCriteria(rubric).map((c) => c.id));
  const scorerScores = reply.scores.filter((s) => known.has(s.criterion));
  const audioCriteria = rubric.filter((c) => c.fromAudio);
  const review = audio?.ok ? audio : null;
  const scores = review
    ? [
        ...scorerScores,
        ...audioCriteria.map((c) => ({
          criterion: c.id,
          score: scoreFromUnderstandability(review.reply.understandability),
          comment: review.reply.summary,
        })),
      ]
    : scorerScores;
  const overall = scores.length ? scores.reduce((a, s) => a + s.score, 0) / scores.length : 0;
  const findings = [
    ...(review ? pronunciationFindings(review.reply, run.lines, audioCriteria[0]?.id ?? "") : []),
    ...reply.findings.map((f) => ({ ...f, line: lineIndex(run, f.line) })),
  ].sort((a, b) => b.severity - a.severity);
  return {
    runAt: run.at,
    scores,
    overall: Math.round(overall * 10) / 10,
    summary: reply.summary,
    strengths: reply.strengths,
    findings,
    focus: focusOf(findings, reply.focus),
    habitReview: reply.habitReview,
    metrics: speechMetrics(run.lines),
    ...(review && {
      pronunciation: pronunciationReview(review.reply, run.lines, review.costUsd),
    }),
    ...(audio && !audio.ok && audioCriteria.length > 0 && { pronunciationSkipped: audio.reason }),
  };
}

/** Whether scoring this phase should start with an audio review of the recording. */
export function wantsAudioReview(rubric: RubricCriterion[]): boolean {
  return rubric.some((c) => c.fromAudio);
}

/** Numbered so findings can point back at a line: `#3 [0:17] Candidate: …`. */
export function formatTranscript(lines: SpokenLine[]): string {
  return lines
    .map((l, i) =>
      l.text.trim()
        ? `#${i + 1} [${clock(l.startMs)}] ${l.speaker === "you" ? "Candidate" : "Interviewer"}: ${l.text}`
        : null,
    )
    .filter((l) => l !== null)
    .join("\n");
}

/** Matches habit labels the scorer wrote slightly differently. */
export function habitKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/["'“”‘’.,;:!?()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function rubricText(rubric: RubricCriterion[]): string {
  return rubric.map((c) => `- ${c.id} (${c.label}): ${c.description}`).join("\n");
}

function findingInstructions(max: number): string {
  return `Then fill in:
- summary: 2-3 sentences.
- strengths: up to 3, each tied to a specific moment.
- findings: up to ${max}, the most useful first. For each:
  - id: f1, f2, …
  - kind: "correction" (a wrong form or word), "habit" (a pattern in how they speak) or "content" (what they said or left out)
  - criterion: the rubric id it hurts most
  - severity: 1 minor, 2 noticeable, 3 gets in the way of the message
  - habit: a short, reusable label for the underlying pattern, e.g. "how … like in questions" or "no result at the end of stories"
  - line: the #number of the line it comes from, or 0 if it's about the whole conversation
  - quote: their exact words, kept short
  - better: what to say instead
  - why: the rule or reason, in one sentence they can remember
  - recurring: true if the pattern shows up more than once in this transcript
- focus: the ids of the 1 or 2 findings that would improve their next session most.
- habitReview: one entry per known habit listed below (empty if none are listed).`;
}

function transcriptCriteria(rubric: RubricCriterion[]): RubricCriterion[] {
  return rubric.filter((c) => !c.fromAudio);
}

function audioReviewSection(audio: PronunciationReply, lines: SpokenLine[]): string {
  const findings = pronunciationFindings(audio, lines, "");
  const listed = findings.map(
    (f, i) =>
      `- [${f.id}] ${f.line === null ? "" : `line #${f.line + 1} `}"${f.quote}" sounded like "${audio.words[i]?.heard ?? ""}" (habit: ${f.habit})`,
  );
  return `A coach listened to the recording and rated understandability ${audio.understandability}/100: ${audio.summary}${
    listed.length
      ? `\nPronunciation findings already made (don't repeat them; you may put their ids in focus if they matter most):\n${listed.join("\n")}`
      : ""
  }`;
}

function knownHabitsSection(known: KnownHabit[]): string {
  return `Known habits from earlier sessions. When a finding is the same pattern, reuse its label exactly. In habitReview, give each one with its exact label and status "recurred" (they slipped again), "improved" (they got it right where they used to slip) or "not-heard" (no chance to tell), plus a short note quoting the moment:
${known.map((h) => `- "${h.label}" (e.g. "${h.quote}" → "${h.better}")`).join("\n")}`;
}

function lineIndex(run: VoiceRun, line: number): number | null {
  const index = line - 1;
  return index >= 0 && index < run.lines.length ? index : null;
}

function focusOf(findings: Finding[], requested: string[]): string[] {
  const ids = new Set(findings.map((f) => f.id));
  const focus = requested.filter((id) => ids.has(id));
  if (focus.length) return focus;
  return findings[0] ? [findings[0].id] : [];
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
