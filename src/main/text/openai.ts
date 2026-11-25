import { apiError, type Fetch } from "./http";

const URL = "https://api.openai.com/v1/responses";

interface Request {
  model: string;
  system: string;
  prompt: string;
  apiKey: string;
  schema?: Record<string, unknown>;
}

/** Returns text, or the parsed object when `schema` is set. */
export async function completeWithOpenAI(
  { model, system, prompt, apiKey, schema }: Request,
  fetchImpl: Fetch = fetch,
): Promise<unknown> {
  const res = await fetchImpl(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      instructions: system,
      input: prompt,
      store: false,
      ...(schema && {
        text: { format: { type: "json_schema", name: "answer", schema, strict: false } },
      }),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw await apiError("OpenAI", res);

  const { output = [] } = (await res.json()) as { output?: OutputItem[] };
  const text = output
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
  return schema ? JSON.parse(text) : text;
}

interface OutputItem {
  type: string;
  content?: { type: string; text: string }[];
}
