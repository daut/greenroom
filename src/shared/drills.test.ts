import { describe, expect, it } from "vitest";
import {
  type DrillTarget,
  drillPassed,
  drillTargets,
  spokenCheckPrompt,
  spokenDrillTask,
  spokenResult,
  typedCheckPrompt,
  typedDrillPrompt,
  typedResult,
} from "./drills";
import type { Habit } from "./habits";
import type { Finding, Report } from "./report";

function finding(id: string, habit: string, overrides: Partial<Finding> = {}): Finding {
  return {
    id,
    kind: "correction",
    criterion: "grammar",
    severity: 2,
    habit,
    line: 3,
    quote: "How would it look like?",
    better: "What would it look like?",
    why: "what … like, or how … alone",
    recurring: false,
    ...overrides,
  };
}

function report(runAt: string, findings: Finding[], focus: string[] = []): Report {
  return {
    runAt,
    scores: [],
    overall: 3,
    summary: "",
    strengths: [],
    findings,
    focus,
    metrics: {
      wordsPerMinute: 0,
      talkRatio: 0,
      answers: 0,
      averageAnswerSeconds: 0,
      longestAnswerSeconds: 0,
      fillers: {},
      fillersPerMinute: 0,
    },
  };
}

function habit(label: string, status: Habit["status"] = "open"): Habit {
  return {
    key: label,
    label,
    kind: "correction",
    quote: "q",
    better: "b",
    why: "w",
    seen: 1,
    drills: 0,
    firstSeen: "2025-01-01",
    lastSeen: "2025-01-01",
    status,
  };
}

const target: DrillTarget = {
  key: "how … like in questions",
  habit: "how … like in questions",
  kind: "correction",
  quote: "How would it look like?",
  better: "What would it look like?",
  why: "what … like, or how … alone",
  focus: true,
  earlier: false,
};

describe("drillTargets", () => {
  it("puts focus findings first, then the rest by severity, from the newest report", () => {
    const targets = drillTargets(
      [
        report(
          "2026-01-02",
          [finding("f1", "articles", { severity: 3 }), finding("f2", "how … like in questions")],
          ["f2"],
        ),
      ],
      [],
    );

    expect(targets.map((t) => [t.habit, t.focus])).toEqual([
      ["how … like in questions", true],
      ["articles", false],
    ]);
  });

  it("lists a habit once even when several runs found it, keeping the newest example", () => {
    const targets = drillTargets(
      [
        report("2026-01-01", [finding("f1", "Articles", { quote: "old" })]),
        report("2026-01-02", [finding("f1", "articles", { quote: "new" })]),
      ],
      [],
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]?.quote).toBe("new");
  });

  it("adds open habits from earlier sessions that this session didn't find, but not fixed ones", () => {
    const targets = drillTargets(
      [report("2026-01-02", [finding("f1", "articles")])],
      [habit("articles"), habit("so yeah endings", "improving"), habit("past simple", "fixed")],
    );

    expect(targets.map((t) => [t.habit, t.earlier])).toEqual([
      ["articles", false],
      ["so yeah endings", true],
    ]);
  });
});

describe("drill results", () => {
  it("scores typed reps by correct items", () => {
    expect(
      typedResult({
        notes: "ok",
        results: [
          { id: "1", correct: true, feedback: "", model: "" },
          { id: "2", correct: false, feedback: "", model: "" },
        ],
      }),
    ).toEqual({ correct: 1, total: 2, notes: "ok" });
  });

  it("never counts more correct spoken attempts than attempts", () => {
    expect(spokenResult({ attempts: 3, correct: 5, notes: "", slips: [] })).toMatchObject({
      correct: 3,
      total: 3,
    });
  });

  it("passes at 80% and never on zero attempts", () => {
    expect(drillPassed({ correct: 4, total: 5, notes: "" })).toBe(true);
    expect(drillPassed({ correct: 3, total: 5, notes: "" })).toBe(false);
    expect(drillPassed({ correct: 0, total: 0, notes: "" })).toBe(false);
  });
});

describe("drill prompts", () => {
  it("builds typed reps around the target and its rule", () => {
    const prompt = typedDrillPrompt("Learner level: B2.", target);

    expect(prompt).toContain("Learner level: B2.");
    expect(prompt).toContain("How would it look like?");
    expect(prompt).toContain("what … like, or how … alone");
  });

  it("checks typed answers item by item, marking blanks as wrong", () => {
    const prompt = typedCheckPrompt(
      "bg",
      target,
      [
        { id: "1", task: "Fix it", prompt: "How does it look like?" },
        { id: "2", task: "Fix it", prompt: "How it looks like?" },
      ],
      { "1": "What does it look like?" },
    );

    expect(prompt).toContain("[1] Fix it: How does it look like?\nAnswer: What does it look like?");
    expect(prompt).toContain("[2] Fix it: How it looks like?\nAnswer: (blank)");
  });

  it("lets the spoken drill partner correct on the spot", () => {
    const task = spokenDrillTask("bg", target);

    expect(task).toContain("What would it look like?");
    expect(task).toMatch(/correct/i);
  });

  it("checks only the learner's spoken attempts against the target", () => {
    const prompt = spokenCheckPrompt("bg", target, [
      { speaker: "interviewer", text: "Ask me about the design.", startMs: 0, endMs: 1 },
      { speaker: "you", text: "What would it look like?", startMs: 2000, endMs: 3 },
    ]);

    expect(prompt).toContain("Candidate: What would it look like?");
    expect(prompt).toContain("how … like in questions");
  });
});
