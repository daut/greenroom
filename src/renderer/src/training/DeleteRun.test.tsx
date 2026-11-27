// @vitest-environment jsdom
import {
  newSession,
  type TrainingDefinition,
  type TrainingSession,
  type VoiceRun,
} from "@shared/training";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteRun } from "./DeleteRun";

const def = {
  id: "t",
  title: "T",
  summary: "",
  phases: [
    { kind: "voice", id: "mock", title: "Mock" },
    { kind: "report", id: "report", title: "Report", source: "mock" },
  ],
} as unknown as TrainingDefinition;

const run = {
  at: "r1",
  lines: [],
  recordingPath: "/rec/r1.webm",
  micRecordingPath: "/rec/r1.mic.webm",
} as unknown as VoiceRun;

const session: TrainingSession = {
  ...newSession(def, "s1"),
  artifacts: { mock: [run], report: { r1: { runAt: "r1" } } },
};

let deleteRecordings: ReturnType<typeof vi.fn>;

beforeEach(() => {
  deleteRecordings = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("greenroom", { voice: { deleteRecordings } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DeleteRun", () => {
  it("asks first, then deletes the run, its report and its recordings", () => {
    let saved = session;
    const update = vi.fn((change: (s: TrainingSession) => TrainingSession) => {
      saved = change(saved);
    });
    const onDeleted = vi.fn();
    render(
      <DeleteRun def={def} voicePhaseId="mock" run={run} update={update} onDeleted={onDeleted} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete run" }));

    expect(saved.artifacts).toEqual({ mock: [], report: {} });
    expect(deleteRecordings).toHaveBeenCalledWith(["/rec/r1.webm", "/rec/r1.mic.webm"]);
    expect(onDeleted).toHaveBeenCalled();
  });

  it("keeps the run when you change your mind", () => {
    const update = vi.fn();
    render(<DeleteRun def={def} voicePhaseId="mock" run={run} update={update} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    expect(update).not.toHaveBeenCalled();
    expect(deleteRecordings).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });
});
