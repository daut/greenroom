import { describe, expect, it } from "vitest";
import {
  estimateReviewCostUsd,
  markWords,
  type PronunciationReply,
  pronunciationFindings,
  pronunciationPrompt,
  pronunciationSchema,
  reviewCostUsd,
  scoreFromUnderstandability,
} from "./pronunciation";

const lines = [
  { speaker: "interviewer" as const, text: "Tell me about it.", startMs: 0, endMs: 1000 },
  { speaker: "you" as const, text: "I think the throughput doubled.", startMs: 2000, endMs: 6000 },
];

const word = {
  line: 2,
  word: "think",
  heard: "tink",
  target: "think, with the tongue between the teeth for th",
  tip: "Push air over the tongue for th.",
  severity: 2,
  habit: "th as t",
  recurring: true,
};

const reply = (overrides: Partial<PronunciationReply> = {}): PronunciationReply => ({
  understandability: 80,
  summary: "Clear overall; th sounds slip.",
  words: [word],
  ...overrides,
});

describe("pronunciationSchema", () => {
  it("accepts a review and rejects out-of-range scores", () => {
    expect(pronunciationSchema.safeParse(reply()).success).toBe(true);
    expect(pronunciationSchema.safeParse(reply({ understandability: 140 })).success).toBe(false);
  });
});

describe("pronunciationPrompt", () => {
  it("anchors the score bands and lists what each clip should contain", () => {
    const prompt = pronunciationPrompt(
      lines,
      [{ line: 1, startMs: 1400, endMs: 6300 }],
      "Interview",
    );

    expect(prompt).toContain("90-100");
    expect(prompt).toContain("Interview");
    expect(prompt).toContain('Clip #2: "I think the throughput doubled."');
    expect(prompt).toMatch(/accent is not an error/i);
  });
});

describe("scoreFromUnderstandability", () => {
  it("maps the bands to the 1-5 rubric scale", () => {
    expect([100, 90, 89, 75, 60, 30, 10].map(scoreFromUnderstandability)).toEqual([
      5, 5, 4, 4, 3, 2, 1,
    ]);
  });
});

describe("pronunciationFindings", () => {
  it("turns flagged words into findings with their own ids, linked to transcript lines", () => {
    const findings = pronunciationFindings(
      reply({ words: [word, { ...word, word: "x", line: 9 }] }),
      lines,
      "clarity",
    );

    expect(findings[0]).toMatchObject({
      id: "p1",
      kind: "pronunciation",
      criterion: "clarity",
      line: 1,
      quote: "think",
      better: word.target,
      habit: "th as t",
      recurring: true,
    });
    expect(findings[0]?.why).toContain('Sounded like "tink"');
    expect(findings[1]).toMatchObject({ id: "p2", line: null });
  });
});

describe("markWords", () => {
  it("splits text around flagged words, whole words only, any case", () => {
    expect(markWords("I think, Think, rethink.", ["think"])).toEqual([
      { text: "I " },
      { text: "think", word: "think" },
      { text: ", " },
      { text: "Think", word: "think" },
      { text: ", rethink." },
    ]);
  });

  it("returns the text untouched when nothing is flagged", () => {
    expect(markWords("hello", [])).toEqual([{ text: "hello" }]);
  });
});

describe("review cost", () => {
  it("prices audio and text tokens separately", () => {
    const usd = reviewCostUsd("gpt-audio-1.5", {
      prompt_tokens: 1_000_000 + 1_000_000,
      completion_tokens: 1_000_000,
      prompt_tokens_details: { audio_tokens: 1_000_000 },
    });

    expect(usd).toBeCloseTo(32 + 2.5 + 10, 5);
  });

  it("estimates from the seconds of audio sent", () => {
    expect(estimateReviewCostUsd("gpt-audio-1.5", 60_000)).toBeGreaterThan(0.01);
    expect(estimateReviewCostUsd("gpt-audio-1.5", 60_000)).toBeLessThan(0.05);
    expect(estimateReviewCostUsd("unknown-model", 60_000)).toBeNull();
  });
});
