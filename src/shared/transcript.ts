import {
  costOfResponse,
  costOfTranscription,
  END_SESSION_TOOL,
  type ResponseUsage,
  type TranscriptionUsage,
} from "./realtime";

export type Speaker = "you" | "interviewer";

export interface TranscriptLine {
  id: string;
  speaker: Speaker;
  text: string;
  /** Milliseconds since session start (or whatever clock `at` uses). */
  startMs: number;
  endMs: number | null;
  final: boolean;
}

export interface TranscriptState {
  lines: TranscriptLine[];
  speaking: Speaker | null;
  costUsd: number;
  error: string | null;
  /** The interviewer called `end_session`: wrap up once its audio finishes. */
  endRequested: boolean;
  /** Interviewer audio is still playing out (WebRTC output buffer). */
  interviewerAudio: boolean;
  /** At least one response has started (used to avoid a second opening greeting). */
  responded: boolean;
  /** A response is being generated right now. */
  responding: boolean;
}

export function emptyTranscript(): TranscriptState {
  return {
    lines: [],
    speaking: null,
    costUsd: 0,
    error: null,
    endRequested: false,
    interviewerAudio: false,
    responded: false,
    responding: false,
  };
}

/** Folds one Realtime server event into the transcript. Unknown events are ignored. */
export function reduceEvent(
  state: TranscriptState,
  raw: unknown,
  { at, model }: { at: number; model: string },
): TranscriptState {
  const event = raw as RealtimeEvent;
  switch (event.type) {
    case "input_audio_buffer.speech_started":
      return {
        ...upsert(state, event.item_id, "you", { startMs: at }),
        speaking: "you",
      };
    case "input_audio_buffer.speech_stopped":
      return { ...patch(state, event.item_id, { endMs: at }), speaking: null };
    case "conversation.item.input_audio_transcription.completed": {
      const text = event.transcript.trim();
      const costUsd = state.costUsd + costOfTranscription(event.usage);
      if (!text) return { ...remove(state, event.item_id), costUsd };
      return { ...upsert(state, event.item_id, "you", { text, final: true }), costUsd };
    }
    case "response.created":
      return { ...state, responded: true, responding: true };
    case "response.output_audio_transcript.delta": {
      const current = find(state, event.item_id);
      return {
        ...upsert(state, event.item_id, "interviewer", {
          startMs: current?.startMs ?? at,
          text: (current?.text ?? "") + event.delta,
        }),
        speaking: "interviewer",
      };
    }
    case "response.output_audio_transcript.done":
      return {
        ...upsert(state, event.item_id, "interviewer", {
          text: event.transcript,
          endMs: at,
          final: true,
          startMs: find(state, event.item_id)?.startMs ?? at,
        }),
        speaking: null,
      };
    case "response.done":
      return {
        ...state,
        responding: false,
        costUsd: state.costUsd + costOfResponse(model, event.response?.usage),
        endRequested: state.endRequested || callsEndSession(event.response?.output),
      };
    case "output_audio_buffer.started":
      return { ...state, interviewerAudio: true };
    case "output_audio_buffer.stopped":
    case "output_audio_buffer.cleared":
      return { ...state, interviewerAudio: false };
    case "error":
      return { ...state, error: event.error?.message ?? "Unknown error" };
    default:
      return state;
  }
}

type RealtimeEvent =
  | { type: "input_audio_buffer.speech_started"; item_id: string }
  | { type: "input_audio_buffer.speech_stopped"; item_id: string }
  | {
      type: "conversation.item.input_audio_transcription.completed";
      item_id: string;
      transcript: string;
      usage?: TranscriptionUsage;
    }
  | { type: "response.output_audio_transcript.delta"; item_id: string; delta: string }
  | { type: "response.output_audio_transcript.done"; item_id: string; transcript: string }
  | {
      type: "response.done";
      response?: { usage?: ResponseUsage; output?: { type?: string; name?: string }[] };
    }
  | { type: "response.created" }
  | { type: "output_audio_buffer.started" }
  | { type: "output_audio_buffer.stopped" }
  | { type: "output_audio_buffer.cleared" }
  | { type: "error"; error?: { message?: string } }
  | { type: "other" };

function callsEndSession(output: { type?: string; name?: string }[] | undefined): boolean {
  return (output ?? []).some((o) => o.type === "function_call" && o.name === END_SESSION_TOOL);
}

function find(state: TranscriptState, id: string): TranscriptLine | undefined {
  return state.lines.find((l) => l.id === id);
}

function upsert(
  state: TranscriptState,
  id: string,
  speaker: Speaker,
  changes: Partial<TranscriptLine>,
): TranscriptState {
  if (find(state, id)) return patch(state, id, changes);
  const line: TranscriptLine = {
    id,
    speaker,
    text: "",
    startMs: changes.startMs ?? 0,
    endMs: null,
    final: false,
    ...changes,
  };
  return { ...state, lines: [...state.lines, line] };
}

function remove(state: TranscriptState, id: string): TranscriptState {
  return { ...state, lines: state.lines.filter((l) => l.id !== id) };
}

function patch(
  state: TranscriptState,
  id: string,
  changes: Partial<TranscriptLine>,
): TranscriptState {
  return { ...state, lines: state.lines.map((l) => (l.id === id ? { ...l, ...changes } : l)) };
}
