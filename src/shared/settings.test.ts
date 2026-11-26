import { describe, expect, it } from "vitest";
import { activePersona, defaultSettings, parseSettings, withPersonaOverride } from "./settings";

describe("parseSettings", () => {
  it("returns defaults for empty or non-object input", () => {
    expect(parseSettings({})).toEqual(defaultSettings());
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings("garbage")).toEqual(defaultSettings());
  });

  it("keeps valid values and fills missing ones with defaults", () => {
    const parsed = parseSettings({ limits: { mockMaxMinutes: 45 } });

    expect(parsed.limits.mockMaxMinutes).toBe(45);
    expect(parsed.limits.drillMaxMinutes).toBe(defaultSettings().limits.drillMaxMinutes);
    expect(parsed.models).toEqual(defaultSettings().models);
  });

  it("falls back per field when a hand-edited value is invalid", () => {
    const parsed = parseSettings({
      limits: { mockMaxMinutes: -5, monthlyBudgetUsd: 30 },
      audio: "not-an-object",
    });

    expect(parsed.limits.mockMaxMinutes).toBe(defaultSettings().limits.mockMaxMinutes);
    expect(parsed.limits.monthlyBudgetUsd).toBe(30);
    expect(parsed.audio).toEqual(defaultSettings().audio);
  });

  it("defaults the text provider to the Anthropic API and rejects unknown providers", () => {
    expect(defaultSettings().text.provider).toBe("anthropic");
    expect(parseSettings({ text: { provider: "claude-code" } }).text.provider).toBe("claude-code");
    expect(parseSettings({ text: { provider: "gemini" } }).text.provider).toBe("anthropic");
  });

  it("repairs an invalid persona field without dropping the preset", () => {
    const [preset] = defaultSettings().interviewer.presets;
    const parsed = parseSettings({
      interviewer: { presets: [{ ...preset, name: "Mine", style: "furious" }] },
    });

    expect(parsed.interviewer.presets).toHaveLength(1);
    expect(parsed.interviewer.presets[0]?.name).toBe("Mine");
    expect(parsed.interviewer.presets[0]?.style).toBe("neutral");
  });

  it("restores default presets when the list is empty", () => {
    const parsed = parseSettings({ interviewer: { presets: [] } });

    expect(parsed.interviewer.presets.length).toBeGreaterThan(0);
  });
});

describe("activePersona", () => {
  it("returns the selected preset", () => {
    const settings = defaultSettings();
    const second = settings.interviewer.presets[1];
    if (!second) throw new Error("expected at least two default presets");

    settings.interviewer.activePresetId = second.id;

    expect(activePersona(settings)).toEqual(second);
  });

  it("falls back to the first preset when the selection is stale", () => {
    const settings = defaultSettings();
    settings.interviewer.activePresetId = "deleted";

    expect(activePersona(settings)).toEqual(settings.interviewer.presets[0]);
  });
});

describe("withPersonaOverride", () => {
  const base = activePersona(defaultSettings());

  it("changes the manner but keeps your voice, language and pace", () => {
    const tough = withPersonaOverride(base, { style: "tough", followUpDepth: 3 });

    expect(tough).toEqual({ ...base, style: "tough", followUpDepth: 3 });
  });

  it("ignores anything that isn't a valid override", () => {
    expect(withPersonaOverride(base, { style: "evil", voice: "x" })).toEqual(base);
    expect(withPersonaOverride(base, "nope")).toEqual(base);
    expect(withPersonaOverride(base, undefined)).toEqual(base);
  });
});
