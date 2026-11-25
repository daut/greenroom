import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultSettings } from "@shared/settings";
import { beforeEach, describe, expect, it } from "vitest";
import { createSettingsStore } from "./settings-store";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "greenroom-settings-"));
  file = join(dir, "settings.json");
});

describe("settings store", () => {
  it("returns defaults when no file exists", () => {
    expect(createSettingsStore(file).load()).toEqual(defaultSettings());
  });

  it("persists saved settings across store instances", () => {
    const settings = defaultSettings();
    settings.limits.mockMaxMinutes = 42;

    createSettingsStore(file).save(settings);

    expect(createSettingsStore(file).load().limits.mockMaxMinutes).toBe(42);
  });

  it("writes human-readable JSON", () => {
    createSettingsStore(file).save(defaultSettings());

    expect(readFileSync(file, "utf8")).toContain('\n  "version": 1');
  });

  it("sanitizes invalid values on save", () => {
    const settings = defaultSettings();
    (settings.limits as { mockMaxMinutes: unknown }).mockMaxMinutes = "lots";

    const saved = createSettingsStore(file).save(settings);

    expect(saved.limits.mockMaxMinutes).toBe(defaultSettings().limits.mockMaxMinutes);
  });

  it("backs up a corrupt file and falls back to defaults", () => {
    writeFileSync(file, "{ not json");

    const loaded = createSettingsStore(file).load();

    expect(loaded).toEqual(defaultSettings());
    expect(readdirSync(dir).some((f) => f.startsWith("settings.corrupt-"))).toBe(true);
  });
});
