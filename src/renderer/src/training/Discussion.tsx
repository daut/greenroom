import { discussPrompt, VOICE_COACH_FRAME, voiceCoachTask, voiceTurns } from "@shared/coach";
import type { ChatTurn, Finding } from "@shared/report";
import { useCallback, useState } from "react";
import { RichText } from "../components/RichText";
import { errorMessage } from "../text";
import { askText } from "./ask";
import { CoachCall, type CoachCallResult } from "./CoachCall";

const GENERAL_STARTERS = [
  "What should I fix first?",
  "Explain my lowest score",
  "Was anything too harsh?",
];
const FINDING_STARTERS = ["Why is this wrong?", "Give me more examples", "Quiz me on it"];

/** Talk a report through with the coach, by text or on a short voice call. */
export function Discussion({
  system,
  briefing,
  turns,
  about,
  onClearAbout,
  onAdd,
}: {
  system: string;
  briefing: (options?: { transcript?: boolean }) => string;
  turns: ChatTurn[];
  /** The finding the next question is about. */
  about: Finding | null;
  onClearAbout: () => void;
  onAdd: (turns: ChatTurn[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setPending(text);
    setDraft("");
    setError(null);
    try {
      const reply = await askText(
        "score",
        system,
        discussPrompt(briefing(), turns, text, about ?? undefined),
      );
      const at = new Date().toISOString();
      onAdd([
        { role: "you", text, at, findingId: about?.id, via: "text" },
        { role: "coach", text: reply, at, via: "text" },
      ]);
    } catch (e) {
      setError(errorMessage(e));
      setDraft(text);
    } finally {
      setPending(null);
    }
  };

  const onCall = useCallback(
    ({ lines }: CoachCallResult) => onAdd(voiceTurns(lines, new Date().toISOString())),
    [onAdd],
  );

  return (
    <section className="discussion stack" aria-label="Discuss with the coach">
      <h3 className="label">Discuss with the coach</h3>

      {turns.length > 0 && (
        <ol className="chat">
          {turns.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an append-only conversation
            <li key={i} className={t.role === "you" ? "chat-you" : "chat-coach"}>
              <span className="script-speaker">
                {t.role === "you" ? "You" : "Coach"}
                {t.via === "voice" ? " · on call" : ""}
              </span>
              <div className="chat-text">
                {t.role === "coach" ? <RichText text={t.text} /> : <p>{t.text}</p>}
              </div>
            </li>
          ))}
          {pending && (
            <>
              <li className="chat-you">
                <span className="script-speaker">You</span>
                <div className="chat-text">
                  <p>{pending}</p>
                </div>
              </li>
              <li className="chat-coach pending">
                <span className="script-speaker">Coach</span>
                <div className="chat-text">
                  <p className="muted">Thinking…</p>
                </div>
              </li>
            </>
          )}
        </ol>
      )}

      {about && (
        <p className="chat-about">
          <span className="label">About</span> “{about.quote}” → {about.better}
          <button type="button" className="link" onClick={onClearAbout}>
            Ask about the whole report
          </button>
        </p>
      )}

      <div className="starters">
        {(about ? FINDING_STARTERS : GENERAL_STARTERS).map((s) => (
          <button
            key={s}
            type="button"
            className="btn"
            disabled={pending !== null}
            onClick={() => ask(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="chat-input">
        <label htmlFor="discuss-input" className="visually-hidden">
          Your question
        </label>
        <textarea
          id="discuss-input"
          rows={2}
          value={draft}
          placeholder="Ask anything about this report. Enter to send, Shift+Enter for a new line."
          disabled={pending !== null}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!draft.trim() || pending !== null}
          onClick={() => ask(draft)}
        >
          {pending ? "Asking" : "Ask"}
        </button>
      </div>
      {error && (
        <p className="warn-text" role="alert">
          {error}
        </p>
      )}

      <CoachCall
        label={about ? "Talk this one through" : "Talk it through on a call"}
        frame={VOICE_COACH_FRAME}
        task={() => voiceCoachTask(briefing({ transcript: false }), about ?? undefined)}
        onFinished={onCall}
      />
    </section>
  );
}
