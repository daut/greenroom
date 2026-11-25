import { describe, expect, it, vi } from "vitest";
import { completeWithAnthropic } from "./anthropic";
import { completeWithClaudeCode, findClaudeBinary, type Run } from "./claude-code";
import { completeWithOpenAI } from "./openai";

const schema = { type: "object", properties: { n: { type: "number" } }, required: ["n"] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("completeWithAnthropic", () => {
  it("sends system + prompt and returns the text", async () => {
    const fetch = vi.fn(async (_u: string, _i: RequestInit) =>
      json({ content: [{ type: "text", text: "Hello" }] }),
    );

    const out = await completeWithAnthropic(
      { model: "claude-haiku-5-5", system: "S", prompt: "P", apiKey: "k" },
      fetch,
    );

    expect(out).toBe("Hello");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.headers).toMatchObject({ "x-api-key": "k", "anthropic-version": "2023-06-01" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "claude-haiku-5-5",
      system: "S",
      messages: [{ role: "user", content: "P" }],
    });
  });

  it("forces a tool call for structured output and returns its input", async () => {
    const fetch = vi.fn(async (_u: string, _i: RequestInit) =>
      json({ content: [{ type: "tool_use", name: "respond", input: { n: 3 } }] }),
    );

    const out = await completeWithAnthropic(
      { model: "m", system: "S", prompt: "P", apiKey: "k", schema },
      fetch,
    );

    expect(out).toEqual({ n: 3 });
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body.tools).toEqual([
      expect.objectContaining({ name: "respond", input_schema: schema }),
    ]);
    expect(body.tool_choice).toEqual({ type: "tool", name: "respond" });
  });

  it("explains API errors", async () => {
    const fetch = vi.fn(async () => json({ error: { message: "credit balance is too low" } }, 400));

    await expect(
      completeWithAnthropic({ model: "m", system: "", prompt: "", apiKey: "k" }, fetch),
    ).rejects.toThrow("Anthropic error (400): credit balance is too low");
  });
});

describe("completeWithOpenAI", () => {
  it("uses the Responses API and returns output text", async () => {
    const fetch = vi.fn(async (_u: string, _i: RequestInit) =>
      json({ output: [{ type: "message", content: [{ type: "output_text", text: "Hi" }] }] }),
    );

    const out = await completeWithOpenAI(
      { model: "gpt-5.6-luna", system: "S", prompt: "P", apiKey: "k" },
      fetch,
    );

    expect(out).toBe("Hi");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "gpt-5.6-luna",
      instructions: "S",
      input: "P",
    });
  });

  it("requests a JSON schema and parses the reply", async () => {
    const fetch = vi.fn(async (_u: string, _i: RequestInit) =>
      json({ output: [{ type: "message", content: [{ type: "output_text", text: '{"n":2}' }] }] }),
    );

    const out = await completeWithOpenAI(
      { model: "m", system: "", prompt: "", apiKey: "k", schema },
      fetch,
    );

    expect(out).toEqual({ n: 2 });
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body.text.format).toMatchObject({ type: "json_schema", schema });
  });
});

describe("findClaudeBinary", () => {
  it("finds claude on PATH or in the usual install locations", () => {
    const exists = (p: string) => p === "/opt/homebrew/bin/claude";

    expect(findClaudeBinary({ PATH: "/usr/bin:/bin", HOME: "/Users/me" }, exists)).toBe(
      "/opt/homebrew/bin/claude",
    );
    expect(findClaudeBinary({ PATH: "/usr/bin", HOME: "/Users/me" }, () => false)).toBeNull();
  });

  it("prefers PATH over fallbacks", () => {
    const exists = (p: string) => p === "/custom/claude" || p === "/opt/homebrew/bin/claude";

    expect(findClaudeBinary({ PATH: "/custom", HOME: "/h" }, exists)).toBe("/custom/claude");
  });
});

describe("completeWithClaudeCode", () => {
  const ok = (body: unknown): Run => vi.fn(async () => ({ stdout: JSON.stringify(body), code: 0 }));

  it("runs claude in print mode with no tools and a replaced system prompt", async () => {
    const run = ok({ type: "result", is_error: false, result: "Hello" });

    const out = await completeWithClaudeCode(
      { binary: "/bin/claude", model: "haiku", system: "S", prompt: "P" },
      run,
    );

    expect(out).toBe("Hello");
    const args = vi.mocked(run).mock.calls[0]?.[1] ?? [];
    expect(args).toEqual(
      expect.arrayContaining(["-p", "--output-format", "json", "--model", "haiku", "--tools", ""]),
    );
    expect(args[args.indexOf("--system-prompt") + 1]).toBe("S");
    expect(args).toContain("--no-session-persistence");
  });

  it("passes a JSON schema and returns structured output", async () => {
    const run = ok({ type: "result", is_error: false, result: "", structured_output: { n: 1 } });

    const out = await completeWithClaudeCode(
      { binary: "c", model: "m", system: "", prompt: "", schema },
      run,
    );

    expect(out).toEqual({ n: 1 });
    const args = vi.mocked(run).mock.calls[0]?.[1] ?? [];
    expect(JSON.parse(args[args.indexOf("--json-schema") + 1] ?? "")).toEqual(schema);
  });

  it("reports an error result", async () => {
    const run = ok({ type: "result", is_error: true, result: "Not logged in" });

    await expect(
      completeWithClaudeCode({ binary: "c", model: "m", system: "", prompt: "" }, run),
    ).rejects.toThrow("Claude Code: Not logged in");
  });
});
