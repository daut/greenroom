import { defaultSettings, type Settings } from "@shared/settings";
import { describe, expect, it, vi } from "vitest";
import { createTextCompleter } from "./complete";

function settingsWith(provider: Settings["text"]["provider"]): Settings {
  const s = defaultSettings();
  s.text.provider = provider;
  s.models.generate = "gen-model";
  return s;
}

const request = { role: "generate" as const, system: "S", prompt: "P" };

function deps(provider: Settings["text"]["provider"], keys: Record<string, string | null> = {}) {
  return {
    settings: () => settingsWith(provider),
    key: (p: "openai" | "anthropic") => keys[p] ?? null,
    claudeBinary: vi.fn(() => "/bin/claude" as string | null),
    claudeCodeEnabled: () => true,
    anthropic: vi.fn(async () => "from anthropic"),
    openai: vi.fn(async () => "from openai"),
    claudeCode: vi.fn(async () => "from claude code"),
  };
}

describe("createTextCompleter", () => {
  it("routes to the selected provider with the role's model", async () => {
    const d = deps("anthropic", { anthropic: "ak" });

    expect(await createTextCompleter(d)(request)).toBe("from anthropic");
    expect(d.anthropic).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gen-model", apiKey: "ak", system: "S", prompt: "P" }),
    );
  });

  it("uses the OpenAI key for the OpenAI provider", async () => {
    const d = deps("openai", { openai: "ok" });

    expect(await createTextCompleter(d)(request)).toBe("from openai");
  });

  it("uses the claude binary for Claude Code", async () => {
    const d = deps("claude-code");

    expect(await createTextCompleter(d)(request)).toBe("from claude code");
    expect(d.claudeCode).toHaveBeenCalledWith(expect.objectContaining({ binary: "/bin/claude" }));
  });

  it("refuses Claude Code when this build has it turned off", async () => {
    const d = { ...deps("claude-code"), claudeCodeEnabled: () => false };

    await expect(createTextCompleter(d)(request)).rejects.toThrow("turned off in this build");
    expect(d.claudeCode).not.toHaveBeenCalled();
  });

  it("explains a missing key or missing Claude Code", async () => {
    await expect(createTextCompleter(deps("anthropic"))(request)).rejects.toThrow(
      "No Anthropic key set",
    );
    const d = deps("claude-code");
    d.claudeBinary.mockReturnValue(null);
    await expect(createTextCompleter(d)(request)).rejects.toThrow("Claude Code is not installed");
  });
});
