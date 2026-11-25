import {
  buildReport,
  formatTranscript,
  type Report,
  type ReportArtifact,
  rubricText,
  scoringSchema,
} from "@shared/report";
import {
  completePhase,
  contextOf,
  type ReportPhase,
  type TrainingDefinition,
  type TrainingSession,
  type VoiceArtifact,
  type VoiceRun,
} from "@shared/training";
import { useState } from "react";
import { dateTime, errorMessage } from "../text";
import { askStructured } from "./ask";
import { Replay } from "./Replay";
import type { UpdateSession } from "./useTrainingSession";

export function ReportPhaseView({
  def,
  phase,
  session,
  update,
}: {
  def: TrainingDefinition;
  phase: ReportPhase;
  session: TrainingSession;
  update: UpdateSession;
}) {
  const runs = [
    ...((session.artifacts[phase.source] as VoiceArtifact | undefined) ?? []),
  ].reverse();
  const reports = (session.artifacts[phase.id] as ReportArtifact | undefined) ?? {};
  const [open, setOpen] = useState<string | null>(runs[0]?.at ?? null);
  const [scoring, setScoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const score = async (run: VoiceRun) => {
    setScoring(run.at);
    setError(null);
    try {
      const reply = await askStructured(
        "score",
        phase.system,
        phase.prompt(contextOf(session), formatTranscript(run.lines), rubricText(phase.rubric)),
        scoringSchema,
      );
      const report = buildReport(run, phase.rubric, reply);
      update((s) => {
        const current = (s.artifacts[phase.id] as ReportArtifact | undefined) ?? {};
        return completePhase(def, s, phase.id, { ...current, [run.at]: report });
      });
      setOpen(run.at);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setScoring(null);
    }
  };

  if (runs.length === 0)
    return <p className="muted">No runs yet. Do one first, then score it here.</p>;

  return (
    <div className="stack">
      {error && (
        <p className="warn-text" role="alert">
          {error}
        </p>
      )}
      <ul className="cards">
        {runs.map((run) => {
          const report = reports[run.at];
          return (
            <li key={run.at}>
              <div className="card-row static">
                <button
                  type="button"
                  className="link"
                  aria-expanded={open === run.at}
                  onClick={() => setOpen(open === run.at ? null : run.at)}
                >
                  {dateTime(run.at)}
                </button>
                <span className="leader" aria-hidden="true" />
                {report ? (
                  <span className="score-total">{report.overall.toFixed(1)} / 5</span>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={scoring !== null}
                    onClick={() => score(run)}
                  >
                    {scoring === run.at ? "Scoring" : "Score it"}
                  </button>
                )}
              </div>
              {open === run.at && (
                <div className="card-editor stack">
                  {report && <ReportBody phase={phase} report={report} />}
                  {report && (
                    <button
                      type="button"
                      className="link"
                      disabled={scoring !== null}
                      onClick={() => score(run)}
                    >
                      {scoring === run.at ? "Scoring again…" : "Score again"}
                    </button>
                  )}
                  <Replay run={run} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReportBody({ phase, report }: { phase: ReportPhase; report: Report }) {
  const m = report.metrics;
  const fillers = Object.entries(m.fillers)
    .sort((a, b) => b[1] - a[1])
    .map(([w, n]) => `${w} ×${n}`)
    .join(", ");

  return (
    <div className="stack">
      <p className="billing-line">{report.summary}</p>

      <ol className="scores">
        {phase.rubric.map((c) => {
          const s = report.scores.find((x) => x.criterion === c.id);
          return (
            <li key={c.id}>
              <span className="score-label">{c.label}</span>
              <span className="score-bar" role="img" aria-label={`${s?.score ?? 0} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={s && n <= s.score ? "on" : ""} />
                ))}
              </span>
              <span className="score-comment">{s?.comment ?? "Not scored."}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid-2">
        <List title="Strengths" items={report.strengths} />
        <List title="To practise" items={report.improvements} />
      </div>

      <dl className="metrics">
        <Metric
          label="Pace"
          value={`${Math.round(m.wordsPerMinute)} wpm`}
          hint="130–160 is comfortable"
        />
        <Metric
          label="Fillers"
          value={`${m.fillersPerMinute.toFixed(1)} / min`}
          hint={fillers || "none heard"}
        />
        <Metric
          label="Your share"
          value={`${Math.round(m.talkRatio * 100)}%`}
          hint="of speaking time"
        />
        <Metric
          label="Answers"
          value={`${m.answers}`}
          hint={`avg ${Math.round(m.averageAnswerSeconds)} s, longest ${Math.round(m.longestAnswerSeconds)} s`}
        />
      </dl>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="stack tight">
      <h3 className="label">{title}</h3>
      <ul className="bullets">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd>
        <span className="metric-value">{value}</span>
        <span className="hint">{hint}</span>
      </dd>
    </div>
  );
}
