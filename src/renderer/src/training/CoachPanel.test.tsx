// @vitest-environment jsdom
import { threadKey } from "@shared/coach";
import type { ChatTurn, Finding, Report } from "@shared/report";
import type { TrainingSession } from "@shared/training";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachPanel } from "./CoachPanel";
import { useTrainingSession } from "./useTrainingSession";

const finding: Finding = {
  id: "f1",
  kind: "correction",
  criterion: "grammar",
  severity: 2,
  habit: "how … like",
  line: 1,
  quote: "How would it look like?",
  better: "What would it look like?",
  why: "rule",
  recurring: false,
};
const other: Finding = { ...finding, id: "f2", quote: "He go home.", better: "He goes home." };

let sessionId: string;
let n = 0;
let disk: Map<string, TrainingSession>;
let reply: (text: string) => void;
let fail: (error: Error) => void;

function Harness({ about = null }: { about?: Finding | null }) {
  const { session } = useTrainingSession(sessionId);
  const [open, setOpen] = useState(false);
  const report = (session?.artifacts.report as Record<string, Report> | undefined)?.run;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open coach
      </button>
      <input aria-label="Elsewhere" />
      {open && report && (
        <CoachPanel
          system=""
          briefing={() => ""}
          run={{ sessionId, phaseId: "report", runAt: "run" }}
          discussion={report.discussion ?? []}
          findings={[finding, other]}
          about={about}
          onClearAbout={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

beforeEach(() => {
  sessionId = `s${++n}`;
  disk = new Map([[sessionId, session([])]]);
  vi.stubGlobal("greenroom", {
    settings: { get: () => new Promise(() => {}) },
    text: {
      complete: () =>
        new Promise((resolve, reject) => {
          reply = resolve;
          fail = reject;
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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderLoaded(ui: React.ReactElement) {
  const result = render(ui);
  await act(async () => {});
  return result;
}

function openFromButton() {
  const opener = screen.getByRole("button", { name: "Open coach" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

function panel() {
  return screen.queryByRole("complementary", { name: "Coach" });
}

describe("CoachPanel", () => {
  it("pins the finding being discussed and focuses the question box", async () => {
    await renderLoaded(<Harness about={finding} />);
    openFromButton();

    expect(panel()?.textContent).toContain("How would it look like?");
    expect(document.activeElement).toBe(screen.getByLabelText("Your question"));
  });

  it("says it's about the whole report when no finding is picked", async () => {
    await renderLoaded(<Harness />);
    openFromButton();

    expect(screen.getByText("The whole report")).toBeTruthy();
  });

  it("closes on Escape and gives focus back to what opened it", async () => {
    await renderLoaded(<Harness about={finding} />);
    const opener = openFromButton();

    fireEvent.keyDown(screen.getByLabelText("Your question"), { key: "Escape" });

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on a click outside without pulling focus back to the opener", async () => {
    await renderLoaded(<Harness about={finding} />);
    openFromButton();
    const elsewhere = screen.getByLabelText("Elsewhere");

    fireEvent.pointerDown(elsewhere);
    elsewhere.focus();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(elsewhere);
  });

  it("stays open on a click inside", async () => {
    await renderLoaded(<Harness about={finding} />);
    openFromButton();

    fireEvent.pointerDown(screen.getByText("Whole report"));

    expect(panel()).toBeTruthy();
  });

  it("shows only the conversation about the pinned finding", async () => {
    disk.set(
      sessionId,
      session([
        { role: "you", text: "About f1?", at: "t", thread: threadKey(finding) },
        { role: "coach", text: "Yes, f1.", at: "t", thread: threadKey(finding) },
      ]),
    );
    const { rerender } = await renderLoaded(<Harness about={finding} />);
    openFromButton();
    expect(panel()?.textContent).toContain("Yes, f1.");

    rerender(<Harness about={other} />);

    expect(panel()?.textContent).not.toContain("Yes, f1.");
    expect(screen.getByRole("button", { name: "Why is this wrong?" })).toBeTruthy();
  });

  it("keeps waiting for the reply after it's closed and shows it when reopened", async () => {
    await renderLoaded(<Harness about={finding} />);
    openFromButton();
    fireEvent.click(screen.getByRole("button", { name: "Why is this wrong?" }));
    fireEvent.keyDown(screen.getByLabelText("Your question"), { key: "Escape" });

    openFromButton();
    expect(panel()?.textContent).toContain("Thinking…");
    fireEvent.keyDown(screen.getByLabelText("Your question"), { key: "Escape" });

    await act(async () => reply("Because what … like."));
    openFromButton();

    expect(panel()?.textContent).toContain("Because what … like.");
    expect(panel()?.textContent).not.toContain("Thinking…");
  });

  it("offers a question that failed while closed to send again, in its own conversation", async () => {
    const { rerender } = await renderLoaded(<Harness about={finding} />);
    openFromButton();
    fireEvent.click(screen.getByRole("button", { name: "Why is this wrong?" }));
    fireEvent.keyDown(screen.getByLabelText("Your question"), { key: "Escape" });

    await act(async () => fail(new Error("No credits")));
    openFromButton();

    expect(screen.getByRole("alert").textContent).toBe("No credits");
    expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).value).toBe(
      "Why is this wrong?",
    );

    rerender(<Harness about={other} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByLabelText("Your question") as HTMLTextAreaElement).value).toBe("");
  });

  it("saves the reply even when the session screen is gone", async () => {
    const { unmount } = await renderLoaded(<Harness about={finding} />);
    openFromButton();
    fireEvent.click(screen.getByRole("button", { name: "Why is this wrong?" }));
    unmount();

    await act(async () => reply("Because."));

    const reports = disk.get(sessionId)?.artifacts.report as Record<string, Report> | undefined;
    expect(reports?.run?.discussion?.map((t) => t.text)).toEqual([
      "Why is this wrong?",
      "Because.",
    ]);
  });
});

function session(discussion: ChatTurn[]): TrainingSession {
  return {
    id: sessionId,
    trainingId: "t",
    title: "",
    createdAt: "",
    updatedAt: "",
    done: [],
    artifacts: { report: { run: { runAt: "run", findings: [finding, other], discussion } } },
  };
}
