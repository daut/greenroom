import { describe, expect, it } from "vitest";
import {
  buildReport,
  formatTranscript,
  type RubricCriterion,
  type ScoringReply,
  scoringPrompt,
  scoringSchema,
} from "./report";
import type { ReportPhase } from "./training";

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

const finding = {
  id: "f1",
  kind: "correction" as const,
  criterion: "structure",
  severity: 2,
  habit: "how … like in questions",
  line: 2,
  quote: "How would it look like?",
  better: "What would it look like?",
  why: "Use what … like, or how … without like.",
  recurring: true,
};

function reply(overrides: Partial<ScoringReply> = {}): ScoringReply {
  return {
    scores: [
      { criterion: "structure", score: 4, comment: "Clear." },
      { criterion: "impact", score: 2, comment: "No numbers." },
    ],
    summary: "Solid start.",
    strengths: ["Calm"],
    findings: [finding],
    focus: ["f1"],
    habitReview: [],
    ...overrides,
  };
}

describe("formatTranscript", () => {
  it("numbers, labels and timestamps each turn", () => {
    expect(formatTranscript(run.lines)).toBe(
      "#1 [0:00] Interviewer: Why?\n#2 [0:02] Candidate: Because um it mattered",
    );
  });

  it("keeps the original line numbers when empty lines are skipped", () => {
    const lines = [{ ...run.lines[0], text: " " }, run.lines[1]] as typeof run.lines;

    expect(formatTranscript(lines)).toBe("#2 [0:02] Candidate: Because um it mattered");
  });
});

describe("scoringSchema", () => {
  it("accepts a valid reply and rejects out-of-range scores and severities", () => {
    expect(scoringSchema.safeParse(reply()).success).toBe(true);
    expect(
      scoringSchema.safeParse(reply({ scores: [{ criterion: "x", score: 9, comment: "" }] }))
        .success,
    ).toBe(false);
    expect(
      scoringSchema.safeParse(reply({ findings: [{ ...finding, severity: 7 }] })).success,
    ).toBe(false);
  });
});

describe("buildReport", () => {
  it("keeps only rubric criteria, averages them and attaches speech metrics", () => {
    const report = buildReport(
      run,
      rubric,
      reply({
        scores: [
          { criterion: "structure", score: 4, comment: "Clear." },
          { criterion: "impact", score: 2, comment: "No numbers." },
          { criterion: "made-up", score: 5, comment: "?" },
        ],
      }),
    );

    expect(report.runAt).toBe(run.at);
    expect(report.scores.map((s) => s.criterion)).toEqual(["structure", "impact"]);
    expect(report.overall).toBe(3);
    expect(report.metrics.answers).toBe(1);
    expect(report.metrics.fillers).toEqual({ um: 1 });
  });

  it("links each finding to its transcript line, or to none when the number is off", () => {
    const report = buildReport(
      run,
      rubric,
      reply({
        findings: [finding, { ...finding, id: "f2", line: 0 }, { ...finding, id: "f3", line: 9 }],
      }),
    );

    expect(report.findings?.map((f) => f.line)).toEqual([1, null, null]);
  });

  it("lists the most serious findings first", () => {
    const report = buildReport(
      run,
      rubric,
      reply({
        findings: [
          { ...finding, id: "minor", severity: 1 },
          { ...finding, id: "major", severity: 3 },
        ],
        focus: ["major"],
      }),
    );

    expect(report.findings?.map((f) => f.id)).toEqual(["major", "minor"]);
  });

  it("drops focus ids that don't exist and falls back to the most serious finding", () => {
    const report = buildReport(
      run,
      rubric,
      reply({
        findings: [
          { ...finding, id: "a", severity: 1 },
          { ...finding, id: "b", severity: 3 },
        ],
        focus: ["nope"],
      }),
    );

    expect(report.focus).toEqual(["b"]);
  });
});

