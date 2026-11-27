import {
  canTypeDrill,
  coachPhase,
  type DrillEntry,
  type DrillTarget,
  drillPassed,
  drillTargets,
  SPOKEN_DRILL_FRAME,
  SPOKEN_DRILL_MINUTES,
  type SpokenDrill,
  spokenCheckPrompt,
  spokenCheckSchema,
  spokenDrillTask,
  spokenResult,
  type TypedDrill,
  typedCheckPrompt,
  typedCheckSchema,
  typedDrillPrompt,
  typedDrillSchema,
  typedResult,
} from "@shared/drills";
import { type Habit, trackHabits } from "@shared/habits";
import { habitKey, sessionReports } from "@shared/report";
import {
  completePhase,
  contextOf,
  type DrillsPhase,
  type TrainingDefinition,
  type TrainingSession,
} from "@shared/training";
import { useState } from "react";
import { dateTime, errorMessage } from "../text";
import { askStructured } from "./ask";
import { CoachCall, type CoachCallResult } from "./CoachCall";
import { useAllSessions } from "./useAllSessions";
import type { UpdateSession } from "./useTrainingSession";

type Change = (entries: DrillEntry[]) => DrillEntry[];

export function DrillsPhaseView({
  def,
  phase,
  session,
  update,
  initialTarget,
}: {
  def: TrainingDefinition;
  phase: DrillsPhase;
  session: TrainingSession;
  update: UpdateSession;
  /** Habit key to open, e.g. from "Drill this" in a report. */
  initialTarget: string | null;
}) {
  const coach = coachPhase(def, session);
  const allSessions = useAllSessions();
  const entries = (session.artifacts[phase.id] as DrillEntry[] | undefined) ?? [];
  const others = (allSessions ?? []).filter((s) => s.id !== session.id);
  const targets = drillTargets(sessionReports(def, session), trackHabits(others, def));
  const status = new Map(trackHabits([...others, session], def).map((h) => [h.key, h]));
  const [open, setOpen] = useState<string | null>(initialTarget ?? targets[0]?.key ?? null);

  const change = (fn: Change) =>
    update((s) =>
      completePhase(
        def,
        s,
        phase.id,
        fn((s.artifacts[phase.id] as DrillEntry[] | undefined) ?? []),
      ),
    );

  if (!coach) return <p className="muted">This training has no report to drill from.</p>;
  if (allSessions === null) return null;
  if (targets.length === 0)
    return (
      <p className="muted">
        Nothing to practise yet. Score a run first; its corrections and habits show up here.
      </p>
    );

  const background = coach.background(contextOf(session));

  return (
    <ul className="cards">
      {targets.map((t) => (
        <li key={t.key}>
          <button
            type="button"
            className="card-row"
            aria-expanded={open === t.key}
            onClick={() => setOpen(open === t.key ? null : t.key)}
          >
            <span className="script-speaker">{t.habit}</span>
            <span className="card-prompt">
              “{t.quote}” → {t.better}
            </span>
            <TargetStamp target={t} habit={status.get(t.key)} entries={entries} />
          </button>
          {open === t.key && (
            <TargetPanel
              target={t}
              system={coach.system}
              background={background}
              entries={entries.filter((e) => habitKey(e.habit) === t.key)}
              change={change}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function TargetPanel({
  target,
  system,
  background,
  entries,
  change,
}: {
  target: DrillTarget;
  system: string;
  background: string;
  entries: DrillEntry[];
  change: (fn: Change) => void;
}) {
  const [busy, setBusy] = useState<"writing" | "checking" | "listening" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const typed = entries.filter((e): e is TypedDrill => e.mode === "typed");
  const current = typed.at(-1);
  const rounds = entries.filter((e) => e.result || e.mode === "spoken");

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const write = () =>
    run("writing", async () => {
      const { items } = await askStructured(
        "generate",
        system,
        typedDrillPrompt(background, target),
        typedDrillSchema,
      );
      const entry: TypedDrill = {
        id: crypto.randomUUID(),
        mode: "typed",
        habit: target.habit,
        at: new Date().toISOString(),
        items,
        answers: {},
      };
      change((list) => [...list, entry]);
    });

  const check = (drill: TypedDrill, answers: Record<string, string>) =>
    run("checking", async () => {
      const reply = await askStructured(
        "score",
        system,
        typedCheckPrompt(background, target, drill.items, answers),
        typedCheckSchema,
      );
      patch(drill.id, { answers, feedback: reply.results, result: typedResult(reply) });
    });

  const spoke = ({ lines, costUsd }: CoachCallResult) => {
    const entry: SpokenDrill = {
      id: crypto.randomUUID(),
      mode: "spoken",
      habit: target.habit,
      at: new Date().toISOString(),
      lines,
      costUsd,
    };
    change((list) => [...list, entry]);
    checkSpoken(entry);
  };

  const checkSpoken = (entry: SpokenDrill) =>
    void run("listening", async () => {
      const reply = await askStructured(
        "score",
        system,
        spokenCheckPrompt(background, target, entry.lines),
        spokenCheckSchema,
      );
      patch(entry.id, { result: spokenResult(reply), slips: reply.slips });
    });

  const patch = (id: string, fields: Partial<TypedDrill> | Partial<SpokenDrill>) =>
    change((list) => list.map((e) => (e.id === id ? ({ ...e, ...fields } as DrillEntry) : e)));

  return (
    <div className="card-editor stack">
      <div className="feedback">
        <p>
          <span className="finding-said">“{target.quote}”</span> → <strong>{target.better}</strong>
        </p>
        <p className="finding-why">{target.why}</p>
        {target.earlier && <p className="hint">Carried over from an earlier session.</p>}
      </div>

      {canTypeDrill(target) && (
        <div className="stack tight">
          <h3 className="label">Typed reps</h3>
          {current && !current.result ? (
            <TypedRound
              key={current.id}
              drill={current}
              checking={busy === "checking"}
              onSave={(answers) => patch(current.id, { answers })}
              onCheck={(answers) => check(current, answers)}
            />
          ) : (
            <>
              {current && <TypedRound key={current.id} drill={current} checking={false} />}
              <button type="button" className="btn" disabled={busy !== null} onClick={write}>
                {busy === "writing" ? "Writing" : current ? "Another round" : "Write 5 reps"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="stack tight">
        <h3 className="label">Say it</h3>
        <CoachCall
          teaser="Say it out loud"
          label="Start spoken reps"
          frame={SPOKEN_DRILL_FRAME}
          maxMinutes={SPOKEN_DRILL_MINUTES}
          fullLength
          task={() => spokenDrillTask(background, target)}
          intro="Quick spoken reps: the coach corrects you on the spot and has you say it again."
          onFinished={spoke}
        />
        {busy === "listening" && <p className="hint">Checking how it went…</p>}
      </div>

      {error && (
        <p className="warn-text" role="alert">
          {error}
        </p>
      )}

      {rounds.length > 0 && (
        <div className="stack tight">
          <h3 className="label">Your rounds</h3>
          <ol className="script">
            {[...rounds].reverse().map((e) => (
              <li key={e.id}>
                <span className="script-speaker">
                  {dateTime(e.at)}
                  {e.result ? (
                    <span className={drillPassed(e.result) ? "stamp ok" : "stamp"}>
                      {e.result.correct}/{e.result.total}
                    </span>
                  ) : (
                    <span className="stamp pending">Unchecked</span>
                  )}
                </span>
                <span className="script-text">
                  {e.mode === "typed" ? "Typed" : "Spoken"}: {e.result?.notes}
                  {e.mode === "spoken" && !e.result && (
                    <button
                      type="button"
                      className="link"
                      disabled={busy !== null}
                      onClick={() => checkSpoken(e)}
                    >
                      {busy === "listening" ? "Checking" : "Check this round"}
                    </button>
                  )}
                  {e.mode === "spoken" &&
                    e.slips?.map((s) => (
                      <span key={s.quote} className="item-detail">
                        “{s.quote}” → {s.better}
                      </span>
                    ))}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** One round of written exercises; read-only once checked. */
function TypedRound({
  drill,
  checking,
  onSave,
  onCheck,
}: {
  drill: TypedDrill;
  checking: boolean;
  onSave?: (answers: Record<string, string>) => void;
  onCheck?: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState(drill.answers);
  const checked = Boolean(drill.feedback);

  return (
    <div className="stack tight">
      <ol className="reps">
        {drill.items.map((item) => {
          const fb = drill.feedback?.find((f) => f.id === item.id);
          return (
            <li key={item.id}>
              <label htmlFor={`rep-${drill.id}-${item.id}`}>
                <span className="label">{item.task}</span>
                <span className="rep-prompt">{item.prompt}</span>
              </label>
              <input
                id={`rep-${drill.id}-${item.id}`}
                value={answers[item.id] ?? ""}
                readOnly={checked}
                onChange={(e) => setAnswers({ ...answers, [item.id]: e.target.value })}
                onBlur={() => onSave?.(answers)}
              />
              {fb && (
                <p className="rep-feedback">
                  <span className={fb.correct ? "stamp ok" : "stamp bad"}>
                    {fb.correct ? "Right" : "Not yet"}
                  </span>{" "}
                  {fb.feedback}
                  {!fb.correct && (
                    <span className="item-detail">
                      Model: <strong>{fb.model}</strong>
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {checked && drill.result && <p className="billing-line">{drill.result.notes}</p>}
      {onCheck && (
        <button
          type="button"
          className="btn primary"
          disabled={checking || !Object.values(answers).some((a) => a.trim())}
          onClick={() => onCheck(answers)}
        >
          {checking ? "Checking" : "Check answers"}
        </button>
      )}
    </div>
  );
}

function TargetStamp({
  target,
  habit,
  entries,
}: {
  target: DrillTarget;
  habit: Habit | undefined;
  entries: DrillEntry[];
}) {
  if (habit?.status === "improving") return <span className="stamp ok">Improving</span>;
  const rounds = entries.filter((e) => e.result && habitKey(e.habit) === target.key);
  const last = rounds.at(-1)?.result;
  if (last)
    return (
      <span
        className={drillPassed(last) ? "stamp ok" : "stamp"}
      >{`${last.correct}/${last.total}`}</span>
    );
  if (target.focus) return <span className="stamp">Focus</span>;
  if (target.earlier) return <span className="stamp pending">Earlier</span>;
  return <span />;
}
