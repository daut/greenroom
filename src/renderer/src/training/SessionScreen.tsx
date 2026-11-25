import type { ReportArtifact } from "@shared/report";
import {
  finishSession,
  isFinished,
  nextPhase,
  type Phase,
  phaseState,
  reopenSession,
  type TrainingDefinition,
  type TrainingSession,
} from "@shared/training";
import { trainingById } from "@shared/trainings";
import { useEffect, useState } from "react";
import { roman } from "../text";
import { CardsPhaseView } from "./CardsPhaseView";
import { DrillsPhaseView } from "./DrillsPhaseView";
import { FormPhaseView } from "./FormPhaseView";
import { GeneratePhaseView } from "./GeneratePhaseView";
import { ReportPhaseView } from "./ReportPhaseView";
import { type UpdateSession, useTrainingSession } from "./useTrainingSession";
import { VoicePhaseView } from "./VoicePhaseView";

const STATE_STAMP = {
  done: { label: "Done", tone: "ok" },
  ready: { label: "Ready", tone: "" },
  locked: { label: "Later", tone: "pending" },
} as const;

export function SessionScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { session, update } = useTrainingSession(id);
  const def = session ? trainingById(session.trainingId) : undefined;
  const [selected, setSelected] = useState<string | null>(null);
  const [drillTarget, setDrillTarget] = useState<string | null>(null);

  // Pin the open phase so finishing it (e.g. generating) doesn't jump away; "Continue" unpins.
  useEffect(() => {
    if (selected === null && session && def) {
      setSelected((nextPhase(def, session) ?? def.phases.at(-1))?.id ?? null);
    }
  }, [selected, session, def]);

  if (session === undefined) return null;
  if (!session || !def) {
    return (
      <section className="page">
        <p className="warn-text">This session can't be opened.</p>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
      </section>
    );
  }

  const current =
    def.phases.find((p) => p.id === selected) ?? nextPhase(def, session) ?? def.phases.at(-1);
  const goNext = () => setSelected(null);

  return (
    <section className="page wide">
      <header className="page-header">
        <h1 className="page-title">{session.title}</h1>
        {isFinished(session) && (
          <>
            <span className="stamp ok">Finished</span>
            <button
              type="button"
              className="link reopen"
              onClick={() => update((s) => reopenSession(s))}
            >
              Reopen
            </button>
          </>
        )}
        <button type="button" className="link" onClick={onBack}>
          All sessions
        </button>
      </header>

      <div className="session-layout">
        <nav aria-label="Phases">
          <ol className="acts-nav">
            {def.phases.map((p, i) => {
              const state = phaseState(def, session, p.id);
              const stamp = STATE_STAMP[state];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="act-item"
                    aria-current={p.id === current?.id ? "step" : undefined}
                    disabled={state === "locked"}
                    onClick={() => {
                      setDrillTarget(null);
                      setSelected(p.id);
                    }}
                  >
                    <span className="act-number">Act {roman(i + 1)}</span>
                    <span className="act-name">{p.title}</span>
                    <span className={`stamp ${stamp.tone}`}>{stamp.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {current && (
          <div className="stack" key={current.id}>
            <div className="stack tight">
              <h2 className="section-title">{current.title}</h2>
              {current.intro && <p className="lede">{current.intro}</p>}
            </div>
            <PhaseView
              def={def}
              phase={current}
              session={session}
              update={update}
              onDone={goNext}
              onSelect={setSelected}
              drillTarget={drillTarget}
              onDrill={(phaseId, habit) => {
                setDrillTarget(habit);
                setSelected(phaseId);
              }}
            />
            {!isFinished(session) && canFinishAt(def, session, current) && (
              <FinishLine update={update} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PhaseView({
  def,
  phase,
  session,
  update,
  onDone,
  onSelect,
  drillTarget,
  onDrill,
}: {
  def: TrainingDefinition;
  phase: Phase;
  session: NonNullable<ReturnType<typeof useTrainingSession>["session"]>;
  update: ReturnType<typeof useTrainingSession>["update"];
  onDone: () => void;
  onSelect: (id: string) => void;
  drillTarget: string | null;
  onDrill: (drillsPhaseId: string, habit: string) => void;
}) {
  const shared = { def, session, update };
  switch (phase.kind) {
    case "form":
      return <FormPhaseView {...shared} phase={phase} onDone={onDone} />;
    case "generate":
      return <GeneratePhaseView {...shared} phase={phase} onDone={onDone} />;
    case "cards":
      return <CardsPhaseView {...shared} phase={phase} onDone={onDone} />;
    case "voice": {
      const report = def.phases.find((p) => p.kind === "report" && p.source === phase.id);
      return (
        <VoicePhaseView
          {...shared}
          phase={phase}
          onOpenReport={report ? () => onSelect(report.id) : null}
          reports={
            report ? ((session.artifacts[report.id] as ReportArtifact | undefined) ?? {}) : null
          }
        />
      );
    }
    case "report": {
      const drills = def.phases.find((p) => p.kind === "drills");
      return (
        <ReportPhaseView
          {...shared}
          phase={phase}
          onDrill={drills ? (habit) => onDrill(drills.id, habit) : null}
        />
      );
    }
    case "drills":
      return <DrillsPhaseView {...shared} phase={phase} initialTarget={drillTarget} />;
  }
}

/** The last act, or any scored report: some acts after a report (like drills) are optional. */
function canFinishAt(def: TrainingDefinition, session: TrainingSession, phase: Phase): boolean {
  const state = phaseState(def, session, phase.id);
  if (phase.id === def.phases.at(-1)?.id) return state !== "locked";
  return phase.kind === "report" && state === "done";
}

/** Marking a session done is the user's call; it takes the session off Continue on Home. */
function FinishLine({ update }: { update: UpdateSession }) {
  return (
    <div className="finish-line">
      <span className="muted">Done with this session? It moves off Continue on Home.</span>
      <button type="button" className="btn primary" onClick={() => update((s) => finishSession(s))}>
        Mark session done
      </button>
    </div>
  );
}
