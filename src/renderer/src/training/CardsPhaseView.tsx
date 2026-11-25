import {
  type Card,
  type CardsArtifact,
  type CardsPhase,
  type CardWork,
  CONFIDENCE,
  completePhase,
  contextOf,
  saveArtifact,
  type TrainingDefinition,
  type TrainingSession,
} from "@shared/training";
import { useEffect, useRef, useState } from "react";
import { Segmented } from "../components/fields";
import { RichText } from "../components/RichText";
import { errorMessage } from "../text";
import { askText } from "./ask";
import type { UpdateSession } from "./useTrainingSession";

const AUTOSAVE_MS = 600;

export function CardsPhaseView({
  def,
  phase,
  session,
  update,
  onDone,
}: {
  def: TrainingDefinition;
  phase: CardsPhase;
  session: TrainingSession;
  update: UpdateSession;
  onDone: () => void;
}) {
  const cards = phase.cards(contextOf(session));
  const [work, setWork] = useState<CardsArtifact>(
    () => (session.artifacts[phase.id] as CardsArtifact | undefined) ?? {},
  );
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (cardId: string, patch: Partial<CardWork>, immediate = false) => {
    setWork((all) => {
      const next = { ...all, [cardId]: { draft: "", ...all[cardId], ...patch } };
      clearTimeout(timer.current);
      const persist = () => update((s) => saveArtifact(s, phase.id, next));
      if (immediate) persist();
      else timer.current = setTimeout(persist, AUTOSAVE_MS);
      return next;
    });
  };

  const finish = () => {
    clearTimeout(timer.current);
    update((s) => completePhase(def, s, phase.id, work));
    onDone();
  };

  const drafted = cards.filter((c) => work[c.id]?.draft.trim()).length;

  return (
    <div className="stack">
      <p className="hint">
        {drafted} of {cards.length} drafted. Pick the questions you're least sure about.
      </p>
      <ul className="cards">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className="card-row"
              aria-expanded={open === card.id}
              onClick={() => setOpen(open === card.id ? null : card.id)}
            >
              <span className="script-speaker">{card.label}</span>
              <span className="card-prompt">{card.prompt}</span>
              <ConfidenceStamp work={work[card.id]} />
            </button>
            {open === card.id && (
              <CardEditor
                card={card}
                work={work[card.id]}
                onChange={(patch, immediate) => change(card.id, patch, immediate)}
                feedback={(draft) =>
                  askText(
                    "generate",
                    phase.feedback.system,
                    phase.feedback.prompt(card, draft, contextOf(session)),
                  )
                }
              />
            )}
          </li>
        ))}
      </ul>
      <div className="session-controls">
        <button type="button" className="btn primary" onClick={finish}>
          Done studying
        </button>
      </div>
    </div>
  );
}

function CardEditor({
  card,
  work,
  onChange,
  feedback,
}: {
  card: Card;
  work: CardWork | undefined;
  onChange: (patch: Partial<CardWork>, immediate?: boolean) => void;
  feedback: (draft: string) => Promise<string>;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = work?.draft ?? "";

  const getFeedback = async () => {
    setRunning(true);
    setError(null);
    try {
      onChange({ feedback: await feedback(draft) }, true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card-editor stack">
      {card.hint && <p className="hint">Why they ask: {card.hint}</p>}
      <label className="visually-hidden" htmlFor={`draft-${card.id}`}>
        Your answer
      </label>
      <textarea
        id={`draft-${card.id}`}
        rows={6}
        value={draft}
        placeholder="Draft your answer: situation, what you did, the result."
        onChange={(e) => onChange({ draft: e.target.value })}
      />
      <div className="session-controls">
        <button
          type="button"
          className="btn"
          disabled={!draft.trim() || running}
          onClick={getFeedback}
        >
          {running ? "Reading" : work?.feedback ? "Feedback again" : "Get feedback"}
        </button>
        <Segmented
          label="Confidence"
          options={CONFIDENCE}
          value={work?.confidence ?? ("" as (typeof CONFIDENCE)[number])}
          onChange={(confidence) => onChange({ confidence }, true)}
        />
      </div>
      {error && <p className="warn-text">{error}</p>}
      {work?.feedback && (
        <div className="feedback">
          <RichText text={work.feedback} />
        </div>
      )}
    </div>
  );
}

function ConfidenceStamp({ work }: { work: CardWork | undefined }) {
  if (work?.confidence) {
    const tone = work.confidence === "solid" ? "ok" : work.confidence === "shaky" ? "bad" : "";
    return <span className={`stamp ${tone}`}>{work.confidence}</span>;
  }
  if (work?.draft.trim()) return <span className="stamp pending">Drafted</span>;
  return <span />;
}
