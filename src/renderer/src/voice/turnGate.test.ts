import { describe, expect, it } from "vitest";
import { createTurnGate, isMeaningfulTurn, type TurnGate } from "./turnGate";

const started = (item_id: string, audio_start_ms: number) => ({
  type: "input_audio_buffer.speech_started",
  item_id,
  audio_start_ms,
});
const stopped = (item_id: string, audio_end_ms: number) => ({
  type: "input_audio_buffer.speech_stopped",
  item_id,
  audio_end_ms,
});
const transcribed = (item_id: string, transcript: string) => ({
  type: "conversation.item.input_audio_transcription.completed",
  item_id,
  transcript,
});
const created = (id: string) => ({ type: "response.created", response: { id } });
const done = (id: string, items: string[] = []) => ({
  type: "response.done",
  response: { id, output: items.map((item) => ({ id: item })) },
});
const audioStarted = (response_id: string) => ({
  type: "output_audio_buffer.started",
  response_id,
});
const audioStopped = (response_id: string) => ({
  type: "output_audio_buffer.stopped",
  response_id,
});

const CREATE = { type: "response.create" };
const CANCEL = { type: "response.cancel" };
const CLEAR = { type: "output_audio_buffer.clear" };
const del = (item_id: string) => ({ type: "conversation.item.delete", item_id });

/** Feeds `[wall ms, event]` pairs, ticking before each like the session's timer would. */
function replay(gate: TurnGate, events: [number, object][]): object[] {
  return events.flatMap(([now, event]) => [...gate.tick(now), ...gate.onEvent(event, now)]);
}

/** The interviewer is mid-sentence, as at 116289 in the 2026-11-27 log. */
function interviewerTalking(gate: TurnGate) {
  replay(gate, [
    [0, created("r1")],
    [100, audioStarted("r1")],
    [2000, done("r1", ["a1"])],
  ]);
}

describe("turn gate", () => {
  it("ignores a chair squeak while the interviewer talks (2026-11-27 log, 116289)", () => {
    const gate = createTurnGate();
    interviewerTalking(gate);

    const sent = replay(gate, [
      [2500, started("u1", 113164)],
      [3134, stopped("u1", 114300)],
      [3626, transcribed("u1", "")],
    ]);

    expect(sent).toEqual([del("u1")]);
  });

  it("ignores noise in silence instead of re-asking (2026-11-25 log, 195570)", () => {
    const gate = createTurnGate();

    const sent = replay(gate, [
      [0, started("u1", 10_000)],
      [822, stopped("u1", 11_348)],
      [1300, transcribed("u1", "")],
    ]);

    expect(sent).toEqual([del("u1")]);
  });

  it("replies as soon as a long-enough turn ends, without waiting for the transcript", () => {
    const gate = createTurnGate();

    // "Do that." — the shortest real turn in the logs, 2048 ms of audio.
    expect(replay(gate, [[0, started("u1", 106_764)]])).toEqual([]);
    expect(replay(gate, [[1485, stopped("u1", 108_812)]])).toEqual([CREATE]);
    expect(replay(gate, [[2000, transcribed("u1", "Do that.")]])).toEqual([]);
  });

  it("replies to a short answer once its transcript has words", () => {
    const gate = createTurnGate();

    expect(
      replay(gate, [
        [0, started("u1", 0)],
        [700, stopped("u1", 1200)],
      ]),
    ).toEqual([]);
    expect(replay(gate, [[1200, transcribed("u1", "Yes.")]])).toEqual([CREATE]);
  });

  it("drops the reply it started when a long sound turns out to be noise", () => {
    const gate = createTurnGate();

    const sent = replay(gate, [
      [0, started("u1", 0)],
      [2000, stopped("u1", 2500)],
      [2010, created("r1")],
      [2600, transcribed("u1", "")],
      [2650, done("r1", ["a1"])],
    ]);

    expect(sent).toEqual([CREATE, CANCEL, del("u1"), del("a1")]);
  });

  it("stops the interviewer when you keep talking over it", () => {
    const gate = createTurnGate();
    interviewerTalking(gate);

    const sent = replay(gate, [
      [2500, started("u1", 0)],
      [3500, { type: "noop" }],
      [3750, { type: "noop" }],
      [3760, audioStopped("r1")],
      [6000, stopped("u1", 3500)],
    ]);

    expect(sent).toEqual([CLEAR, CREATE]);
  });

  it("stops the interviewer for a short interjection once its words come through", () => {
    const gate = createTurnGate();
    interviewerTalking(gate);

    const sent = replay(gate, [
      [2500, started("u1", 0)],
      [3100, stopped("u1", 900)],
      [3500, transcribed("u1", "Sorry, what?")],
    ]);

    expect(sent).toEqual([CLEAR, CREATE]);
  });

  it("cancels a reply that hasn't spoken yet when you resume, and still answers after noise", () => {
    const gate = createTurnGate();

    const sent = replay(gate, [
      [0, started("u1", 0)],
      [5000, stopped("u1", 5000)],
      [5005, created("r1")],
      [5600, started("u2", 5600)],
      [5620, done("r1")],
      [6300, stopped("u2", 6400)],
      [6700, transcribed("u1", "I usually wake up at six.")],
      [6800, transcribed("u2", "")],
    ]);

    expect(sent).toEqual([CREATE, CANCEL, del("u2"), CREATE]);
  });

  it("waits for a cancelled reply to finish before asking for the next one", () => {
    const gate = createTurnGate();

    const sent = replay(gate, [
      [0, started("u1", 0)],
      [5000, stopped("u1", 5000)],
      [5005, created("r1")],
      [5600, started("u2", 5600)],
      [8000, stopped("u2", 8000)],
      [8010, done("r1")],
    ]);

    expect(sent).toEqual([CREATE, CANCEL, CREATE]);
  });

  it("stays out of a listen-first stretch until activated", () => {
    const gate = createTurnGate({ active: false });

    const sent = replay(gate, [
      [0, started("u1", 0)],
      [5000, stopped("u1", 5000)],
      [5500, transcribed("u1", "")],
    ]);
    expect(sent).toEqual([]);

    gate.activate();
    expect(
      replay(gate, [
        [6000, started("u2", 6000)],
        [9000, stopped("u2", 9000)],
      ]),
    ).toEqual([CREATE]);
  });

  describe("reply()", () => {
    it("asks right away when nobody is talking", () => {
      expect(createTurnGate().reply()).toEqual([CREATE]);
    });

    it("waits out a turn in progress, and still replies if it was noise", () => {
      const gate = createTurnGate();
      replay(gate, [[0, started("u1", 0)]]);

      expect(gate.reply()).toEqual([]);
      expect(
        replay(gate, [
          [600, stopped("u1", 600)],
          [1000, transcribed("u1", "")],
        ]),
      ).toEqual([del("u1"), CREATE]);
    });
  });
});

describe("isMeaningfulTurn", () => {
  it.each(["Yes.", "Do that.", "No", "Ja.", "はい"])("counts %j", (text) => {
    expect(isMeaningfulTurn(text)).toBe(true);
  });

  it.each(["", "  ", "...", "Hmm.", "Um", "uh...", "Mhm", "mm-hmm"])("drops %j", (text) => {
    expect(isMeaningfulTurn(text)).toBe(false);
  });
});
