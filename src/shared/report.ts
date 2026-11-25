import { z } from "zod";
import { type SpeechMetrics, type SpokenLine, speechMetrics } from "./metrics";
import type { VoiceRun } from "./training";

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
}

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
  improvements: z.array(z.string()),
});
export type ScoringReply = z.infer<typeof scoringSchema>;

export interface Report {
  runAt: string;
  scores: ScoringReply["scores"];
  /** Mean of the criterion scores, 1..5. */
  overall: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  metrics: SpeechMetrics;
}

/** Reports keyed by the voice run they score (`VoiceRun.at`). */
export type ReportArtifact = Record<string, Report>;

export function buildReport(run: VoiceRun, rubric: RubricCriterion[], reply: ScoringReply): Report {
  const known = new Set(rubric.map((c) => c.id));
  const scores = reply.scores.filter((s) => known.has(s.criterion));
  const overall = scores.length ? scores.reduce((a, s) => a + s.score, 0) / scores.length : 0;
  return {
    runAt: run.at,
    scores,
    overall: Math.round(overall * 10) / 10,
    summary: reply.summary,
    strengths: reply.strengths,
    improvements: reply.improvements,
    metrics: speechMetrics(run.lines),
  };
}

export function formatTranscript(lines: SpokenLine[]): string {
  return lines
    .filter((l) => l.text.trim())
    .map(
      (l) =>
        `[${clock(l.startMs)}] ${l.speaker === "you" ? "Candidate" : "Interviewer"}: ${l.text}`,
    )
    .join("\n");
}

export function rubricText(rubric: RubricCriterion[]): string {
  return rubric.map((c) => `- ${c.id} (${c.label}): ${c.description}`).join("\n");
}

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
