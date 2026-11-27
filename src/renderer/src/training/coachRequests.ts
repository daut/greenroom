import { withDiscussion } from "@shared/coach";
import type { ChatTurn } from "@shared/report";
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { errorMessage } from "../text";
import { askText } from "./ask";
import { updateSession } from "./sessionWrites";

/** One coach conversation: a finding's thread (or the whole report's) on one scored run. */
export interface CoachTarget {
  sessionId: string;
  phaseId: string;
  runAt: string;
  thread: string;
}

/** A question waiting for the coach, or the one that failed (kept until asked again). */
export interface CoachRequest {
  question: string;
  error?: string;
}

let requests: ReadonlyMap<string, CoachRequest> = new Map();
const listeners = new Set<() => void>();

/**
 * Asks the coach and saves both turns when the reply comes, whether or not the panel (or the
 * session) is still open. One question at a time per conversation.
 */
export async function askCoach(
  target: CoachTarget,
  system: string,
  prompt: string,
  question: string,
): Promise<void> {
  const key = keyOf(target);
  const current = requests.get(key);
  if (current && !current.error) return;
  setRequest(key, { question });
  try {
    const reply = await askText("score", system, prompt);
    const at = new Date().toISOString();
    let saved = Promise.resolve();
    // Show the reply before "Thinking…" goes, so the conversation never blinks empty.
    flushSync(() => {
      saved = appendDiscussion(target, [
        { role: "you", text: question, at, thread: target.thread, via: "text" },
        { role: "coach", text: reply, at, thread: target.thread, via: "text" },
      ]);
    });
    await saved;
    setRequest(key, undefined);
  } catch (e) {
    setRequest(key, { question, error: errorMessage(e) });
  }
}

export function appendDiscussion(target: CoachTarget, turns: ChatTurn[]): Promise<void> {
  return updateSession(target.sessionId, (s) =>
    withDiscussion(s, target.phaseId, target.runAt, turns),
  );
}

/** Looks up the request in flight (or failed) for any conversation; re-renders as they change. */
export function useCoachRequests(): (target: CoachTarget) => CoachRequest | undefined {
  const snapshot = useSyncExternalStore(subscribe, () => requests);
  return (target) => snapshot.get(keyOf(target));
}

function setRequest(key: string, request: CoachRequest | undefined) {
  const next = new Map(requests);
  if (request) next.set(key, request);
  else next.delete(key);
  requests = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function keyOf(t: CoachTarget): string {
  return JSON.stringify([t.sessionId, t.phaseId, t.runAt, t.thread]);
}
