import {
  discussPrompt,
  threadKey,
  threadTurns,
  VOICE_COACH_FRAME,
  voiceCoachTask,
  voiceTurns,
} from "@shared/coach";
import type { ChatTurn, Finding } from "@shared/report";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RichText } from "../components/RichText";
import { CoachCall, type CoachCallResult } from "./CoachCall";
import { appendDiscussion, askCoach, type CoachTarget, useCoachRequests } from "./coachRequests";

const GENERAL_STARTERS = [
  "What should I fix first?",
  "Explain my lowest score",
  "Was anything too harsh?",
];
const FINDING_STARTERS = ["Why is this wrong?", "Give me more examples", "Quiz me on it"];

/**
 * The coach beside the report: ask by text or talk it through on a short call. Pinned to the
 * right so the report and its "Hear it" links stay usable; it doesn't block the page.
 */
export function CoachPanel({
  system,
  briefing,
  run,
  discussion,
  findings,
  about,
  onClearAbout,
  onClose,
}: {
  system: string;
  briefing: (options?: { transcript?: boolean }) => string;
  /** The scored run being discussed. */
  run: Omit<CoachTarget, "thread">;
  discussion: ChatTurn[];
  findings: Finding[];
  /** The finding being discussed; each has its own conversation. */
  about: Finding | null;
  onClearAbout: () => void;
  onClose: () => void;
}) {
  const target = { ...run, thread: threadKey(about) };
  const turns = threadTurns(discussion, findings, target.thread);
  const request = useCoachRequests()(target);
  const pending = request && !request.error ? request.question : null;
  const error = request?.error;
  const [draft, setDraft] = useState("");
  const [onCall, setOnCall] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const restoreFocus = useReturnFocus();
  const [closing, setClosing] = useState(false);
  const callTarget = useRef(target);

  // Each new pin (or opening the panel) puts the cursor in the question box.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the pinned finding changes
  useEffect(() => {
    input.current?.focus();
  }, [about]);

  // Each conversation starts with an empty box, or with its question that failed (maybe while
  // the panel was closed) ready to send again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on a new conversation or failure
  useEffect(() => {
    setDraft(request?.error ? request.question : "");
  }, [target.thread, request?.error]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the conversation as it grows
  useLayoutEffect(() => {
    const el = chat.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, pending, target.thread]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setDraft("");
    void askCoach(target, system, discussPrompt(briefing(), turns, text, about ?? undefined), text);
  };

  const startCall = () => {
    callTarget.current = target;
    return voiceCoachTask(briefing({ transcript: false }), about ?? undefined);
  };
  const onCallFinished = useCallback(({ lines }: CoachCallResult) => {
    const t = callTarget.current;
    void appendDiscussion(t, voiceTurns(lines, new Date().toISOString(), t.thread));
  }, []);

  /** Close and Escape hand focus back to the opener; a click elsewhere keeps it there. */
  const close = (returnFocus = true) => {
    if (onCall || closing) return;
    restoreFocus.current = returnFocus;
    if (hasAnimation(panel.current)) setClosing(true);
    else onClose();
  };
  useClickOutside(panel, () => close(false));
  const showStarters = !pending && turns.length === 0;

  return (
    <aside
      ref={panel}
      className={closing ? "coach-panel closing" : "coach-panel"}
      aria-label="Coach"
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <header className="coach-head">
        <h2 className="section-title">Coach</h2>
        <button type="button" className="link" disabled={onCall} onClick={() => close()}>
          {onCall ? "On a call" : "Close"}
        </button>
      </header>

      <div className="coach-about">
        {about ? (
          <>
            <p>
              <span className="finding-said">“{about.quote}”</span> →{" "}
              <strong>{about.better}</strong>
            </p>
            <button type="button" className="link" onClick={onClearAbout}>
              Whole report
            </button>
          </>
        ) : (
          <p className="muted">The whole report</p>
        )}
      </div>

      <div className="coach-chat" ref={chat}>
        {turns.length === 0 && !pending && (
          <p className="hint">
            Ask why something is wrong, for more examples, or whether a point was fair. The coach
            has the transcript, your scores and your earlier habits.
          </p>
        )}
        <ol className="chat">
          {turns.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an append-only conversation
            <li key={i} className={t.role === "you" ? "chat-you" : "chat-coach"}>
              <span className="script-speaker">
                {t.role === "you" ? "You" : "Coach"}
                {t.via === "voice" ? " · call" : ""}
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
              <li className="chat-coach">
                <span className="script-speaker">Coach</span>
                <div className="chat-text">
                  <p className="muted">Thinking…</p>
                </div>
              </li>
            </>
          )}
        </ol>
      </div>

      <div className="coach-compose">
        {showStarters && (
          <div className="starters">
            {(about ? FINDING_STARTERS : GENERAL_STARTERS).map((s) => (
              <button key={s} type="button" className="link" onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="chat-input">
          <label htmlFor="coach-input" className="visually-hidden">
            Your question
          </label>
          <textarea
            id="coach-input"
            ref={input}
            rows={2}
            value={draft}
            placeholder="Ask the coach. Enter sends, Shift+Enter adds a line."
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
          teaser="Talk instead"
          label={about ? "Talk this one through" : "Start the call"}
          frame={VOICE_COACH_FRAME}
          task={startCall}
          onFinished={onCallFinished}
          onLiveChange={setOnCall}
        />
      </div>
    </aside>
  );
}

/** When the panel goes away, focus returns to whatever opened it, unless told otherwise. */
function useReturnFocus() {
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const restore = useRef(true);
  useEffect(
    () => () => {
      if (restore.current) opener?.focus();
    },
    [opener],
  );
  return restore;
}

function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void) {
  const handler = useRef(onOutside);
  handler.current = onOutside;
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element;
      // Openers (Discuss links) re-target the panel instead of closing it.
      if (target.closest?.("[data-coach-opener]")) return;
      if (ref.current && !ref.current.contains(target)) handler.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref]);
}

/** Reduced motion (and test DOMs) have no animation, so there's no end event to wait for. */
function hasAnimation(el: HTMLElement | null): boolean {
  if (!el) return false;
  const name = getComputedStyle(el).animationName;
  return Boolean(name) && name !== "none";
}
