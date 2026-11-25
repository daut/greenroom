import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { TrainingSession } from "@shared/training";
import { writeFileAtomic } from "./fs-utils";

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** One JSON file per training session in `dir`. */
export function createSessionStore(dir: string) {
  const fileOf = (id: string) => join(dir, `${id}.json`);
  const tombstoneFile = join(dir, ".deleted.json");

  function get(id: string): TrainingSession | null {
    if (!SAFE_ID.test(id) || !existsSync(fileOf(id))) return null;
    return read(fileOf(id));
  }

  function list(): TrainingSession[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json") && !f.startsWith("."))
      .map((f) => read(join(dir, f)))
      .filter((s): s is TrainingSession => s !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function save(session: TrainingSession): TrainingSession {
    if (!SAFE_ID.test(session.id)) throw new Error(`Invalid session id: ${session.id}`);
    mkdirSync(dir, { recursive: true });
    writeFileAtomic(fileOf(session.id), JSON.stringify(session, null, 2));
    return session;
  }

  /** Deletes a session; local deletions are remembered so sync can propagate them. */
  function remove(id: string, { fromSync = false } = {}) {
    if (!SAFE_ID.test(id)) return;
    rmSync(fileOf(id), { force: true });
    if (!fromSync) writeTombstones([...new Set([...tombstones(), id])]);
  }

  function tombstones(): string[] {
    try {
      return JSON.parse(readFileSync(tombstoneFile, "utf8")) as string[];
    } catch {
      return [];
    }
  }

  function clearTombstones(ids: string[]) {
    writeTombstones(tombstones().filter((id) => !ids.includes(id)));
  }

  function writeTombstones(ids: string[]) {
    mkdirSync(dir, { recursive: true });
    writeFileAtomic(tombstoneFile, JSON.stringify(ids));
  }

  return { get, list, save, remove, tombstones, clearTombstones };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

function read(path: string): TrainingSession | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as TrainingSession;
    return typeof value?.id === "string" && typeof value.updatedAt === "string" ? value : null;
  } catch {
    return null;
  }
}
