import { describe, expect, it } from "vitest";
import type { Report } from "./report";
import type { ReportPhase, TrainingDefinition, TrainingSession } from "./training";
import { latestScore, scoreTrends } from "./trends";

const def: TrainingDefinition = {
  id: "interview",
  title: "Job interview",
  summary: "",
  phases: [
    { kind: "voice", id: "mock", title: "Mock", session: "mock", task: () => "" },
    {
      kind: "report",
      id: "report",
      title: "Mock report",
      source: "mock",
      rubric: [{ id: "structure", label: "Structure", description: "" }],
      system: "",
      background: () => "",
      guidance: "",
    },
  ],
};

const report = (runAt: string, overall: number): Report => ({
  runAt,
  overall,
  scores: [{ criterion: "structure", score: overall, comment: "" }],
  summary: "",
  strengths: [],
  improvements: [],
  metrics: {
    wordsPerMinute: 140,
    talkRatio: 0.6,
    answers: 5,
    averageAnswerSeconds: 60,
    longestAnswerSeconds: 90,
    fillers: {},
    fillersPerMinute: 2,
  },
});

const session = (id: string, reports: Report[]): TrainingSession => ({
  id,
  trainingId: "interview",
  title: `Session ${id}`,
  createdAt: "",
  updatedAt: "",
  done: [],
  artifacts: { report: Object.fromEntries(reports.map((r) => [r.runAt, r])) },
});

describe("scoreTrends", () => {
  it("collects reports from every session into one chronological series per report phase", () => {
    const trends = scoreTrends(
      [
        session("b", [report("2026-11-20T10:00:00Z", 3)]),
        session("a", [report("2026-11-10T10:00:00Z", 2), report("2026-11-25T10:00:00Z", 4)]),
      ],
      [def],
    );

    expect(trends).toHaveLength(1);
    expect(trends[0]?.title).toBe("Job interview · Mock report");
    expect(trends[0]?.points.map((p) => [p.overall, p.sessionTitle])).toEqual([
      [2, "Session a"],
      [3, "Session b"],
      [4, "Session a"],
    ]);
    expect(trends[0]?.points[0]?.scores).toEqual({ structure: 2 });
  });

  it("includes report phases that only some sessions have, like picked interview rounds", () => {
    const rounds: TrainingDefinition = {
      ...def,
      phasesFor: (ctx) =>
        ctx.artifact("design")
          ? [...def.phases, { ...(def.phases[1] as ReportPhase), id: "design", title: "Design" }]
          : def.phases,
    };
    const loop = session("a", []);
    loop.artifacts.design = { x: report("2026-11-25T10:00:00Z", 4) };

    expect(scoreTrends([session("b", []), loop], [rounds]).map((t) => t.title)).toEqual([
      "Job interview · Design",
    ]);
  });

  it("skips report phases with no reports and unknown trainings", () => {
    expect(scoreTrends([session("a", [])], [def])).toEqual([]);
    expect(
      scoreTrends(
        [{ ...session("x", [report("2026-11-01T00:00:00Z", 3)]), trainingId: "gone" }],
        [def],
      ),
    ).toEqual([]);
  });
});

describe("latestScore", () => {
  it("is the overall score of the most recent report in the session", () => {
    const s = session("a", [report("2026-11-25T10:00:00Z", 4), report("2026-11-10T10:00:00Z", 2)]);

    expect(latestScore(def, s)).toBe(4);
  });

  it("comes from the first report phase, not later side reports like drill notes", () => {
    const withDrill: TrainingDefinition = {
      ...def,
      phases: [...def.phases, { ...(def.phases[1] as ReportPhase), id: "notes" }],
    };
    const s = session("a", [report("2026-11-10T10:00:00Z", 2)]);
    s.artifacts.notes = { x: report("2026-11-25T10:00:00Z", 5) };

    expect(latestScore(withDrill, s)).toBe(2);
  });

  it("is null before anything is scored", () => {
    expect(latestScore(def, session("a", []))).toBeNull();
  });
});
