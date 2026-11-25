import { describe, expect, it, vi } from "vitest";
import { createRealtimeCall } from "./realtime-call";

const session = { type: "realtime", model: "gpt-realtime-2.1" };

describe("createRealtimeCall", () => {
  it("posts the SDP offer and session config with the API key, returning the answer", async () => {
    const fetch = vi.fn(
      async (_url: string, _init: RequestInit) => new Response("v=0 answer", { status: 201 }),
    );

    const answer = await createRealtimeCall({ sdp: "v=0 offer", session, apiKey: "sk-1" }, fetch);

    expect(answer).toBe("v=0 answer");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ Authorization: "Bearer sk-1" });
    const body = init?.body as FormData;
    expect(body.get("sdp")).toBe("v=0 offer");
    expect(JSON.parse(body.get("session") as string)).toEqual(session);
  });

  it("surfaces the API's error message", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Invalid model" } }), { status: 400 }),
    );

    await expect(createRealtimeCall({ sdp: "x", session, apiKey: "k" }, fetch)).rejects.toThrow(
      "OpenAI refused the session (400): Invalid model",
    );
  });

  it("explains auth failures", async () => {
    const fetch = vi.fn(async () => new Response("nope", { status: 401 }));

    await expect(createRealtimeCall({ sdp: "x", session, apiKey: "k" }, fetch)).rejects.toThrow(
      "OpenAI rejected the API key (401)",
    );
  });

  it("refuses to call without a key", async () => {
    const fetch = vi.fn();

    await expect(createRealtimeCall({ sdp: "x", session, apiKey: null }, fetch)).rejects.toThrow(
      "No OpenAI key set",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
