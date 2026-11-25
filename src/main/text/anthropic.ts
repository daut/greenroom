import { apiError, type Fetch } from "./http";

const URL = "https://api.anthropic.com/v1/messages";
const TOOL = "respond";

interface Request {
  model: string;
  system: string;
  prompt: string;
  apiKey: string;
  schema?: Record<string, unknown>;
}

/** Returns text, or the parsed object when `schema` is set (via a forced tool call). */
export async function completeWithAnthropic(
  { model, system, prompt, apiKey, schema }: Request,
  fetchImpl: Fetch = fetch,
): Promise<unknown> {
  const res = await fetchImpl(URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: prompt }],
      ...(schema && {
        tools: [{ name: TOOL, description: "Return the answer.", input_schema: schema }],
        tool_choice: { type: "tool", name: TOOL },
      }),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw await apiError("Anthropic", res);

  const { content = [] } = (await res.json()) as { content?: ContentBlock[] };
  if (schema) {
    const call = content.find((b) => b.type === "tool_use");
    if (!call) throw new Error("Anthropic returned no structured answer.");
    return call.input;
  }
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

type ContentBlock = { type: "text"; text: string } | { type: "tool_use"; input: unknown };
