import { describe, expect, it } from "vitest";
import { emptyTranscript, reduceEvent, type TranscriptState } from "./transcript";

const MODEL = "gpt-realtime-2.1";

function run(events: [number, object][]): TranscriptState {
  return events.reduce(
    (state, [at, event]) => reduceEvent(state, event, { at, model: MODEL }),
    emptyTranscript(),
  );
}

describe("reduceEvent", () => {
  it("keeps user and interviewer turns in spoken order with timings", () => {
    const state = run([
      [1000, { type: "response.output_audio_transcript.delta", item_id: "a1", delta: "Tell me " }],
      [
        1200,
        { type: "response.output_audio_transcript.delta", item_id: "a1", delta: "about you." },
      ],
      [
        2500,
        {
          type: "response.output_audio_transcript.done",
          item_id: "a1",
          transcript: "Tell me about you.",
        },
      ],
      [3000, { type: "input_audio_buffer.speech_started", item_id: "u1" }],
      [9000, { type: "input_audio_buffer.speech_stopped", item_id: "u1" }],
      [
        9800,
        {
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "u1",
          transcript: "I build tools.",
        },
      ],
    ]);

    expect(state.lines).toEqual([
      {
        id: "a1",
        speaker: "interviewer",
        text: "Tell me about you.",
        startMs: 1000,
        endMs: 2500,
        final: true,
      },
      { id: "u1", speaker: "you", text: "I build tools.", startMs: 3000, endMs: 9000, final: true },
    ]);
  });

  it("shows the user's turn as soon as speech starts, before its transcript", () => {
    const state = run([[3000, { type: "input_audio_buffer.speech_started", item_id: "u1" }]]);

    expect(state.lines).toEqual([
      { id: "u1", speaker: "you", text: "", startMs: 3000, endMs: null, final: false },
    ]);
    expect(state.speaking).toBe("you");
  });

  it("tracks who is speaking", () => {
    const state = run([
      [1, { type: "input_audio_buffer.speech_started", item_id: "u1" }],
      [2, { type: "input_audio_buffer.speech_stopped", item_id: "u1" }],
      [3, { type: "response.output_audio_transcript.delta", item_id: "a1", delta: "Hi" }],
    ]);

    expect(state.speaking).toBe("interviewer");
    expect(
      run([[1, { type: "response.output_audio_transcript.done", item_id: "a1", transcript: "Hi" }]])
        .speaking,
    ).toBeNull();
  });

  it("accumulates cost from responses and transcription", () => {
    const state = run([
      [
        1,
        {
          type: "response.done",
          response: { usage: { output_token_details: { audio_tokens: 1_000_000 } } },
        },
      ],
      [
        2,
        {
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "u1",
          transcript: "x",
          usage: { type: "duration", seconds: 60 },
        },
      ],
    ]);

    expect(state.costUsd).toBeCloseTo(64 + 0.0045, 6);
  });

  it("records the latest API error", () => {
    const state = run([[1, { type: "error", error: { message: "Bad session" } }]]);

    expect(state.error).toBe("Bad session");
  });

  it("notices when the interviewer calls end_session", () => {
    const state = run([
      [
        1,
        {
          type: "response.done",
          response: { output: [{ type: "function_call", name: "end_session" }] },
        },
      ],
    ]);

    expect(state.endRequested).toBe(true);
  });

  it("ignores other function calls", () => {
    const state = run([
      [
        1,
        { type: "response.done", response: { output: [{ type: "function_call", name: "other" }] } },
      ],
    ]);

    expect(state.endRequested).toBe(false);
  });

  it("tracks whether interviewer audio is still playing", () => {
    expect(run([[1, { type: "output_audio_buffer.started" }]]).interviewerAudio).toBe(true);
    expect(
      run([
        [1, { type: "output_audio_buffer.started" }],
        [2, { type: "output_audio_buffer.stopped" }],
      ]).interviewerAudio,
    ).toBe(false);
  });

  it("drops a user turn whose transcription came back empty (noise or echo)", () => {
    const state = run([
      [1, { type: "input_audio_buffer.speech_started", item_id: "u1" }],
      [2, { type: "input_audio_buffer.speech_stopped", item_id: "u1" }],
      [
        3,
        {
          type: "conversation.item.input_audio_transcription.completed",
          item_id: "u1",
          transcript: "  ",
        },
      ],
    ]);

    expect(state.lines).toEqual([]);
  });

  it("drops lines the app deleted from the conversation (a reply to noise)", () => {
    const state = run([
      [1, { type: "response.output_audio_transcript.delta", item_id: "a1", delta: "Okay, " }],
      [2, { type: "conversation.item.deleted", item_id: "a1" }],
    ]);

    expect(state.lines).toEqual([]);
  });

  it("doesn't report a cancel that lost the race with the response finishing", () => {
    const state = run([
      [1, { type: "error", error: { code: "response_cancel_not_active", message: "x" } }],
    ]);

    expect(state.error).toBeNull();
  });

  it("knows whether the interviewer has started any response", () => {
    expect(run([]).responded).toBe(false);
    expect(run([[1, { type: "response.created", response: {} }]]).responded).toBe(true);
  });

  it("knows whether a response is being generated", () => {
    expect(run([[1, { type: "response.created", response: {} }]]).responding).toBe(true);
    expect(
      run([
        [1, { type: "response.created", response: {} }],
        [2, { type: "response.done", response: {} }],
      ]).responding,
    ).toBe(false);
  });

  it("ignores events it doesn't understand", () => {
    expect(
      run([
        [1, { type: "rate_limits.updated" }],
        [2, { nonsense: true }],
      ]),
    ).toEqual(emptyTranscript());
  });
});
