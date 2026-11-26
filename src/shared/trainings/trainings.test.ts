import { describe, expect, it } from "vitest";
import {
  CUSTOM_CHOICE,
  completePhase,
  contextOf,
  newSession,
  phaseState,
  RANDOM_CHOICE,
  type VoicePhase,
} from "../training";
import { englishTraining } from "./english";
import { TRAININGS } from "./index";
import { interviewTraining, type QuestionBank } from "./interview";

describe.each(TRAININGS.map((t) => [t.id, t] as const))("training %s", (_id, def) => {
  it("has unique phase ids and only valid dependencies", () => {
    const ids = def.phases.map((p) => p.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const p of def.phases) for (const d of p.after ?? []) expect(ids).toContain(d);
  });

  it("points every report at a voice phase", () => {
    for (const p of def.phases) {
      if (p.kind !== "report") continue;
      expect(def.phases.find((x) => x.id === p.source)?.kind).toBe("voice");
    }
  });

  it("has a report to coach its drills", () => {
    if (!def.phases.some((p) => p.kind === "drills")) return;
    expect(def.phases.some((p) => p.kind === "report")).toBe(true);
  });

  it("can reach every phase", () => {
    let session = newSession(def, "s");
    for (const p of def.phases) {
      expect(phaseState(def, session, p.id)).not.toBe("locked");
      session = completePhase(def, session, p.id, {});
    }
  });
});

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
