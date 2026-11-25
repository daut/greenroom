import type { SpeechMetrics } from "./metrics";
import type { ReportArtifact, RubricCriterion } from "./report";
import type { TrainingDefinition, TrainingSession } from "./training";

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

/** Overall score of the session's most recent report, across its report phases. */
export function latestScore(def: TrainingDefinition, session: TrainingSession): number | null {
  const reports = def.phases
    .filter((p) => p.kind === "report")
    .flatMap((p) => Object.values((session.artifacts[p.id] as ReportArtifact | undefined) ?? {}));
  const latest = reports.sort((a, b) => b.runAt.localeCompare(a.runAt))[0];
  return latest ? latest.overall : null;
}

/** One chronological series per report phase, across all sessions. */
export function scoreTrends(sessions: TrainingSession[], trainings: TrainingDefinition[]): Trend[] {
  const trends: Trend[] = [];
  for (const def of trainings) {
    for (const phase of def.phases) {
      if (phase.kind !== "report") continue;
      const points = sessions
        .filter((s) => s.trainingId === def.id)
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
