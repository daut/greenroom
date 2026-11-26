import { describe, expect, it } from "vitest";
import { encodeWav, pickClips, sliceClip } from "./clips";

const you = (startMs: number, endMs: number | null, text = "words") => ({
  speaker: "you" as const,
  text,
  startMs,
  endMs,
});
const them = (startMs: number, endMs: number) => ({
  speaker: "interviewer" as const,
  text: "question",
  startMs,
  endMs,
});

describe("pickClips", () => {
  const options = {
    maxTotalMs: 10_000,
    maxClipMs: 6_000,
    minClipMs: 1_000,
    padStartMs: 0,
    padEndMs: 0,
  };

  it("takes only your finished, non-empty turns, on the recording's clock", () => {
    const lines = [them(0, 1000), you(2000, 4000), you(5000, null), you(6000, 8000, " ")];

    expect(pickClips(lines, 500, options)).toEqual([{ line: 1, startMs: 1500, endMs: 3500 }]);
  });

  it("prefers the longest turns up to the total, then returns them in order", () => {
    const lines = [you(0, 2000), you(3000, 8000), you(9000, 13_000), you(14_000, 17_000)];

    const clips = pickClips(lines, 0, { ...options, minClipMs: 1500 });

    expect(clips.map((c) => c.line)).toEqual([1, 2]);
  });

  it("cuts long turns to the clip limit and fills the rest of the budget", () => {
    const lines = [you(0, 20_000), you(21_000, 26_000)];

    const clips = pickClips(lines, 0, options);

    expect(clips).toEqual([
      { line: 0, startMs: 0, endMs: 6000 },
      { line: 1, startMs: 21_000, endMs: 25_000 },
    ]);
  });

  it("skips turns too short to judge and pads the rest without going below zero", () => {
    const lines = [you(100, 600), you(1000, 3000)];

    expect(pickClips(lines, 0, { ...options, padStartMs: 300, padEndMs: 200 })).toEqual([
      { line: 1, startMs: 700, endMs: 3200 },
    ]);
    expect(pickClips([you(100, 2000)], 0, { ...options, padStartMs: 300 })[0]?.startMs).toBe(0);
  });
});

describe("sliceClip", () => {
  it("cuts the samples for a clip, clamped to the recording", () => {
    const samples = Float32Array.from({ length: 10 }, (_, i) => i);

    expect([...sliceClip(samples, 1000, { line: 0, startMs: 2, endMs: 5 })]).toEqual([2, 3, 4]);
    expect([...sliceClip(samples, 1000, { line: 0, startMs: 8, endMs: 50 })]).toEqual([8, 9]);
  });
});

describe("encodeWav", () => {
  it("writes a 16-bit mono PCM WAV with clipped samples", () => {
    const wav = new DataView(encodeWav(Float32Array.from([0, 1, -1, 2]), 16_000));
    const text = (at: number) =>
      String.fromCharCode(...new Uint8Array(wav.buffer.slice(at, at + 4)));

    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(wav.getUint16(22, true)).toBe(1);
    expect(wav.getUint32(24, true)).toBe(16_000);
    expect(wav.getUint16(34, true)).toBe(16);
    expect(wav.getUint32(40, true)).toBe(8);
    expect(wav.byteLength).toBe(44 + 8);
    expect([0, 1, 2, 3].map((i) => wav.getInt16(44 + i * 2, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });
});
