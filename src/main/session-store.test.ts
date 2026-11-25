import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TrainingSession } from "@shared/training";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionStore } from "./session-store";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "greenroom-sessions-"));
});

const session = (id: string, updatedAt: string): TrainingSession => ({
  id,
  trainingId: "interview",
  title: `S ${id}`,
  createdAt: updatedAt,
  updatedAt,
  artifacts: { setup: { role: "x" } },
  done: ["setup"],
});

describe("session store", () => {
  it("saves and loads a session", () => {
    const store = createSessionStore(dir);
    store.save(session("a", "2026-11-25T10:00:00.000Z"));

    expect(createSessionStore(dir).get("a")?.artifacts).toEqual({ setup: { role: "x" } });
  });

  it("lists sessions newest first", () => {
    const store = createSessionStore(dir);
    store.save(session("old", "2026-11-01T10:00:00.000Z"));
    store.save(session("new", "2026-11-25T10:00:00.000Z"));

    expect(store.list().map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("deletes a session", () => {
    const store = createSessionStore(dir);
    store.save(session("a", "2026-11-25T10:00:00.000Z"));
    store.remove("a");

    expect(store.get("a")).toBeNull();
    expect(store.list()).toEqual([]);
  });

  it("remembers deletions for sync until they are cleared", () => {
    const store = createSessionStore(dir);
    store.save(session("a", "2026-11-25T10:00:00.000Z"));
    store.save(session("b", "2026-11-25T10:00:00.000Z"));

    store.remove("a");
    store.remove("b", { fromSync: true });

    expect(store.tombstones()).toEqual(["a"]);
    store.clearTombstones(["a"]);
    expect(store.tombstones()).toEqual([]);
  });

  it("skips unreadable files instead of failing the list", () => {
    const store = createSessionStore(dir);
    store.save(session("a", "2026-11-25T10:00:00.000Z"));
    writeFileSync(join(dir, "broken.json"), "{nope");

    expect(store.list().map((s) => s.id)).toEqual(["a"]);
  });

  it("refuses ids that could escape the folder", () => {
    const store = createSessionStore(dir);

    expect(() => store.save(session("../x", "2026-11-25T10:00:00.000Z"))).toThrow();
    expect(store.get("../../etc/passwd")).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
  });
});
