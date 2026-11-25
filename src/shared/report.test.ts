import { describe, expect, it } from "vitest";
import { buildReport, formatTranscript, type RubricCriterion, scoringSchema } from "./report";

const rubric: RubricCriterion[] = [
  { id: "structure", label: "Structure", description: "STAR" },
  { id: "impact", label: "Impact", description: "Numbers" },
];

const run = {
  choiceId: null,
  at: "2026-11-25T10:00:00.000Z",
  endedBy: "interviewer",
  costUsd: 0.5,
  recordingPath: null,
  lines: [
    { speaker: "interviewer" as const, text: "Why?", startMs: 0, endMs: 1000 },
    { speaker: "you" as const, text: "Because um it mattered", startMs: 2000, endMs: 4000 },
  ],
};

describe("formatTranscript", () => {
  it("labels speakers and timestamps each turn", () => {
    expect(formatTranscript(run.lines)).toBe(
      "[0:00] Interviewer: Why?\n[0:02] Candidate: Because um it mattered",
    );
  });
});

describe("scoringSchema", () => {
  it("accepts a valid scored reply and rejects out-of-range scores", () => {
    const valid = {
      scores: [{ criterion: "structure", score: 4, comment: "Clear." }],
      summary: "Good.",
      strengths: ["a"],
      improvements: ["b"],
    };

    expect(scoringSchema.safeParse(valid).success).toBe(true);
    expect(
      scoringSchema.safeParse({ ...valid, scores: [{ criterion: "x", score: 9, comment: "" }] })
        .success,
    ).toBe(false);
  });
});

describe("buildReport", () => {
  it("keeps only rubric criteria, averages them and attaches speech metrics", () => {
    const report = buildReport(run, rubric, {
      scores: [
        { criterion: "structure", score: 4, comment: "Clear." },
        { criterion: "impact", score: 2, comment: "No numbers." },
        { criterion: "made-up", score: 5, comment: "?" },
      ],
      summary: "Solid start.",
      strengths: ["Calm"],
      improvements: ["Quantify"],
    });

    expect(report.runAt).toBe(run.at);
    expect(report.scores.map((s) => s.criterion)).toEqual(["structure", "impact"]);
    expect(report.overall).toBe(3);
    expect(report.metrics.answers).toBe(1);
    expect(report.metrics.fillers).toEqual({ um: 1 });
  });
});
