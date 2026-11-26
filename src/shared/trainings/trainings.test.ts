import { describe, expect, it } from "vitest";
import type { Report, ReportArtifact } from "../report";
import {
  CUSTOM_CHOICE,
  completePhase,
  contextOf,
  type FormArtifact,
  type GeneratePhase,
  newSession,
  phaseState,
  phasesOf,
  RANDOM_CHOICE,
  saveArtifact,
  type TrainingDefinition,
  type TrainingSession,
  type VoicePhase,
} from "../training";
import { englishTraining } from "./english";
import { TRAININGS } from "./index";
import { interviewTraining, type QuestionBank } from "./interview";

/** Each training as a fresh session and with every option of its setup ticked. */
const variants = TRAININGS.flatMap((def) =>
  [{}, everythingPicked(def)].map(
    (setup) => [def.id, Object.keys(setup).length > 0, def, setup] as const,
  ),
);

describe.each(variants)("training %s (all picked: %s)", (_id, _all, def, setup) => {
  const setupId = def.phases[0]?.id ?? "";
  const phases = phasesOf(def, saveArtifact(newSession(def, "s"), setupId, setup));

  it("has unique phase ids and only valid dependencies", () => {
    const ids = phases.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const p of phases) for (const d of p.after ?? []) expect(ids).toContain(d);
  });

  it("points every report at a voice phase", () => {
    for (const p of phases) {
      if (p.kind !== "report") continue;
      expect(phases.find((x) => x.id === p.source)?.kind).toBe("voice");
    }
  });

  it("has a report to coach its drills", () => {
    if (!phases.some((p) => p.kind === "drills")) return;
    expect(phases.some((p) => p.kind === "report")).toBe(true);
  });

  it("can reach every phase", () => {
    let session = newSession(def, "s");
    for (const p of phases) {
      expect(phaseState(def, session, p.id)).not.toBe("locked");
      session = completePhase(def, session, p.id, p.id === setupId ? setup : {});
    }
  });
});

function everythingPicked(def: TrainingDefinition): FormArtifact {
  const setup = def.phases[0];
  if (setup?.kind !== "form") return {};
  return Object.fromEntries(
    setup.fields
      .filter((f) => f.kind === "pick")
      .map((f) => [f.id, (f.options ?? []).map((o) => o.id).join(",")]),
  );
}

const bank: QuestionBank = {
  questions: [
    {
      id: "q1",
      category: "behavioral",
      question: "Tell me about a conflict.",
      why: "",
      followUps: ["What did you learn?"],
    },
    { id: "q2", category: "technical", question: "Design a rate limiter.", why: "", followUps: [] },
  ],
};

function preparedSession() {
  let s = newSession(interviewTraining, "s");
  s = completePhase(interviewTraining, s, "setup", {
    role: "Staff engineer",
    company: "Acme",
    jobDescription: "Build things",
    cv: "Jane, 10 years",
  });
  return completePhase(interviewTraining, s, "questions", bank);
}

describe("interview training", () => {
  it("names the session after the role", () => {
    expect(preparedSession().title).toBe("Staff engineer at Acme");
  });

  it("lets you skip study cards and go straight to drills or the mock", () => {
    const s = preparedSession();

    expect(phaseState(interviewTraining, s, "study")).toBe("ready");
    expect(phaseState(interviewTraining, s, "drill")).toBe("ready");
    expect(phaseState(interviewTraining, s, "mock")).toBe("ready");
    expect(phaseState(interviewTraining, s, "report")).toBe("locked");
  });

  it("drills the chosen question and briefs the interviewer on the role", () => {
    const drill = interviewTraining.phases.find((p) => p.id === "drill") as VoicePhase;
    const ctx = contextOf(preparedSession());

    expect(drill.choices?.(ctx).map((c) => c.id)).toEqual(["q1", "q2"]);
    const task = drill.task(ctx, { id: "q2", label: "Design a rate limiter." });
    expect(task).toContain("Design a rate limiter.");
    expect(task).toContain("Staff engineer at Acme");
  });

  it("gives the mock interviewer the question bank", () => {
    const mock = interviewTraining.phases.find((p) => p.id === "mock") as VoicePhase;

    expect(mock.task(contextOf(preparedSession()), null)).toContain("Tell me about a conflict.");
  });
});

