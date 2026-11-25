import type { ReportArtifact } from "@shared/report";
import { nextPhase, type Phase, phaseState, type TrainingDefinition } from "@shared/training";
import { trainingById } from "@shared/trainings";
import { useEffect, useState } from "react";
import { roman } from "../text";
import { CardsPhaseView } from "./CardsPhaseView";
import { FormPhaseView } from "./FormPhaseView";
import { GeneratePhaseView } from "./GeneratePhaseView";
import { ReportPhaseView } from "./ReportPhaseView";
import { useTrainingSession } from "./useTrainingSession";
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
                    onClick={() => setSelected(p.id)}
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
            />
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
}: {
  def: TrainingDefinition;
  phase: Phase;
  session: NonNullable<ReturnType<typeof useTrainingSession>["session"]>;
  update: ReturnType<typeof useTrainingSession>["update"];
  onDone: () => void;
  onSelect: (id: string) => void;
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
    case "report":
      return <ReportPhaseView {...shared} phase={phase} />;
  }
}
