import { coachBriefing, coachSystem, threadKey, threadTurns, withThreads } from "@shared/coach";
import { knownHabits } from "@shared/habits";
import type { AudioReview } from "@shared/pronunciation";
import {
  buildReport,
  type Finding,
  habitKey,
  type Report,
  type ReportArtifact,
  scoringPrompt,
  scoringSchema,
  wantsAudioReview,
} from "@shared/report";
import type { Settings } from "@shared/settings";
import {
  completePhase,
  contextOf,
  type ReportPhase,
  type TrainingDefinition,
  type TrainingSession,
  type VoiceArtifact,
  type VoiceRun,
} from "@shared/training";
import { useEffect, useState } from "react";
import { dateTime, errorMessage, formatUsd } from "../text";
import { askStructured } from "./ask";
import { CoachPanel } from "./CoachPanel";
import { type CoachRequest, type CoachTarget, useCoachRequests } from "./coachRequests";
import { DeleteRun } from "./DeleteRun";
import { type FindingActions, FindingList, type Stamp } from "./Findings";
import { pronunciationEstimateUsd, reviewPronunciation } from "./pronunciation";
import { type Cue, Replay } from "./Replay";
import { useAllSessions } from "./useAllSessions";
import type { UpdateSession } from "./useTrainingSession";

