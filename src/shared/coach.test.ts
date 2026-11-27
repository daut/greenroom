import { describe, expect, it } from "vitest";
import {
  coachBriefing,
  coachSystem,
  discussPrompt,
  threadKey,
  threadTurns,
  voiceCoachTask,
  voiceTurns,
  withDiscussion,
  withThreads,
} from "./coach";
import type { ChatTurn, Finding, Report } from "./report";
import type { ReportPhase, TrainingSession, VoiceRun } from "./training";

const phase: ReportPhase = {
  kind: "report",
  id: "report",
  title: "Corrections",
  source: "conversation",
  rubric: [{ id: "grammar", label: "Grammar", description: "Correct forms." }],
  system: "You are an English teacher.",
  background: () => "Learner level: B2.",
  guidance: "",
};

const run: VoiceRun = {
  choiceId: null,
  at: "2026-11-25T22:43:43.071Z",
  endedBy: "time",
  costUsd: 0,
  recordingPath: null,
  lines: [
    { speaker: "interviewer", text: "How would teams work?", startMs: 0, endMs: 1 },
    { speaker: "you", text: "How would it look like?", startMs: 2000, endMs: 3 },
  ],
};

const finding: Finding = {
  id: "f1",
  kind: "correction",
  criterion: "grammar",
  severity: 2,
  habit: "how … like in questions",
  line: 1,
  quote: "How would it look like?",
  better: "What would it look like?",
  why: "Use what … like, or how … alone.",
  recurring: true,
};

const report: Report = {
  runAt: run.at,
  scores: [{ criterion: "grammar", score: 3, comment: "Some slips." }],
  overall: 3,
  summary: "B2+.",
  strengths: ["Good analogies"],
  findings: [finding],
  focus: ["f1"],
  metrics: {
    wordsPerMinute: 120,
    talkRatio: 0.9,
    answers: 1,
    averageAnswerSeconds: 1,
    longestAnswerSeconds: 1,
    fillers: { "you know": 2 },
    fillersPerMinute: 2.5,
  },
};

const ctx = { artifact: () => undefined };

describe("coachBriefing", () => {
  it("gives the coach the goals, scores, findings with line numbers and the transcript", () => {
    const text = coachBriefing(phase, ctx, run, report, []);

    expect(text).toContain("Learner level: B2.");
    expect(text).toContain("Grammar: 3/5 — Some slips.");
    expect(text).toContain('[f1] correction, line #2, recurring: "How would it look like?"');
    expect(text).toContain("Focus first: f1");
    expect(text).toContain("#2 [0:02] Candidate: How would it look like?");
    expect(text).toContain("you know ×2");
  });

  it("includes reports scored before findings existed", () => {
    const old = {
      ...report,
      findings: undefined,
      focus: undefined,
      improvements: ["You said: a → Better: b"],
    };

    expect(coachBriefing(phase, ctx, run, old, [])).toContain("You said: a → Better: b");
  });

  it("can leave out the transcript for the voice coach", () => {
    expect(coachBriefing(phase, ctx, run, report, [], { transcript: false })).not.toContain(
      "#2 [0:02]",
    );
  });

  it("lists habits still open from earlier sessions", () => {
    const text = coachBriefing(phase, ctx, run, report, [
      { label: "articles", quote: "the my team", better: "my team" },
    ]);

    expect(text).toContain('- articles (e.g. "the my team" → "my team")');
  });
});

describe("coachSystem", () => {
  it("keeps the scorer's role and adds the coaching role", () => {
    const text = coachSystem(phase);

    expect(text.startsWith("You are an English teacher.")).toBe(true);
    expect(text).toMatch(/talking the learner through/);
  });
});

describe("discussPrompt", () => {
  it("replays the conversation so far, then the new question about a finding", () => {
    const prompt = discussPrompt(
      "BRIEFING",
      [
        { role: "you", text: "Why is it wrong?", at: "t1" },
        { role: "coach", text: "Because…", at: "t2" },
      ],
      "Give me more examples.",
      finding,
    );

    expect(prompt.indexOf("BRIEFING")).toBeLessThan(prompt.indexOf("Learner: Why is it wrong?"));
    expect(prompt).toContain("Coach: Because…");
    expect(prompt).toContain("about finding f1");
    expect(prompt).toContain("Learner: Give me more examples.");
  });
});

describe("voiceCoachTask", () => {
  it("starts with the chosen finding when there is one", () => {
    expect(voiceCoachTask("BRIEFING", finding)).toContain("Start with finding f1");
    expect(voiceCoachTask("BRIEFING")).toContain("focus findings");
  });
});

