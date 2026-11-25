import { describe, expect, it } from "vitest";
import { describePersona, estimateSessionCostUsd } from "./billing";
import { defaultSettings, type Persona } from "./settings";

const base = defaultSettings().interviewer.presets[0] as Persona;

describe("describePersona", () => {
  it("writes a readable billing line from every persona field", () => {
    const persona: Persona = {
      ...base,
      style: "tough",
      seniority: "senior",
      companyStyle: "faang",
      interruptions: "frequent",
      followUpDepth: 3,
      language: "English",
      pace: "fast",
    };

    expect(describePersona(persona)).toBe(
      "A tough interviewer at a FAANG-style company, hiring for senior roles. " +
        "Interrupts often and digs three follow-ups deep. Speaks English at a fast pace.",
    );
  });

  it("handles the gentle end of every scale", () => {
    const persona: Persona = {
      ...base,
      style: "friendly",
      seniority: "junior",
      companyStyle: "fintech, very process-heavy",
      interruptions: "none",
      followUpDepth: 0,
      pace: "slow",
    };

    expect(describePersona(persona)).toBe(
      "A friendly interviewer at a fintech, very process-heavy company, hiring for junior roles. " +
        "Lets you finish and moves on without follow-ups. Speaks English at a slow pace.",
    );
  });

  it("uses an article that fits the tone", () => {
    expect(describePersona({ ...base, style: "neutral" })).toMatch(/^A neutral interviewer/);
  });

  it("drops the company clause for the general style", () => {
    expect(describePersona({ ...base, companyStyle: "general" })).toMatch(
      /^A neutral interviewer hiring for senior roles\./,
    );
  });
});

describe("estimateSessionCostUsd", () => {
  it("multiplies the known per-minute rate by the session limit", () => {
    expect(estimateSessionCostUsd("gpt-realtime-2.1", 30)).toBeCloseTo(2.4);
    expect(estimateSessionCostUsd("gpt-realtime-2.1-mini", 5)).toBeCloseTo(0.15);
  });

  it("returns null for models it has no rate for", () => {
    expect(estimateSessionCostUsd("some-future-model", 10)).toBeNull();
  });
});
