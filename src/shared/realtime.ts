import type { Persona } from "./settings";

export const END_SESSION_TOOL = "end_session";

/** USD per 1M tokens, from the OpenAI pricing page (Nov 2026). */
const RATES: Record<string, Rates> = {
  "gpt-realtime-2.1": rates({ text: 4, audio: 32, cached: 0.4 }, { text: 24, audio: 64 }),
  "gpt-realtime-2": rates({ text: 4, audio: 32, cached: 0.4 }, { text: 24, audio: 64 }),
  "gpt-realtime-2.1-mini": rates(
    { text: 0.6, audio: 10, cachedText: 0.06, cachedAudio: 0.3 },
    { text: 2.4, audio: 20 },
  ),
  "gpt-realtime-mini": rates(
    { text: 0.6, audio: 10, cachedText: 0.06, cachedAudio: 0.3 },
    { text: 2.4, audio: 20 },
  ),
};

const TRANSCRIPTION_MODEL = "gpt-transcribe";
const TRANSCRIPTION_USD_PER_MINUTE = 0.0045;

const EAGERNESS: Record<Persona["interruptions"], "low" | "auto" | "high"> = {
  none: "low",
  some: "auto",
  frequent: "high",
};

const SPEED: Record<Persona["pace"], number> = { slow: 0.9, normal: 1, fast: 1.15 };

export interface RealtimeSessionInput {
  model: string;
  persona: Persona;
  instructions: string;
}

export function buildRealtimeSession({ model, persona, instructions }: RealtimeSessionInput) {
  return {
    type: "realtime" as const,
    model,
    instructions,
    output_modalities: ["audio"],
    audio: {
      input: {
        turn_detection: {
          type: "semantic_vad" as const,
          eagerness: EAGERNESS[persona.interruptions],
          // The renderer's turn gate replies and interrupts, after filtering out noise.
          create_response: false,
          interrupt_response: false,
        },
        transcription: { model: TRANSCRIPTION_MODEL },
        noise_reduction: { type: "near_field" as const },
      },
      output: { voice: persona.voice, speed: SPEED[persona.pace] },
    },
    tools: [
      {
        type: "function" as const,
        name: END_SESSION_TOOL,
        description:
          "End the session. Call this right after your closing sentence, once the task is complete.",
        parameters: { type: "object", properties: {} },
      },
    ],
    tool_choice: "auto" as const,
    truncation: {
      type: "retention_ratio" as const,
      retention_ratio: 0.8,
      token_limits: { post_instructions: 8000 },
    },
  };
}

export type RealtimeSession = ReturnType<typeof buildRealtimeSession>;

export interface ResponseUsage {
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number };
  };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

/** Cost of one `response.done` usage block. */
export function costOfResponse(model: string, usage: ResponseUsage | undefined): number {
  const r = RATES[model];
  if (!r || !usage) return 0;
  const input = usage.input_token_details ?? {};
  const cached = input.cached_tokens_details ?? {};
  const output = usage.output_token_details ?? {};
  const cachedText = cached.text_tokens ?? 0;
  const cachedAudio = cached.audio_tokens ?? 0;

  const usd =
    ((input.text_tokens ?? 0) - cachedText) * r.inText +
    ((input.audio_tokens ?? 0) - cachedAudio) * r.inAudio +
    cachedText * r.cachedText +
    cachedAudio * r.cachedAudio +
    (output.text_tokens ?? 0) * r.outText +
    (output.audio_tokens ?? 0) * r.outAudio;
  return usd / 1_000_000;
}

export type TranscriptionUsage =
  | { type: "duration"; seconds: number }
  | { type: "tokens"; total_tokens?: number };

export function costOfTranscription(usage: TranscriptionUsage | undefined): number {
  if (usage?.type !== "duration") return 0;
  return (usage.seconds / 60) * TRANSCRIPTION_USD_PER_MINUTE;
}

interface Rates {
  inText: number;
  inAudio: number;
  cachedText: number;
  cachedAudio: number;
  outText: number;
  outAudio: number;
}

function rates(
  input: {
    text: number;
    audio: number;
    cached?: number;
    cachedText?: number;
    cachedAudio?: number;
  },
  output: { text: number; audio: number },
): Rates {
  return {
    inText: input.text,
    inAudio: input.audio,
    cachedText: input.cachedText ?? input.cached ?? 0,
    cachedAudio: input.cachedAudio ?? input.cached ?? 0,
    outText: output.text,
    outAudio: output.audio,
  };
}
