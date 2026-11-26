import type { ChatUsage } from "@shared/pronunciation";
import { apiError, type Fetch } from "./http";

const URL = "https://api.openai.com/v1/chat/completions";
const TOOL = "respond";

interface Request {
  model: string;
  system: string;
  prompt: string;
  apiKey: string;
  schema: Record<string, unknown>;
  /** WAV clips, each introduced by its label so the model can refer back to it. */
  clips: { label: string; wav: Uint8Array }[];
}

/**
 * Audio input needs Chat Completions (the Responses API takes text and images only).
 * Structured output comes from a forced tool call, which the audio models support.
 */
export async function reviewAudioWithOpenAI(
  { model, system, prompt, apiKey, schema, clips }: Request,
  fetchImpl: Fetch = fetch,
): Promise<{ reply: unknown; usage: ChatUsage }> {
  const res = await fetchImpl(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      modalities: ["text"],
      store: false,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...clips.flatMap((c) => [
              { type: "text", text: c.label },
              {
                type: "input_audio",
                input_audio: { data: Buffer.from(c.wav).toString("base64"), format: "wav" },
              },
            ]),
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: { name: TOOL, description: "Return the review.", parameters: schema },
        },
      ],
      tool_choice: { type: "function", function: { name: TOOL } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw await apiError("OpenAI", res);

  const { choices = [], usage = {} } = (await res.json()) as ChatResponse;
  const message = choices[0]?.message;
  const call = message?.tool_calls?.find((c) => c.function?.name === TOOL);
  const text = call?.function?.arguments ?? message?.content;
  if (!text) throw new Error("OpenAI returned no pronunciation review.");
  return { reply: JSON.parse(text), usage };
}

interface ChatResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { function?: { name?: string; arguments?: string } }[];
    };
  }[];
  usage?: ChatUsage;
}
