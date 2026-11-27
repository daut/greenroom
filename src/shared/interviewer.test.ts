import { describe, expect, it } from "vitest";
import { interviewerInstructions } from "./interviewer";
import { defaultSettings, type Persona } from "./settings";

const persona = defaultSettings().interviewer.presets[0] as Persona;

describe("interviewerInstructions", () => {
  it("states the persona, language and the task", () => {
    const text = interviewerInstructions(
      { ...persona, style: "tough", language: "German" },
      "Run a two-minute warm-up.",
    );

    expect(text).toContain("A tough interviewer");
    expect(text).toContain("Speak only German");
    expect(text).toContain("Run a two-minute warm-up.");
  });

  it("uses a custom frame for non-interview trainings", () => {
    const text = interviewerInstructions(persona, "x", "You are an audience member.");

    expect(text.startsWith("You are an audience member.")).toBe(true);
    expect(text).not.toContain("job-interview rehearsal");
  });

  it("forbids coaching mid-interview so the rehearsal stays realistic", () => {
    expect(interviewerInstructions(persona, "x")).toMatch(/do not coach/i);
  });

  it("lets a coaching session correct the user", () => {
    const text = interviewerInstructions(persona, "x", "You are a coach.", { coach: true });

    expect(text).not.toMatch(/do not coach/i);
    expect(text).toMatch(/you are coaching/i);
  });

  it("has a coach speak once per turn and never answer for the user", () => {
    const text = interviewerInstructions(persona, "x", "Coach.", { coach: true });

    expect(text).toMatch(/one message per turn/i);
    expect(text).toMatch(/never speak for the user/i);
  });

  it("doesn't cast a coach as the interviewer persona, but keeps its language", () => {
    const text = interviewerInstructions({ ...persona, language: "German" }, "x", "Coach.", {
      coach: true,
    });

    expect(text).not.toMatch(/interviewer/i);
    expect(text).toContain("Speak only German");
  });

  it("tells the interviewer to end the session when the task is done", () => {
    expect(interviewerInstructions(persona, "x")).toContain("call end_session");
  });

  it("tells the interviewer to pick up after being cut off rather than restate", () => {
    expect(interviewerInstructions(persona, "x")).toMatch(/cut you off.*don't restate/i);
  });

  it("tells a non-interrupting interviewer to wait", () => {
    expect(interviewerInstructions({ ...persona, interruptions: "none" }, "x")).toMatch(
      /never interrupt/i,
    );
  });
});
