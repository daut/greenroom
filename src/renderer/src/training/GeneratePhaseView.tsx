import {
  completePhase,
  contextOf,
  type GeneratePhase,
  type TrainingDefinition,
  type TrainingSession,
} from "@shared/training";
import { useState } from "react";
import { errorMessage } from "../text";
import { askStructured } from "./ask";
import type { UpdateSession } from "./useTrainingSession";

export function GeneratePhaseView({
  def,
  phase,
  session,
  update,
  onDone,
}: {
  def: TrainingDefinition;
  phase: GeneratePhase;
  session: TrainingSession;
  update: UpdateSession;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const output = session.artifacts[phase.id];
  const parsed = output === undefined ? null : phase.schema.safeParse(output);
  const items = parsed?.success ? phase.items(parsed.data) : [];

  const generate = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await askStructured(
        phase.role,
        phase.system,
        phase.prompt(contextOf(session)),
        phase.schema,
      );
      update((s) => completePhase(def, s, phase.id, result));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="stack">
      <div className="session-controls">
        <button
          type="button"
          className={items.length ? "btn" : "btn primary"}
          disabled={running}
          onClick={generate}
        >
          {running ? "Writing" : items.length ? "Generate again" : "Generate"}
        </button>
        {items.length > 0 && (
          <button type="button" className="btn primary" disabled={running} onClick={onDone}>
            Continue
          </button>
        )}
        {running && <span className="stamp pending">Writing</span>}
      </div>
      {error && (
        <p className="warn-text" role="alert">
          {error}
        </p>
      )}
      {parsed && !parsed.success && (
        <p className="warn-text">The saved result is out of date. Generate again.</p>
      )}

      {items.length > 0 && (
        <ol className="script items">
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: generated items have no stable id
            <li key={i}>
              <span className="script-speaker">{item.label}</span>
              <span className="script-text">
                {item.text}
                {item.detail && <span className="item-detail">{item.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