describe("buildReport with an audio review", () => {
  const withAudio: RubricCriterion[] = [
    ...rubric,
    { id: "clarity", label: "Understandability", description: "Easy to follow", fromAudio: true },
  ];
  const audio = {
    ok: true as const,
    costUsd: 0.03,
    reply: {
      understandability: 62,
      summary: "Mostly clear.",
      words: [
        {
          line: 2,
          word: "mattered",
          heard: "madded",
          target: "MAT-terd",
          tip: "Tap the t.",
          severity: 3,
          habit: "t said as d",
          recurring: false,
        },
      ],
    },
  };

  it("scores audio criteria from the review, not the scorer, and adds its findings", () => {
    const report = buildReport(
      run,
      withAudio,
      reply({
        scores: [...reply().scores, { criterion: "clarity", score: 5, comment: "guessed" }],
        focus: ["p1"],
      }),
      audio,
    );

    expect(report.scores.find((s) => s.criterion === "clarity")).toEqual({
      criterion: "clarity",
      score: 3,
      comment: "Mostly clear.",
    });
    expect(report.overall).toBe(3);
    expect(report.findings?.map((f) => f.id)).toEqual(["p1", "f1"]);
    expect(report.focus).toEqual(["p1"]);
    expect(report.pronunciation).toMatchObject({ understandability: 62, costUsd: 0.03 });
    expect(report.pronunciation?.words).toEqual([
      { line: 1, word: "mattered", heard: "madded", target: "MAT-terd" },
    ]);
  });

  it("leaves audio criteria unscored and says why when there is no review", () => {
    const report = buildReport(run, withAudio, reply(), { ok: false, reason: "No recording." });

    expect(report.scores.map((s) => s.criterion)).toEqual(["structure", "impact"]);
    expect(report.pronunciationSkipped).toBe("No recording.");
  });
});

describe("scoringPrompt", () => {
  const phase: ReportPhase = {
    kind: "report",
    id: "report",
    title: "Report",
    source: "conversation",
    rubric,
    system: "You are a coach.",
    background: () => "Learner level: B2.",
    guidance: "Look for grammar slips.",
    maxFindings: 4,
  };
  const ctx = { artifact: () => undefined };

  it("gives the model the context, rubric, guidance, finding format and numbered transcript", () => {
    const prompt = scoringPrompt(phase, ctx, run, []);

    expect(prompt).toContain("Learner level: B2.");
    expect(prompt).toContain("- structure (Structure): STAR");
    expect(prompt).toContain("Look for grammar slips.");
    expect(prompt).toContain("up to 4");
    expect(prompt).toContain("#2 [0:02] Candidate: Because um it mattered");
    expect(prompt).not.toContain("Known habits");
  });

  it("leaves audio criteria to the review and shares its findings with the scorer", () => {
    const audioPhase: ReportPhase = {
      ...phase,
      rubric: [
        ...rubric,
        { id: "clarity", label: "Clarity", description: "Heard", fromAudio: true },
      ],
    };
    const prompt = scoringPrompt(audioPhase, ctx, run, [], {
      understandability: 70,
      summary: "Some slips.",
      words: [
        {
          line: 2,
          word: "mattered",
          heard: "madded",
          target: "MAT-terd",
          tip: "Tap the t.",
          severity: 2,
          habit: "t said as d",
          recurring: false,
        },
      ],
    });

    expect(prompt).not.toContain("- clarity (Clarity)");
    expect(prompt).toContain("70/100");
    expect(prompt).toContain('[p1] line #2 "mattered" sounded like "madded"');
  });

  it("asks for a review of the learner's known habits by their exact labels", () => {
    const prompt = scoringPrompt(phase, ctx, run, [
      {
        label: "how … like in questions",
        quote: "How it looks like",
        better: "What it looks like",
      },
    ]);

    expect(prompt).toContain("Known habits");
    expect(prompt).toContain('"how … like in questions"');
  });
});