describe("interview loop", () => {
  const SETUP = {
    role: "Staff engineer",
    company: "Acme",
    jobDescription: "Build things",
    cv: "Jane, 10 years",
    rounds: "recruiter,design",
  };
  const loopBank = {
    questions: [
      { ...bank.questions[0], id: "q1", round: "recruiter" },
      { ...bank.questions[1], id: "q2", round: "design" },
    ],
  };
  const ids = (s: TrainingSession) => phasesOf(interviewTraining, s).map((p) => p.id);
  const phase = <T>(s: TrainingSession, id: string) =>
    phasesOf(interviewTraining, s).find((p) => p.id === id) as T;

  function loopSession() {
    const s = completePhase(interviewTraining, newSession(interviewTraining, "s"), "setup", SETUP);
    return completePhase(interviewTraining, s, "questions", loopBank);
  }

  function scored(s: TrainingSession, phaseId: string, summary: string): TrainingSession {
    const report: Report = {
      runAt: "2026-11-26T10:00:00Z",
      overall: 2.5,
      scores: [{ criterion: "structure", score: 2, comment: "" }],
      summary,
      strengths: [],
      findings: [],
      metrics: {
        wordsPerMinute: 140,
        talkRatio: 0.6,
        answers: 5,
        averageAnswerSeconds: 60,
        longestAnswerSeconds: 90,
        fillers: {},
        fillersPerMinute: 2,
      },
    };
    return completePhase(interviewTraining, s, phaseId, {
      [report.runAt]: report,
    } satisfies ReportArtifact);
  }

  it("is today's single mock interview when no rounds are picked", () => {
    const s = preparedSession();

    expect(ids(s)).toContain("mock");
    expect(ids(s).some((id) => id.startsWith("round-"))).toBe(false);
  });

  it("swaps the mock for the picked rounds, in loop order, then a debrief", () => {
    const s = loopSession();

    expect(ids(s)).not.toContain("mock");
    expect(ids(s)).toEqual(
      expect.arrayContaining([
        "round-recruiter",
        "round-recruiter-report",
        "round-design",
        "round-design-report",
        "debrief",
      ]),
    );
    expect(ids(s).indexOf("round-recruiter")).toBeLessThan(ids(s).indexOf("round-design"));
  });

  it("opens a round only once the previous round is scored", () => {
    let s = loopSession();
    expect(phaseState(interviewTraining, s, "round-recruiter")).toBe("ready");
    expect(phaseState(interviewTraining, s, "round-design")).toBe("locked");

    s = completePhase(interviewTraining, s, "round-recruiter", []);
    s = scored(s, "round-recruiter-report", "Vague on motivation.");
    expect(phaseState(interviewTraining, s, "round-design")).toBe("ready");
    expect(phaseState(interviewTraining, s, "debrief")).toBe("locked");
  });

  it("gives each round its own interviewer, its questions and the earlier rounds' notes", () => {
    const s = scored(loopSession(), "round-recruiter-report", "Vague on motivation.");
    const design = phase<VoicePhase>(s, "round-design");
    const task = design.task(contextOf(s), null);

    expect(design.persona?.style).toBe("tough");
    expect(design.scratchpad).toBeDefined();
    expect(task).toContain("Design a rate limiter.");
    expect(task).not.toContain("Tell me about a conflict.");
    expect(task).toContain("Vague on motivation.");
  });

  it("asks the bank for questions per round", () => {
    const questions = phase<GeneratePhase>(loopSession(), "questions");
    const prompt = questions.prompt(contextOf(loopSession()));

    expect(prompt).toContain("Recruiter screen");
    expect(prompt).toContain("System design");
    expect(prompt).not.toContain("Coding round");
  });

  it("debriefs on every round's report", () => {
    let s = scored(loopSession(), "round-recruiter-report", "Vague on motivation.");
    s = scored(s, "round-design-report", "Skipped capacity estimates.");
    const prompt = phase<GeneratePhase>(s, "debrief").prompt(contextOf(s));

    expect(prompt).toContain("Vague on motivation.");
    expect(prompt).toContain("Skipped capacity estimates.");
  });
});

describe("presentation training", () => {
  it("listens during the talk and hands over to Q&A", async () => {
    const { presentationTraining } = await import("./presentation");
    const rehearsal = presentationTraining.phases.find((p) => p.id === "rehearsal") as VoicePhase;

    expect(rehearsal.listenFirst?.button).toBe("Open the Q&A");
    expect(rehearsal.frame).toContain("audience");
  });
});

describe("english training", () => {
  const conversation = () =>
    englishTraining.phases.find((p) => p.id === "conversation") as VoicePhase;
  const ctx = () =>
    contextOf(
      completePhase(englishTraining, newSession(englishTraining, "s"), "setup", {
        level: "B1",
        focus: "past tenses",
      }),
    );

  it("offers a wide range of topics with unique ids", () => {
    const ids =
      conversation()
        .choices?.(ctx())
        .map((c) => c.id) ?? [];

    expect(ids.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(CUSTOM_CHOICE);
    expect(ids).not.toContain(RANDOM_CHOICE);
  });

  it("talks about a topic the learner typed", () => {
    const task = conversation().task(ctx(), { id: CUSTOM_CHOICE, label: "My cat's diet" });

    expect(task).toContain("My cat's diet");
    expect(task).toContain("B1");
  });

  it("asks for a random topic fitted to the learner, avoiding earlier ones", () => {
    const prompt = conversation().randomChoice?.prompt(ctx(), ["Your dream holiday"]) ?? "";

    expect(prompt).toContain("B1");
    expect(prompt).toContain("past tenses");
    expect(prompt).toContain("Your dream holiday");
  });
});
