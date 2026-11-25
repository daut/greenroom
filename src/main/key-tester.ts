import type { KeyTestResult, Provider } from "@shared/keys";

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export async function testKey(
  provider: Provider,
  key: string | null,
  fetchImpl: Fetch = fetch,
): Promise<KeyTestResult> {
  if (!key) return { ok: false, message: "No key set" };
  try {
    const { url, headers } = modelsRequest(provider, key);
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10_000) });
    return res.ok
      ? { ok: true, message: "Key works" }
      : { ok: false, message: explain(res.status) };
  } catch (error) {
    return { ok: false, message: `Network error: ${(error as Error).message}` };
  }
}

function modelsRequest(
  provider: Provider,
  key: string,
): { url: string; headers: Record<string, string> } {
  if (provider === "openai") {
    return {
      url: "https://api.openai.com/v1/models",
      headers: { Authorization: `Bearer ${key}` },
    };
  }
  return {
    url: "https://api.anthropic.com/v1/models",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  };
}

function explain(status: number): string {
  if (status === 401) return "Key rejected (401)";
  if (status === 403) return "Key lacks permission (403)";
  if (status === 429) return "Key valid but rate limited or out of credit (429)";
  return `Provider error (${status})`;
}
