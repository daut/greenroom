import { describe, expect, it, vi } from "vitest";
import { testKey } from "./key-tester";

const respond = (status: number) => vi.fn(async () => new Response("{}", { status }));

describe("testKey", () => {
  it("sends the OpenAI key as a bearer token", async () => {
    const fetch = respond(200);

    const result = await testKey("openai", "sk-1", fetch);

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({ headers: { Authorization: "Bearer sk-1" } }),
    );
  });

  it("sends the Anthropic key with the version header", async () => {
    const fetch = respond(200);

    await testKey("anthropic", "sk-ant", fetch);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: { "x-api-key": "sk-ant", "anthropic-version": "2023-06-01" },
      }),
    );
  });

  it.each([
    [401, "Key rejected (401)"],
    [403, "Key lacks permission (403)"],
    [429, "Key valid but rate limited or out of credit (429)"],
    [500, "Provider error (500)"],
  ])("explains HTTP %i", async (status, message) => {
    expect(await testKey("openai", "sk", respond(status))).toEqual({ ok: false, message });
  });

  it("reports network failures", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    });

    expect(await testKey("openai", "sk", fetch)).toEqual({
      ok: false,
      message: "Network error: ENOTFOUND",
    });
  });

  it("fails fast without a key", async () => {
    const fetch = respond(200);

    expect(await testKey("openai", null, fetch)).toEqual({ ok: false, message: "No key set" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
