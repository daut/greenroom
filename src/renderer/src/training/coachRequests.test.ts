// @vitest-environment jsdom
import type { ChatTurn, Report } from "@shared/report";
import type { TrainingSession } from "@shared/training";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askCoach, type CoachTarget, useCoachRequests } from "./coachRequests";
import { openSession } from "./sessionWrites";

let disk: Map<string, TrainingSession>;
let reply: { resolve: (text: string) => void; reject: (e: Error) => void };
let target: CoachTarget;
let n = 0;

beforeEach(() => {
  // Requests live for the whole app, so each test talks about a session of its own.
  target = { sessionId: `s${++n}`, phaseId: "report", runAt: "run", thread: "a→b" };
  disk = new Map([[target.sessionId, session(target.sessionId)]]);
  vi.stubGlobal("greenroom", {
    text: {
      complete: () =>
        new Promise((resolve, reject) => {
          reply = { resolve, reject };
        }),
    },
    sessions: {
      get: async (id: string) => disk.get(id) ?? null,
      save: async (s: TrainingSession) => {
        disk.set(s.id, s);
        return s;
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("askCoach", () => {
  it("saves the question and the reply to disk when no screen has the session open", async () => {
    const asking = askCoach(target, "system", "prompt", "Why?");
    reply.resolve(" Because. ");
    await asking;

    expect(discussionOnDisk()).toMatchObject([
      { role: "you", text: "Why?", thread: "a→b", via: "text" },
      { role: "coach", text: "Because.", thread: "a→b", via: "text" },
    ]);
  });

  it("hands the turns to the open session screen", async () => {
    const live = vi.fn();
    const close = openSession(target.sessionId, live);

    const asking = askCoach(target, "system", "prompt", "Why?");
    reply.resolve("Because.");
    await asking;
    close();

    expect(live).toHaveBeenCalledOnce();
    expect(discussionOnDisk()).toEqual([]);
  });

  it("shows the question as pending until the reply is saved", async () => {
    const { result } = renderHook(() => useCoachRequests());

    let asking: Promise<void> = Promise.resolve();
    act(() => {
      asking = askCoach(target, "system", "prompt", "Why?");
    });
    expect(result.current(target)).toEqual({ question: "Why?" });
    expect(result.current({ ...target, thread: "" })).toBeUndefined();

    await act(async () => {
      reply.resolve("Because.");
      await asking;
    });
    expect(result.current(target)).toBeUndefined();
  });

  it("keeps a failed question with the error until it's asked again", async () => {
    const { result } = renderHook(() => useCoachRequests());

    await act(async () => {
      const asking = askCoach(target, "system", "prompt", "Why?");
      reply.reject(new Error("No credits"));
      await asking;
    });
    expect(result.current(target)).toEqual({ question: "Why?", error: "No credits" });

    act(() => {
      void askCoach(target, "system", "prompt", "Why, again?");
    });
    expect(result.current(target)).toEqual({ question: "Why, again?" });
  });

  it("asks one question at a time per conversation", async () => {
    const complete = vi.spyOn(window.greenroom.text, "complete");

    const first = askCoach(target, "system", "prompt", "Why?");
    void askCoach(target, "system", "prompt", "And?");
    reply.resolve("Because.");
    await first;

    expect(complete).toHaveBeenCalledOnce();
  });
});

function discussionOnDisk(): ChatTurn[] {
  const reports = disk.get(target.sessionId)?.artifacts.report as Record<string, Report>;
  return reports.run?.discussion ?? [];
}

function session(id: string): TrainingSession {
  return {
    id,
    trainingId: "t",
    title: "",
    createdAt: "",
    updatedAt: "",
    done: [],
    artifacts: { report: { run: { runAt: "run", discussion: [] } } },
  };
}
