import type { SpeechMetrics } from "./metrics";
import type { ReportArtifact, RubricCriterion } from "./report";
import {
  phasesOf,
  type ReportPhase,
  type TrainingDefinition,
  type TrainingSession,
} from "./training";

export interface TrendPoint {
  at: string;
  overall: number;
  scores: Record<string, number>;
  metrics: SpeechMetrics;
  sessionId: string;
  sessionTitle: string;
}

export interface Trend {
  key: string;
  title: string;
  rubric: RubricCriterion[];
  points: TrendPoint[];
}

/** Overall score of the latest run in the session's main (first) report phase. */
export function latestScore(def: TrainingDefinition, session: TrainingSession): number | null {
  const main = phasesOf(def, session).find((p) => p.kind === "report");
  if (!main) return null;
  const reports = Object.values((session.artifacts[main.id] as ReportArtifact | undefined) ?? {});
  const latest = reports.sort((a, b) => b.runAt.localeCompare(a.runAt))[0];
  return latest ? latest.overall : null;
}

/** One chronological series per report phase, across all sessions. */
export function scoreTrends(sessions: TrainingSession[], trainings: TrainingDefinition[]): Trend[] {
  const trends: Trend[] = [];
  for (const def of trainings) {
    const own = sessions.filter((s) => s.trainingId === def.id);
    for (const phase of reportPhases(def, own)) {
      const points = own
        .flatMap((s) =>
          Object.values((s.artifacts[phase.id] as ReportArtifact | undefined) ?? {}).map(
            (r): TrendPoint => ({
              at: r.runAt,
              overall: r.overall,
              scores: Object.fromEntries(r.scores.map((x) => [x.criterion, x.score])),
              metrics: r.metrics,
              sessionId: s.id,
              sessionTitle: s.title,
            }),
          ),
        )
        .sort((a, b) => a.at.localeCompare(b.at));
      if (points.length) {
        trends.push({
          key: `${def.id}/${phase.id}`,
          title: `${def.title} · ${phase.title}`,
          rubric: phase.rubric,
          points,
        });
      }
    }
  }
  return trends;
}

/** The report phases of any of these sessions, e.g. interview rounds only some sessions picked. */
function reportPhases(def: TrainingDefinition, sessions: TrainingSession[]): ReportPhase[] {
  const byId = new Map<string, ReportPhase>();
  for (const phase of [def.phases, ...sessions.map((s) => phasesOf(def, s))].flat()) {
    if (phase.kind === "report" && !byId.has(phase.id)) byId.set(phase.id, phase);
  }
  return [...byId.values()];
}