describe("voiceTurns", () => {
  it("turns a spoken discussion into chat turns marked as voice, in their thread", () => {
    expect(voiceTurns(run.lines, "t", "x")).toEqual([
      { role: "coach", text: "How would teams work?", at: "t", via: "voice", thread: "x" },
      { role: "you", text: "How would it look like?", at: "t", via: "voice", thread: "x" },
    ]);
  });
});

describe("threadTurns", () => {
  const other: Finding = { ...finding, id: "f2", quote: "He go.", better: "He goes." };
  const whole = threadKey(null);
  const f1 = threadKey(finding);

  it("keeps each finding's conversation apart from the others and the whole report", () => {
    const discussion: ChatTurn[] = [
      { role: "you", text: "a?", at: "t", thread: f1 },
      { role: "coach", text: "a.", at: "t", thread: f1 },
      { role: "you", text: "b?", at: "t", thread: threadKey(other) },
      { role: "coach", text: "b.", at: "t", thread: threadKey(other) },
      { role: "you", text: "c?", at: "t", thread: whole },
      { role: "coach", text: "c.", at: "t", thread: whole },
    ];

    expect(texts(threadTurns(discussion, [finding, other], f1))).toEqual(["a?", "a."]);
    expect(texts(threadTurns(discussion, [finding, other], whole))).toEqual(["c?", "c."]);
  });

  it("finds a finding's thread again after re-scoring gives it a new id", () => {
    const discussion: ChatTurn[] = [{ role: "you", text: "a?", at: "t", thread: f1 }];
    const rescored = { ...finding, id: "f7" };

    expect(texts(threadTurns(discussion, [rescored], threadKey(rescored)))).toEqual(["a?"]);
  });

  it("sorts older, untagged discussions by the finding each question was about", () => {
    const discussion: ChatTurn[] = [
      { role: "you", text: "general?", at: "t" },
      { role: "coach", text: "general.", at: "t" },
      { role: "you", text: "a?", at: "t", findingId: "f1" },
      { role: "coach", text: "a.", at: "t" },
      { role: "you", text: "gone?", at: "t", findingId: "f9" },
      { role: "coach", text: "gone.", at: "t" },
    ];

    expect(texts(threadTurns(discussion, [finding], f1))).toEqual(["a?", "a."]);
    expect(texts(threadTurns(discussion, [finding], whole))).toEqual([
      "general?",
      "general.",
      "gone?",
      "gone.",
    ]);
  });

  it("puts older calls with the whole report, even after a question about a finding", () => {
    const discussion: ChatTurn[] = [
      { role: "you", text: "a?", at: "t", findingId: "f1" },
      { role: "coach", text: "a.", at: "t" },
      { role: "coach", text: "Hi, which point?", at: "t", via: "voice" },
      { role: "you", text: "The first.", at: "t", via: "voice" },
    ];

    expect(texts(threadTurns(discussion, [finding], f1))).toEqual(["a?", "a."]);
    expect(texts(threadTurns(discussion, [finding], whole))).toEqual([
      "Hi, which point?",
      "The first.",
    ]);
  });
});

describe("withThreads", () => {
  it("tags older turns so they stay put when re-scoring renumbers the findings", () => {
    const discussion: ChatTurn[] = [
      { role: "you", text: "a?", at: "t", findingId: "f1" },
      { role: "coach", text: "a.", at: "t" },
    ];
    const tagged = withThreads(discussion, [finding]);
    const rescored = { ...finding, quote: "He go.", better: "He goes." };

    expect(threadTurns(tagged, [rescored], threadKey(rescored))).toEqual([]);
    expect(texts(threadTurns(tagged, [rescored], threadKey(finding)))).toEqual(["a?", "a."]);
  });
});

describe("withDiscussion", () => {
  it("appends turns to the run's report and leaves the other reports alone", () => {
    const session = {
      id: "s",
      trainingId: "t",
      title: "",
      createdAt: "",
      updatedAt: "",
      done: [],
      artifacts: { report: { [run.at]: report, other: report } },
    } as unknown as TrainingSession;
    const turn: ChatTurn = { role: "you", text: "q", at: "t", thread: "" };

    const next = withDiscussion(session, "report", run.at, [turn]);
    const reports = next.artifacts.report as Record<string, Report>;

    expect(reports[run.at]?.discussion).toEqual([turn]);
    expect(reports.other?.discussion).toBeUndefined();
  });

  it("leaves the session alone when the report is gone", () => {
    const session = { artifacts: {} } as unknown as TrainingSession;

    expect(withDiscussion(session, "report", run.at, [])).toBe(session);
  });
});

function texts(turns: ChatTurn[]): string[] {
  return turns.map((t) => t.text);
}
