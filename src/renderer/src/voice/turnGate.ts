/**
 * Decides when the interviewer replies or stops talking, so background noise
 * (a chair squeak, a cough) can't trigger a turn. The session runs with
 * `create_response` and `interrupt_response` off; this gate sends those events instead.
 *
 * Thresholds come from session logs: noise lasted 1.1–1.6 s of audio (≤1.1 s wall),
 * the shortest real turn 1.9 s of audio (1.5 s wall).
 */
const LONG_TURN_MS = 1800;
const BARGE_IN_MS = 1200;

export type ClientEvent = { type: string; item_id?: string };

export interface TurnGate {
  onEvent(event: unknown, now: number): ClientEvent[];
  /** Call regularly; stops the interviewer once you've talked over it long enough. */
  tick(now: number): ClientEvent[];
  /** Asks for a reply now, after the current response, or after the turn you're taking. */
  reply(): ClientEvent[];
  /** Ends a listen-first stretch. */
  activate(): void;
}

export function createTurnGate({ active = true } = {}): TurnGate {
  let isActive = active;
  /** The response being generated right now. */
  let generating: string | null = null;
  let cancelled: string | null = null;
  /** The response whose audio is playing. */
  let playing: string | null = null;
  /** A reply was asked for while another response was still running. */
  let queued: { itemId: string | null } | null = null;
  /** The next `response.created` answers this turn. */
  let awaitingCreated: { itemId: string | null; discard: boolean; cancel: boolean } | null = null;
  /** The user is due a reply that a noise turn would otherwise swallow. */
  let owed = false;
  let bargeIn: { itemId: string; since: number | null } | null = null;
  const turns = new Map<string, Turn>();
  /** Replies to turns that turned out to be noise; delete their items once done. */
  const discarded = new Set<string>();
  const outputs = new Map<string, string[]>();

  return {
    onEvent(raw, now) {
      const event = raw as ServerEvent;
      switch (event.type) {
        case "response.created":
          return responseCreated(event.response.id);
        case "response.done":
          return responseDone(event.response.id, event.response.output ?? []);
        case "output_audio_buffer.started":
          playing = event.response_id;
          return [];
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          playing = null;
          return [];
      }
      if (!isActive) return [];
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          return speechStarted(event.item_id, event.audio_start_ms, now);
        case "input_audio_buffer.speech_stopped":
          return speechStopped(event.item_id, event.audio_end_ms);
        case "conversation.item.input_audio_transcription.completed":
          return transcribed(event.item_id, isMeaningfulTurn(event.transcript));
        case "conversation.item.input_audio_transcription.failed":
          return transcribed(event.item_id, true);
        default:
          return [];
      }
    },

    tick(now) {
      if (!isActive || bargeIn?.since == null || now - bargeIn.since < BARGE_IN_MS) return [];
      return interrupt();
    },

    reply() {
      if (isActive && takingTurn()) {
        owed = true;
        return [];
      }
      return requestReply(null);
    },

    activate() {
      isActive = true;
    },
  };

  function speechStarted(itemId: string, audioStartMs: number, now: number): ClientEvent[] {
    turns.set(itemId, { audioStartMs, replied: false, reply: null });
    if (playing) {
      bargeIn = { itemId, since: now };
      return [];
    }
    // Nothing audible yet: stop the reply as the server would, and owe one if this is noise.
    if (generating && generating !== cancelled) {
      owed = true;
      return cancel();
    }
    // Asked for but not created yet: same, once it exists.
    if (awaitingCreated) {
      owed = true;
      awaitingCreated.cancel = true;
    }
    return [];
  }

  function speechStopped(itemId: string, audioEndMs: number): ClientEvent[] {
    const turn = turns.get(itemId);
    if (!turn) return [];
    if (audioEndMs - turn.audioStartMs < LONG_TURN_MS) {
      if (bargeIn?.itemId === itemId) bargeIn.since = null;
      return [];
    }
    turn.replied = true;
    return [...(bargeIn?.itemId === itemId ? interrupt() : []), ...requestReply(itemId)];
  }

  function transcribed(itemId: string, meaningful: boolean): ClientEvent[] {
    const turn = turns.get(itemId);
    if (!turn) return [];
    turns.delete(itemId);
    const isBargeIn = bargeIn?.itemId === itemId;
    if (meaningful) {
      const stop = isBargeIn ? interrupt() : [];
      return turn.replied ? stop : [...stop, ...requestReply(itemId)];
    }
    if (isBargeIn) bargeIn = null;
    const dropped = turn.replied ? discardReply(itemId, turn) : [];
    const answerOwed = owed && !takingTurn() ? requestReply(null) : [];
    return [...dropped, deleteItem(itemId), ...answerOwed];
  }

  function responseCreated(id: string): ClientEvent[] {
    generating = id;
    const answering = awaitingCreated;
    awaitingCreated = null;
    if (answering?.discard) {
      discarded.add(id);
      return cancel();
    }
    const turn = answering?.itemId ? turns.get(answering.itemId) : undefined;
    if (turn) turn.reply = id;
    return answering?.cancel ? cancel() : [];
  }

  function responseDone(id: string, output: { id?: string }[]): ClientEvent[] {
    if (generating === id) generating = null;
    const items = output.flatMap((o) => (o.id ? [o.id] : []));
    const sent: ClientEvent[] = [];
    if (discarded.delete(id)) sent.push(...items.map(deleteItem));
    else outputs.set(id, items);
    if (queued) {
      const { itemId } = queued;
      queued = null;
      sent.push(...requestReply(itemId));
    }
    return sent;
  }

  function requestReply(itemId: string | null): ClientEvent[] {
    owed = false;
    if (generating) {
      queued = { itemId };
      return [];
    }
    awaitingCreated = { itemId, discard: false, cancel: false };
    return [{ type: "response.create" }];
  }

  function discardReply(itemId: string, turn: Turn): ClientEvent[] {
    if (queued?.itemId === itemId) {
      queued = null;
      return [];
    }
    const id = turn.reply;
    if (!id) {
      if (awaitingCreated?.itemId === itemId) awaitingCreated.discard = true;
      return [];
    }
    const sent: ClientEvent[] = [];
    if (generating === id) sent.push(...cancel());
    if (playing === id) sent.push(...clearAudio());
    const items = outputs.get(id);
    if (items) sent.push(...items.map(deleteItem));
    else discarded.add(id);
    return sent;
  }

  function interrupt(): ClientEvent[] {
    bargeIn = null;
    return [...(generating ? cancel() : []), ...clearAudio()];
  }

  function cancel(): ClientEvent[] {
    if (!generating || generating === cancelled) return [];
    cancelled = generating;
    return [{ type: "response.cancel" }];
  }

  /** On WebRTC this also truncates the interviewer's item to what you heard. */
  function clearAudio(): ClientEvent[] {
    if (!playing) return [];
    playing = null;
    return [{ type: "output_audio_buffer.clear" }];
  }

  function takingTurn(): boolean {
    for (const turn of turns.values()) if (!turn.replied) return true;
    return false;
  }

  function deleteItem(itemId: string): ClientEvent {
    return { type: "conversation.item.delete", item_id: itemId };
  }
}

/** False for transcripts of noise: empty, punctuation, or only filler sounds. */
export function isMeaningfulTurn(transcript: string): boolean {
  const words = transcript
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return words.some((word) => !FILLER.test(word));
}

const FILLER = /^(?:u+h*m*|h+m+|m+(?:h+m+)?|a+h+|e+h+|e+r+m*)$/;

interface Turn {
  audioStartMs: number;
  /** A reply was asked for (or this turn already stopped the interviewer and got one). */
  replied: boolean;
  reply: string | null;
}

type ServerEvent =
  | { type: "response.created"; response: { id: string } }
  | { type: "response.done"; response: { id: string; output?: { id?: string }[] } }
  | { type: "output_audio_buffer.started"; response_id: string }
  | { type: "output_audio_buffer.stopped" }
  | { type: "output_audio_buffer.cleared" }
  | { type: "input_audio_buffer.speech_started"; item_id: string; audio_start_ms: number }
  | { type: "input_audio_buffer.speech_stopped"; item_id: string; audio_end_ms: number }
  | {
      type: "conversation.item.input_audio_transcription.completed";
      item_id: string;
      transcript: string;
    }
  | { type: "conversation.item.input_audio_transcription.failed"; item_id: string }
  | { type: "other" };
