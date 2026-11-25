export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export async function apiError(provider: string, res: Response): Promise<Error> {
  const body = await res.text();
  let message = body.slice(0, 300);
  try {
    message = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? message;
  } catch {
    // Non-JSON error body: keep the raw text.
  }
  return new Error(`${provider} error (${res.status}): ${message}`);
}
