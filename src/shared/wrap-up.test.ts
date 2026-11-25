import { describe, expect, it } from "vitest";
import { graceMs, leadMs, nextWrapUpStep, type WrapUpInput } from "./wrap-up";

const MIN = 60_000;
const LIMIT = 30 * MIN;

function input(changes: Partial<WrapUpInput>): WrapUpInput {
  return {
    elapsedMs: 0,
    limitMs: LIMIT,
    youSpeaking: false,
    quietMs: 0,
    canPrompt: true,
    done: { warned: false, timeUp: false, prompted: false },
    ...changes,
  };
}

describe("wrap-up timing", () => {
  it("warns a share of the session ahead, between one and three minutes", () => {
    expect(leadMs(5 * MIN)).toBe(MIN);
    expect(leadMs(10 * MIN)).toBe(1.5 * MIN);
    expect(leadMs(LIMIT)).toBe(3 * MIN);
  });

  it("allows overtime for the last answer and the goodbye, between two and five minutes", () => {
    expect(graceMs(5 * MIN)).toBe(2 * MIN);
    expect(graceMs(15 * MIN)).toBe(3 * MIN);
    expect(graceMs(LIMIT)).toBe(5 * MIN);
  });
});

describe("nextWrapUpStep", () => {
  it("does nothing early on", () => {
    expect(nextWrapUpStep(input({ elapsedMs: 10 * MIN }))).toBe("none");
  });

  it("warns the interviewer quietly before the limit", () => {
    expect(nextWrapUpStep(input({ elapsedMs: 27 * MIN }))).toBe("warn");
  });

  it("tells the interviewer time is up at the limit, even while you speak", () => {
    const done = { warned: true, timeUp: false, prompted: false };
    expect(nextWrapUpStep(input({ elapsedMs: LIMIT, youSpeaking: true, done }))).toBe("time-up");
  });

  it("skips the warning when the limit is already passed", () => {
    expect(nextWrapUpStep(input({ elapsedMs: LIMIT }))).toBe("time-up");
  });

  it("asks for the goodbye only after a quiet stretch", () => {
    const done = { warned: true, timeUp: true, prompted: false };
    expect(nextWrapUpStep(input({ elapsedMs: LIMIT + MIN, quietMs: 1000, done }))).toBe("none");
    expect(nextWrapUpStep(input({ elapsedMs: LIMIT + MIN, quietMs: 5000, done }))).toBe(
      "prompt-goodbye",
    );
  });

  it("never prompts while the voice is only listening (a presentation before Q&A)", () => {
    const done = { warned: true, timeUp: true, prompted: false };
    expect(
      nextWrapUpStep(input({ elapsedMs: LIMIT + MIN, quietMs: 9000, canPrompt: false, done })),
    ).toBe("none");
  });

  it("prompts only once", () => {
    const done = { warned: true, timeUp: true, prompted: true };
    expect(nextWrapUpStep(input({ elapsedMs: LIMIT + MIN, quietMs: 9000, done }))).toBe("none");
  });

  it("hangs up after the overtime, but not in the middle of your sentence", () => {
    const done = { warned: true, timeUp: true, prompted: true };
    const over = LIMIT + graceMs(LIMIT);
    expect(nextWrapUpStep(input({ elapsedMs: over, youSpeaking: true, done }))).toBe("none");
    expect(nextWrapUpStep(input({ elapsedMs: over, done }))).toBe("hang-up");
  });

  it("hangs up regardless one minute after the overtime", () => {
    const done = { warned: true, timeUp: true, prompted: true };
    const elapsedMs = LIMIT + graceMs(LIMIT) + MIN;
    expect(nextWrapUpStep(input({ elapsedMs, youSpeaking: true, done }))).toBe("hang-up");
  });
});
