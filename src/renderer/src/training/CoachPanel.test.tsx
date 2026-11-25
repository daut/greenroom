// @vitest-environment jsdom
import type { Finding } from "@shared/report";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachPanel } from "./CoachPanel";

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

function Harness({ about = null }: { about?: Finding | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open coach
      </button>
      {open && (
        <CoachPanel
          system=""
          briefing={() => ""}
          turns={[]}
          about={about}
          onClearAbout={() => {}}
          onAdd={() => {}}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("greenroom", { settings: { get: () => new Promise(() => {}) } });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function openFromButton() {
  const opener = screen.getByRole("button", { name: "Open coach" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("CoachPanel", () => {
  it("pins the finding being discussed and focuses the question box", () => {
    render(<Harness about={finding} />);
    openFromButton();

    expect(screen.getByRole("complementary", { name: "Coach" }).textContent).toContain(
      "How would it look like?",
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Your question"));
  });

  it("says it's about the whole report when no finding is picked", () => {
    render(<Harness />);
    openFromButton();

    expect(screen.getByText("The whole report")).toBeTruthy();
  });

  it("closes on Escape and gives focus back to what opened it", () => {
    render(<Harness about={finding} />);
    const opener = openFromButton();

    fireEvent.keyDown(screen.getByLabelText("Your question"), { key: "Escape" });

    expect(screen.queryByRole("complementary", { name: "Coach" })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
