import type { TrainingSession } from "@shared/training";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSession, openSession, updateSession } from "./sessionWrites";

let disk: Map<string, TrainingSession>;

beforeEach(() => {
  disk = new Map([["s1", session("on disk")]]);
  vi.stubGlobal("window", {
    greenroom: {
      sessions: {
        get: async (id: string) => disk.get(id) ?? null,
        save: async (s: TrainingSession) => {
          disk.set(s.id, s);
          return s;
        },
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("updateSession", () => {
  it("writes to disk when the session isn't open", async () => {
    await updateSession("s1", (s) => ({ ...s, title: `${s.title}, changed` }));

    expect(disk.get("s1")?.title).toBe("on disk, changed");
  });

  it("applies changes one after another, so none is lost", async () => {
    await Promise.all([
      updateSession("s1", (s) => ({ ...s, title: `${s.title} a` })),
      updateSession("s1", (s) => ({ ...s, title: `${s.title} b` })),
    ]);

    expect(disk.get("s1")?.title).toBe("on disk a b");
  });

  it("hands the change to the open screen instead of the file", async () => {
    const live = vi.fn();
    const close = openSession("s1", live);
    const change = (s: TrainingSession) => s;

    await updateSession("s1", change);
    close();

    expect(live).toHaveBeenCalledWith(change);
    expect(disk.get("s1")?.title).toBe("on disk");
  });

  it("goes back to the file once the screen closes", async () => {
    openSession("s1", vi.fn())();

    await updateSession("s1", (s) => ({ ...s, title: "after" }));

    expect(disk.get("s1")?.title).toBe("after");
  });
});

describe("loadSession", () => {
  it("waits for writes still on their way to disk", async () => {
    const write = updateSession("s1", (s) => ({ ...s, title: "written" }));

    expect((await loadSession("s1"))?.title).toBe("written");
    await write;
  });
});

function session(title: string): TrainingSession {
  return {
    id: "s1",
    trainingId: "t",
    title,
    createdAt: "",
    updatedAt: "",
    artifacts: {},
    done: [],
  };
}
