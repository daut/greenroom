type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/**
 * Starts a Realtime call with the renderer's SDP offer and returns OpenAI's SDP answer.
 * Runs in the main process so the API key never reaches the renderer.
 */
export async function createRealtimeCall(
  { sdp, session, apiKey }: { sdp: string; session: object; apiKey: string | null },
  fetchImpl: Fetch = fetch,
): Promise<string> {
  if (!apiKey) throw new Error("No OpenAI key set. Add one in Settings → Keys.");

  const body = new FormData();
  body.set("sdp", sdp);
  body.set("session", JSON.stringify(session));

  const res = await fetchImpl(CALLS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (res.ok) return text;
  throw new Error(describeFailure(res.status, text));
}

function describeFailure(status: number, body: string): string {
  if (status === 401) return "OpenAI rejected the API key (401). Check it in Settings → Keys.";
  if (status === 429) return "OpenAI rate limit or credit exhausted (429).";
  return `OpenAI refused the session (${status}): ${errorMessage(body)}`;
}

function errorMessage(body: string): string {
  try {
    return (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? body;
  } catch {
    return body.slice(0, 200);
  }
}
