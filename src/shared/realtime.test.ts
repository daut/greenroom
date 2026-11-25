import { describe, expect, it } from "vitest";
import { buildRealtimeSession, costOfResponse, costOfTranscription } from "./realtime";
import { defaultSettings, type Persona } from "./settings";

const persona = defaultSettings().interviewer.presets[0] as Persona;

describe("buildRealtimeSession", () => {
  it("maps the persona onto voice, pace and turn-taking", () => {
    const session = buildRealtimeSession({
      model: "gpt-realtime-2.1",
      persona: { ...persona, voice: "cedar", pace: "fast", interruptions: "frequent" },
      instructions: "Interview me.",
    });

    expect(session).toMatchObject({
      type: "realtime",
      model: "gpt-realtime-2.1",
      instructions: "Interview me.",
      audio: {
        input: {
          turn_detection: { type: "semantic_vad", eagerness: "high" },
          transcription: { model: "gpt-transcribe" },
        },
        output: { voice: "cedar", speed: 1.15 },
      },
    });
  });

  it("filters near-field noise before turn detection", () => {
    const session = buildRealtimeSession({ model: "m", persona, instructions: "" });

    expect(session.audio.input.noise_reduction).toEqual({ type: "near_field" });
  });

  it("lets the candidate finish when interruptions are off", () => {
    const session = buildRealtimeSession({
      model: "m",
      persona: { ...persona, interruptions: "none", pace: "slow" },
      instructions: "",
    });

    expect(session.audio.input.turn_detection.eagerness).toBe("low");
    expect(session.audio.output.speed).toBe(0.9);
  });

  it("caps re-sent history so long sessions don't grow in cost per turn", () => {
    const session = buildRealtimeSession({ model: "m", persona, instructions: "" });

    expect(session.truncation).toEqual({
      type: "retention_ratio",
      retention_ratio: 0.8,
      token_limits: { post_instructions: 8000 },
    });
  });
});

describe("listen-first sessions", () => {
  it("don't auto-reply while the user presents", () => {
    const session = buildRealtimeSession({
      model: "m",
      persona,
      instructions: "",
      listenFirst: true,
    });

    expect(session.audio.input.turn_detection).toMatchObject({
      create_response: false,
      interrupt_response: false,
    });
  });

  it("reply normally by default", () => {
    const session = buildRealtimeSession({ model: "m", persona, instructions: "" });

    expect(session.audio.input.turn_detection).toMatchObject({
      create_response: true,
      interrupt_response: true,
    });
  });
});

describe("end_session tool", () => {
  it("lets the interviewer end the session itself", () => {
    const session = buildRealtimeSession({ model: "m", persona, instructions: "" });

    expect(session.tools).toEqual([
      expect.objectContaining({ type: "function", name: "end_session" }),
    ]);
    expect(session.tool_choice).toBe("auto");
  });
});

describe("costOfResponse", () => {
  const usage = {
    input_token_details: {
      text_tokens: 1_000,
      audio_tokens: 10_000,
      cached_tokens: 4_000,
      cached_tokens_details: { text_tokens: 1_000, audio_tokens: 3_000 },
    },
    output_token_details: { text_tokens: 500, audio_tokens: 5_000 },
  };

  it("prices uncached, cached and output tokens per modality", () => {
    // uncached: 0 text, 7000 audio; cached: 1000 text, 3000 audio
    const expected = (7_000 * 32 + 1_000 * 0.4 + 3_000 * 0.4 + 500 * 24 + 5_000 * 64) / 1_000_000;

    expect(costOfResponse("gpt-realtime-2.1", usage)).toBeCloseTo(expected, 8);
  });

  it("uses the mini rates for mini models", () => {
    const expected = (7_000 * 10 + 1_000 * 0.06 + 3_000 * 0.3 + 500 * 2.4 + 5_000 * 20) / 1e6;

    expect(costOfResponse("gpt-realtime-2.1-mini", usage)).toBeCloseTo(expected, 8);
  });

  it("returns 0 for unknown models or missing usage rather than guessing", () => {
    expect(costOfResponse("unknown", usage)).toBe(0);
    expect(costOfResponse("gpt-realtime-2.1", undefined)).toBe(0);
  });
});

describe("costOfTranscription", () => {
  it("prices duration-billed transcription per minute", () => {
    expect(costOfTranscription({ type: "duration", seconds: 60 })).toBeCloseTo(0.0045, 8);
  });

  it("ignores token-billed or missing usage", () => {
    expect(costOfTranscription({ type: "tokens", total_tokens: 20 })).toBe(0);
    expect(costOfTranscription(undefined)).toBe(0);
  });
});
