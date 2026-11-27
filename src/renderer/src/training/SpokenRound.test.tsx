// @vitest-environment jsdom
import type { SpokenDrill } from "@shared/drills";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpokenRound } from "./SpokenRound";

const base: SpokenDrill = {
  id: "d1",
  mode: "spoken",
  habit: "unclear vowel",
  at: "2026-11-27T15:56:13.234Z",
  lines: [],
  costUsd: 0,
};

const show = (drill: SpokenDrill) =>
  render(
    <ol>
      <SpokenRound drill={drill} busy={null} onCheck={() => {}} />
    </ol>,
  );

afterEach(cleanup);

describe("SpokenRound", () => {
  it("spells out the score and each try's verdict", () => {
    show({
      ...base,
      checkedBy: "audio",
      result: { correct: 1, total: 2, notes: "Clear when alone." },
      attempts: [
        { said: "Lunch.", ok: true, heard: "", why: "Short uh." },
        { said: "We'll have lunch after work.", ok: false, heard: "lanch", why: "Drifted to a." },
      ],
    });

    expect(screen.getByText("1 of 2 tries right.")).toBeTruthy();
    expect(screen.getByText(/checked by ear/i)).toBeTruthy();
    expect(screen.getByText(/sounded like “lanch”/)).toBeTruthy();
    expect(screen.getByText("Drifted to a.")).toBeTruthy();
  });

  it("says why a round wasn't scored and offers to check it again", () => {
    show({ ...base, unchecked: "Not scored: no recording." });

    expect(screen.getByText("Not scored")).toBeTruthy();
    expect(screen.getByText("Not scored: no recording.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check this round" })).toBeTruthy();
  });
});
