import type { Finding, RubricCriterion } from "@shared/report";
import { clock } from "../voice/SessionPanel";

const KIND_LABEL: Record<Finding["kind"], string> = {
  correction: "Correction",
  habit: "Habit",
  content: "Content",
  pronunciation: "Pronunciation",
};

export interface FindingActions {
  /** Line start time, when the finding points at a line. */
  atMs?: (finding: Finding) => number | null;
  onHear?: (finding: Finding) => void;
  onDiscuss?: (finding: Finding) => void;
  onDrill?: (finding: Finding) => void;
}

export function FindingList({
  findings,
  rubric,
  ...actions
}: { findings: Finding[]; rubric: RubricCriterion[] } & FindingActions) {
  return (
    <ul className="findings">
      {findings.map((f) => (
        <FindingItem key={f.id} finding={f} rubric={rubric} {...actions} />
      ))}
    </ul>
  );
}

export function FindingItem({
  finding: f,
  rubric,
  atMs,
  onHear,
  onDiscuss,
  onDrill,
}: { finding: Finding; rubric: RubricCriterion[] } & FindingActions) {
  const at = atMs?.(f) ?? null;
  const criterion = rubric.find((c) => c.id === f.criterion)?.label;
  return (
    <li className="finding">
      <div className="finding-head">
        <span className="stamp">{KIND_LABEL[f.kind]}</span>
        {criterion && <span className="label">{criterion}</span>}
        {f.recurring && <span className="stamp pending">Recurring</span>}
        <span className="finding-habit">{f.habit}</span>
      </div>
      <p className="finding-fix">
        <span className="finding-said">“{f.quote}”</span>
        <span aria-hidden="true"> → </span>
        <span className="visually-hidden">better: </span>
        <strong>{f.better}</strong>
      </p>
      <p className="finding-why">{f.why}</p>
      {(onHear || onDiscuss || onDrill) && (
        <div className="finding-actions">
          {onHear && at !== null && (
            <button type="button" className="link" onClick={() => onHear(f)}>
              Hear it at {clock(at)}
            </button>
          )}
          {onDiscuss && (
            <button type="button" className="link" data-coach-opener onClick={() => onDiscuss(f)}>
              Discuss
            </button>
          )}
          {onDrill && (
            <button type="button" className="link" onClick={() => onDrill(f)}>
              Drill this
            </button>
          )}
        </div>
      )}
    </li>
  );
}
