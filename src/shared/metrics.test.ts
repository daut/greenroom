import { describe, expect, it } from "vitest";
import { countFillers, speechMetrics } from "./metrics";

const you = (text: string, startMs: number, endMs: number | null) => ({
  speaker: "you" as const,
  text,
  startMs,
  endMs,
});
const them = (text: string, startMs: number, endMs: number | null) => ({
  speaker: "interviewer" as const,
  text,
  startMs,
  endMs,
});

describe("countFillers", () => {
  it("counts filler words and phrases, case-insensitively, as whole words", () => {
    expect(countFillers("Um, so, like, I basically, you know, uh did it. I like Go.")).toEqual({
      um: 1,
      uh: 1,
      like: 2,
      basically: 1,
      "you know": 1,
    });
  });

  it("doesn't match fillers inside other words", () => {
    expect(countFillers("Umbrella, likely, human")).toEqual({});
  });
});

describe("speechMetrics", () => {
  const lines = [
    them("Tell me about you.", 0, 2_000),
    you("I am an engineer um building tools for teams", 3_000, 9_000), // 9 words, 6 s
    them("And why?", 10_000, 11_000),
    you("Because I like it", 12_000, 14_000), // 4 words, 2 s
  ];

  it("measures pace over your speaking time only", () => {
    // 13 words in 8 s
    expect(speechMetrics(lines).wordsPerMinute).toBeCloseTo((13 / 8) * 60, 5);
  });

  it("measures talk ratio and answer lengths", () => {
    const m = speechMetrics(lines);

    expect(m.talkRatio).toBeCloseTo(8 / 11, 5);
    expect(m.answers).toBe(2);
    expect(m.averageAnswerSeconds).toBeCloseTo(4, 5);
    expect(m.longestAnswerSeconds).toBeCloseTo(6, 5);
  });

  it("reports fillers per minute of speaking", () => {
    const m = speechMetrics(lines);

    expect(m.fillers).toEqual({ um: 1, like: 1 });
    expect(m.fillersPerMinute).toBeCloseTo((2 / 8) * 60, 5);
  });

  it("falls back to an estimate when a turn has no end time", () => {
    const m = speechMetrics([you("one two three", 0, null)]);

    expect(m.answers).toBe(1);
    expect(m.wordsPerMinute).toBeGreaterThan(0);
  });

  it("returns zeros for an empty run", () => {
    expect(speechMetrics([])).toEqual({
      wordsPerMinute: 0,
      talkRatio: 0,
      answers: 0,
      averageAnswerSeconds: 0,
      longestAnswerSeconds: 0,
      fillers: {},
      fillersPerMinute: 0,
    });
  });
});
