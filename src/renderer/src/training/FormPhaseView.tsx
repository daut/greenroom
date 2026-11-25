import {
  completePhase,
  type FormArtifact,
  type FormField,
  type FormPhase,
  saveArtifact,
  type TrainingDefinition,
  type TrainingSession,
} from "@shared/training";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../text";
import type { UpdateSession } from "./useTrainingSession";

const AUTOSAVE_MS = 600;

export function FormPhaseView({
  def,
  phase,
  session,
  update,
  onDone,
}: {
  def: TrainingDefinition;
  phase: FormPhase;
  session: TrainingSession;
  update: UpdateSession;
  onDone: () => void;
}) {
  const [values, setValues] = useState<FormArtifact>(
    () => (session.artifacts[phase.id] as FormArtifact | undefined) ?? {},
  );
  const [imported, setImported] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const set = (id: string, value: string) => {
    const next = { ...values, [id]: value };
    setValues(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update((s) => saveArtifact(s, phase.id, next)), AUTOSAVE_MS);
  };

  const importFile = async (field: FormField) => {
    setError(null);
    try {
      const doc = await window.greenroom.files.pickDocument();
      if (!doc) return;
      if (!doc.text.trim())
        throw new Error(`${doc.name} has no readable text (is it a scanned PDF?).`);
      set(field.id, doc.text);
      setImported((m) => ({ ...m, [field.id]: doc.name }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const missing = phase.fields.filter((f) => f.required && !values[f.id]?.trim());

  const submit = () => {
    if (missing.length) {
      setError(`Fill in: ${missing.map((f) => f.label).join(", ")}.`);
      return;
    }
    clearTimeout(timer.current);
    update((s) => completePhase(def, s, phase.id, values));
    onDone();
  };

  return (
    <div className="stack">
      {phase.fields.map((field) => (
        <div className="field" key={field.id}>
          <div className="field-head">
            <label htmlFor={`f-${field.id}`}>
              {field.label}
              {field.required ? "" : " (optional)"}
            </label>
            {field.kind === "document" && (
              <button type="button" className="link" onClick={() => importFile(field)}>
                Import PDF, TXT or Markdown
              </button>
            )}
          </div>
          {field.kind === "text" ? (
            <input
              id={`f-${field.id}`}
              value={values[field.id] ?? ""}
              placeholder={field.placeholder}
              onChange={(e) => set(field.id, e.target.value)}
            />
          ) : (
            <textarea
              id={`f-${field.id}`}
              rows={field.kind === "document" ? 8 : 4}
              value={values[field.id] ?? ""}
              placeholder={
                field.placeholder ?? (field.kind === "document" ? "Paste text here" : "")
              }
              onChange={(e) => set(field.id, e.target.value)}
            />
          )}
          {imported[field.id] && <span className="hint">Imported from {imported[field.id]}</span>}
          {field.hint && <span className="hint">{field.hint}</span>}
        </div>
      ))}

      {error && (
        <p className="warn-text" role="alert">
          {error}
        </p>
      )}
      <div className="session-controls">
        <button type="button" className="btn primary" onClick={submit}>
          Save and continue
        </button>
        <span className="hint">Drafts save as you type.</span>
      </div>
    </div>
  );
}
