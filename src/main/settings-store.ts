import { existsSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseSettings, type Settings } from "@shared/settings";
import { writeFileAtomic } from "./fs-utils";

export interface SettingsStore {
  load(): Settings;
  save(settings: Settings): Settings;
}

export function createSettingsStore(filePath: string): SettingsStore {
  return {
    load() {
      if (!existsSync(filePath)) return parseSettings({});
      try {
        return parseSettings(JSON.parse(readFileSync(filePath, "utf8")));
      } catch {
        backUpCorruptFile(filePath);
        return parseSettings({});
      }
    },
    save(settings) {
      const sanitized = parseSettings(settings);
      writeFileAtomic(filePath, `${JSON.stringify(sanitized, null, 2)}\n`);
      return sanitized;
    },
  };
}

function backUpCorruptFile(filePath: string) {
  renameSync(filePath, join(dirname(filePath), `settings.corrupt-${Date.now()}.json`));
}