export function ReportPhaseView({
  def,
  phase,
  session,
  update,
  onDrill,
}: {
  def: TrainingDefinition;
  phase: ReportPhase;
  session: TrainingSession;
  update: UpdateSession;
  /** Opens the practice phase on this habit, if the training has one. */
  onDrill: ((habit: string) => void) | null;
}) {
  const runs = [
    ...((session.artifacts[phase.source] as VoiceArtifact | undefined) ?? []),
  ].reverse();
  const reports = (session.artifacts[phase.id] as ReportArtifact | undefined) ?? {};
  const allSessions = useAllSessions();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [open, setOpen] = useState<string | null>(runs[0]?.at ?? null);
  const [scoring, setScoring] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewsAudio = wantsAudioReview(phase.rubric);

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
  }, []);

  const habitsBefore = (run: VoiceRun) =>
    knownHabits(withCurrent(allSessions ?? [], session), def, { before: run.at });

  const audioReview = async (run: VoiceRun): Promise<AudioReview | undefined> => {
    if (!reviewsAudio) return undefined;
    if (!settings?.audio.pronunciationReview)
      return { ok: false, reason: "The pronunciation review is off (Settings → Audio)." };
    setListening(true);
    try {
      return await reviewPronunciation(run, def.title);
    } finally {
      setListening(false);
    }
  };

  const score = async (run: VoiceRun) => {
    setScoring(run.at);
    setError(null);
    try {
      const audio = await audioReview(run);
      const reply = await askStructured(
        "score",
        phase.system,
        scoringPrompt(
          phase,
          contextOf(session),
          run,
          habitsBefore(run),
          audio?.ok ? audio.reply : undefined,
        ),
        scoringSchema,
      );
      const report = buildReport(run, phase.rubric, reply, audio);
      update((s) => {
        const current = (s.artifacts[phase.id] as ReportArtifact | undefined) ?? {};
        const previous = current[run.at];
        const discussion =
          previous?.discussion && withThreads(previous.discussion, previous.findings ?? []);
        return completePhase(def, s, phase.id, {
          ...current,
          [run.at]: discussion ? { ...report, discussion } : report,
        });
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
                    disabled={scoring !== null || allSessions === null || settings === null}
                    onClick={() => score(run)}
                  >
                    {scoring !== run.at ? "Score it" : listening ? "Listening" : "Scoring"}
                  </button>
                )}
                <DeleteRun
                  def={def}
                  voicePhaseId={phase.source}
                  run={run}
                  update={update}
                  disabled={scoring === run.at}
                  onDeleted={() => open === run.at && setOpen(null)}
                />
              </div>
              {open === run.at && (
                <OpenRun
                  phase={phase}
                  run={run}
                  report={report}
                  reviewEstimate={
                    reviewsAudio && settings?.audio.pronunciationReview
                      ? pronunciationEstimateUsd(run, settings.models.pronunciation)
                      : null
                  }
                  scoring={allSessions === null ? "loading" : scoring}
                  onScore={() => score(run)}
                  onDrill={onDrill}
                  briefing={(options) =>
                    report
                      ? coachBriefing(
                          phase,
                          contextOf(session),
                          run,
                          report,
                          habitsBefore(run),
                          options,
                        )
                      : ""
                  }
                  coachRun={{ sessionId: session.id, phaseId: phase.id, runAt: run.at }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OpenRun({
  phase,
  run,
  report,
  reviewEstimate,
  scoring,
  onScore,
  onDrill,
  briefing,
  coachRun,
}: {
  phase: ReportPhase;
  run: VoiceRun;
  report: Report | undefined;
  /** Cost of the pronunciation review that scoring would run, when it would. */
  reviewEstimate: number | null;
  scoring: string | null;
  onScore: () => void;
  onDrill: ((habit: string) => void) | null;
  briefing: (options?: { transcript?: boolean }) => string;
  coachRun: Omit<CoachTarget, "thread">;
}) {
  const [cue, setCue] = useState<Cue | null>(null);
  const [about, setAbout] = useState<Finding | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const coachRequest = useCoachRequests();
  const findings = report?.findings;
  const coachStatus = (f: Finding | null): Stamp | null =>
    report
      ? threadStamp(
          coachRequest({ ...coachRun, thread: threadKey(f) }),
          threadTurns(report.discussion ?? [], findings ?? [], threadKey(f)).length,
        )
      : null;
  const wholeReportStatus = coachStatus(null);

  // Re-scoring renumbers findings, so a question can't stay pinned to the old one.
  useEffect(() => {
    if (findings) setAbout(null);
  }, [findings]);

  const hear = (f: Finding) => {
    if (f.line !== null) setCue((c) => ({ line: f.line as number, n: (c?.n ?? 0) + 1 }));
  };
  const discuss = (f: Finding | null) => {
    setAbout(f);
    setCoachOpen(true);
  };

  return (
    <div className="card-editor stack">
      {reviewEstimate !== null && (
        <p className="hint">
          Scoring{report ? " again" : ""} includes a pronunciation review of your recorded answers,
          about {formatUsd(reviewEstimate)}. Turn it off in Settings → Audio.
        </p>
      )}
      {report && (
        <ReportBody
          phase={phase}
          report={report}
          actions={{
            atMs: (f) => recordingMs(run, f),
            onHear: hear,
            onDiscuss: discuss,
            discussStatus: coachStatus,
            onDrill: onDrill ? (f) => onDrill(habitKey(f.habit)) : undefined,
          }}
        />
      )}
      {report && (
        <button type="button" className="link" disabled={scoring !== null} onClick={onScore}>
          {scoring === run.at
            ? "Scoring again…"
            : report.findings
              ? "Score again"
              : "Score again for rules, links to the recording and drills"}
        </button>
      )}
      {report && (
        <div className="session-controls">
          <button type="button" className="btn" data-coach-opener onClick={() => discuss(null)}>
            Discuss with the coach
          </button>
          {wholeReportStatus && (
            <span className={`stamp ${wholeReportStatus.tone}`}>{wholeReportStatus.label}</span>
          )}
        </div>
      )}
      {report && coachOpen && (
        <CoachPanel
          system={coachSystem(phase)}
          briefing={briefing}
          run={coachRun}
          discussion={report.discussion ?? []}
          findings={findings ?? []}
          about={about}
          onClearAbout={() => setAbout(null)}
          onClose={() => setCoachOpen(false)}
        />
      )}
      <Replay run={run} cue={cue} marks={report?.pronunciation?.words} />
    </div>
  );
}

function ReportBody({
  phase,
  report,
  actions,
}: {
  phase: ReportPhase;
  report: Report;
  actions: FindingActions;
}) {
  const m = report.metrics;
  const fillers = Object.entries(m.fillers)
    .sort((a, b) => b[1] - a[1])
    .map(([w, n]) => `${w} ×${n}`)
    .join(", ");
  const focusIds = new Set(report.focus ?? []);
  const focus = (report.findings ?? []).filter((f) => focusIds.has(f.id));
  const rest = (report.findings ?? []).filter((f) => !focusIds.has(f.id));

  return (
    <div className="stack">
      <p className="billing-line">{report.summary}</p>

      {focus.length > 0 && (
        <div className="stack tight focus">
          <h3 className="label">Work on this first</h3>
          <FindingList findings={focus} rubric={phase.rubric} {...actions} />
        </div>
      )}

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

      {rest.length > 0 && (
        <div className="stack tight">
          <h3 className="label">Also noticed</h3>
          <FindingList findings={rest} rubric={phase.rubric} {...actions} />
        </div>
      )}

      <div className="grid-2">
        <List title="Strengths" items={report.strengths} />
        {report.improvements?.length ? (
          <List title="To practise" items={report.improvements} />
        ) : (
          <HabitReviewList review={report.habitReview ?? []} />
        )}
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
        {report.pronunciation && (
          <Metric
            label="Understandability"
            value={`${report.pronunciation.understandability} / 100`}
            hint={`from the recording; ${report.pronunciation.words.length} unclear word${report.pronunciation.words.length === 1 ? "" : "s"}`}
          />
        )}
      </dl>
      {report.pronunciationSkipped && (
        <p className="hint">Pronunciation not reviewed: {report.pronunciationSkipped}</p>
      )}
    </div>
  );
}

const REVIEW_STAMP = {
  recurred: { label: "Again", tone: "bad" },
  improved: { label: "Better", tone: "ok" },
  "not-heard": { label: "Not heard", tone: "pending" },
} as const;

function HabitReviewList({ review }: { review: NonNullable<Report["habitReview"]> }) {
  if (review.length === 0) return <div />;
  return (
    <div className="stack tight">
      <h3 className="label">Since last time</h3>
      <ul className="habit-review">
        {review.map((r) => (
          <li key={r.habit}>
            <span className={`stamp ${REVIEW_STAMP[r.status].tone}`}>
              {REVIEW_STAMP[r.status].label}
            </span>
            <span>
              <strong>{r.habit}</strong>
              {r.note && <span className="hint">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
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

/** How a conversation with the coach stands: waiting, failed, or how long it is. */
function threadStamp(request: CoachRequest | undefined, messages: number): Stamp | null {
  if (request) return request.error ? { label: "Reply failed", tone: "bad" } : REPLYING;
  if (!messages) return null;
  return { label: `${messages} message${messages === 1 ? "" : "s"}`, tone: "pending" };
}

const REPLYING: Stamp = { label: "Coach replying…", tone: "pending" };

/** Where the finding's line starts on the recording's clock (what the player shows). */
function recordingMs(run: VoiceRun, f: Finding): number | null {
  const line = f.line === null ? undefined : run.lines[f.line];
  return line ? Math.max(0, line.startMs - (run.recordingOffsetMs ?? 0)) : null;
}

/** The list from disk may be older than the open session. */
function withCurrent(sessions: TrainingSession[], current: TrainingSession): TrainingSession[] {
  return [...sessions.filter((s) => s.id !== current.id), current];
}
