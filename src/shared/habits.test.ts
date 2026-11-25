import { describe, expect, it } from "vitest";
import { carryOverText, knownHabits, trackHabits } from "./habits";
import { type Finding, habitKey, type Report } from "./report";
import type { TrainingDefinition, TrainingSession } from "./training";

const def: TrainingDefinition = {
  id: "english",
  title: "English",
  summary: "",
  phases: [
    { kind: "voice", id: "conversation", title: "C", session: "drill", task: () => "" },
    {
      kind: "report",
      id: "report",
      title: "R",
      source: "conversation",
      rubric: [],
      system: "",
      background: () => "",
      guidance: "",
    },
    { kind: "drills", id: "drills", title: "D" },
  ],
};

function finding(habit: string, overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    kind: "correction",
    criterion: "grammar",
    severity: 2,
    habit,
    line: 0,
    quote: "How would it look like?",
    better: "What would it look like?",
    why: "rule",
    recurring: false,
    ...overrides,
  };
}

function report(at: string, findings: Finding[], habitReview: Report["habitReview"] = []): Report {
  return {
    runAt: at,
    scores: [],
    overall: 3,
    summary: "",
    strengths: [],
    findings,
    focus: [],
    habitReview,
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

function session(id: string, reports: Report[], drills: unknown[] = []): TrainingSession {
  return {
    id,
    trainingId: "english",
    title: id,
    createdAt: "",
    updatedAt: "",
    artifacts: {
      report: Object.fromEntries(reports.map((r) => [r.runAt, r])),
      drills,
    },
    done: [],
  };
}

describe("habitKey", () => {
  it("matches labels that differ only in case, quotes, spacing and punctuation", () => {
    expect(habitKey(' "How … like" in questions. ')).toBe(habitKey("how … like in  questions"));
  });
});

describe("trackHabits", () => {
  it("is empty without findings", () => {
    expect(trackHabits([session("a", [report("2026-01-01", [])])], def)).toEqual([]);
  });

  it("keeps noticeable or recurring findings and ignores minor one-offs", () => {
    const habits = trackHabits(
      [
        session("a", [
          report("2026-01-01", [
            finding("articles"),
            finding("tiny slip", { severity: 1 }),
            finding("repeated small thing", { severity: 1, recurring: true }),
          ]),
        ]),
      ],
      def,
    );

    expect(habits.map((h) => h.label).sort()).toEqual(["articles", "repeated small thing"]);
  });

  it("merges the same habit across sessions and keeps the latest example", () => {
    const habits = trackHabits(
      [
        session("a", [report("2026-01-01", [finding("Articles", { quote: "old" })])]),
        session("b", [report("2026-02-01", [finding("articles", { quote: "new" })])]),
      ],
      def,
    );

    expect(habits).toHaveLength(1);
    expect(habits[0]).toMatchObject({ quote: "new", seen: 2, status: "open" });
  });

  it("calls a habit improving after one good review and fixed after two in a row", () => {
    const first = report("2026-01-01", [finding("articles")]);
    const good = (at: string) =>
      report(at, [], [{ habit: "articles", status: "improved", note: "" }]);

    expect(trackHabits([session("a", [first, good("2026-01-02")])], def)[0]?.status).toBe(
      "improving",
    );
    expect(
      trackHabits([session("a", [first, good("2026-01-02"), good("2026-01-03")])], def)[0]?.status,
    ).toBe("fixed");
  });

  it("reopens a habit when it recurs, and ignores runs where it couldn't be heard", () => {
    const habits = trackHabits(
      [
        session("a", [
          report("2026-01-01", [finding("articles")]),
          report("2026-01-02", [], [{ habit: "articles", status: "improved", note: "" }]),
          report("2026-01-03", [], [{ habit: "articles", status: "recurred", note: "" }]),
          report("2026-01-04", [], [{ habit: "articles", status: "not-heard", note: "" }]),
        ]),
      ],
      def,
    );

    expect(habits[0]?.status).toBe("open");
    expect(habits[0]?.seen).toBe(2);
  });

  it("doesn't count a run as good for a habit it also slipped on", () => {
    const habits = trackHabits(
      [
        session("a", [
          report(
            "2026-01-01",
            [finding("articles")],
            [{ habit: "articles", status: "improved", note: "" }],
          ),
        ]),
      ],
      def,
    );

    expect(habits[0]?.status).toBe("open");
  });

  it("counts a passed drill after the last slip as improving", () => {
    const habits = trackHabits(
      [
        session(
          "a",
          [report("2026-01-01", [finding("articles")])],
          [
            {
              id: "d1",
              mode: "typed",
              habit: "articles",
              at: "2026-01-02",
              result: { correct: 5, total: 5 },
            },
          ],
        ),
      ],
      def,
    );

    expect(habits[0]?.status).toBe("improving");
    expect(habits[0]?.drills).toBe(1);
  });

  it("ignores other trainings' sessions", () => {
    const other = {
      ...session("x", [report("2026-01-01", [finding("articles")])]),
      trainingId: "interview",
    };

    expect(trackHabits([other], def)).toEqual([]);
  });
});

describe("knownHabits", () => {
  it("can leave out what happened from a given time on, so a run isn't its own history", () => {
    const sessions = [
      session("a", [
        report("2026-01-01", [finding("old one")]),
        report("2026-01-05", [finding("new one")]),
      ]),
    ];

    expect(knownHabits(sessions, def, { before: "2026-01-05" }).map((h) => h.label)).toEqual([
      "old one",
    ]);
  });

  it("passes the not-yet-fixed habits to the scorer, most recent first", () => {
    const sessions = [
      session("a", [
        report("2026-01-01", [finding("old one")]),
        report("2026-01-05", [finding("new one")]),
        report("2026-01-06", [], [{ habit: "old one", status: "improved", note: "" }]),
        report("2026-01-07", [], [{ habit: "old one", status: "improved", note: "" }]),
      ]),
    ];

    expect(knownHabits(sessions, def).map((h) => h.label)).toEqual(["new one"]);
  });
});

describe("carryOverText", () => {
  it("is empty without habits and lists the open ones with the better version", () => {
    const habits = trackHabits(
      [session("a", [report("2026-01-01", [finding("how … like")])])],
      def,
    );

    expect(carryOverText([])).toBe("");
    expect(carryOverText(habits)).toBe(
      'Still open from earlier sessions:\n- how … like: say "What would it look like?"',
    );
  });
});
