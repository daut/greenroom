import { readFileSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { writeFileAtomic } from "./fs-utils";

/** Deletes recordings in `dir`; names are remembered so sync can delete the server copies. */
export function createRecordingTrash(dir: string) {
  const trashFile = join(dir, ".deleted.json");

  function remove(paths: string[]) {
    const names = paths.filter(isInRecordings).map((p) => basename(p));
    for (const name of names) rmSync(join(dir, name), { force: true });
    if (names.length) write([...new Set([...pending(), ...names])]);
  }

  function pending(): string[] {
    try {
      return JSON.parse(readFileSync(trashFile, "utf8")) as string[];
    } catch {
      return [];
    }
  }

  function clear(names: string[]) {
    write(pending().filter((name) => !names.includes(name)));
  }

  function isInRecordings(path: string): boolean {
    return dirname(resolve(path)) === resolve(dir);
  }

  function write(names: string[]) {
    writeFileAtomic(trashFile, JSON.stringify(names));
  }

  return { remove, pending, clear };
}

export type RecordingTrash = ReturnType<typeof createRecordingTrash>;
