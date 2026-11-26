import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TrainingSession } from "@shared/training";
import { beforeEach, describe, expect, it } from "vitest";
import { createSessionStore, type SessionStore } from "../session-store";
import { type RemoteRow, type SyncRemote, syncOnce } from "./engine";

function fakeRemote(
  rows: RemoteRow[] = [],
  files: Record<string, Buffer> = {},
): SyncRemote & {
  rows: Map<string, RemoteRow>;
  files: Record<string, Buffer>;
} {
  const map = new Map(rows.map((r) => [r.id, r]));
  return {
    rows: map,
    files,
    async listSessions() {
      return [...map.values()];
    },
    async upsertSessions(next) {
      for (const r of next) map.set(r.id, r);
    },
    async markDeleted(ids, at) {
      for (const id of ids) {
        const r = map.get(id);
        if (r) map.set(id, { ...r, deleted: true, updated_at: at });
      }
    },
    async listRecordings() {
      return Object.keys(files);
    },
    async uploadRecording(name, data) {
      files[name] = data;
    },
    async downloadRecording(name) {
      return files[name] ?? null;
    },
  };
}

let root: string;
let store: SessionStore;
let recordings: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "greenroom-sync-"));
  store = createSessionStore(join(root, "sessions"));
  recordings = join(root, "recordings");
  mkdirSync(recordings);
});

const session = (
  id: string,
  updatedAt: string,
  recordingPath: string | null = null,
): TrainingSession => ({
  id,
  trainingId: "interview",
  title: `S ${id}`,
  createdAt: updatedAt,
  updatedAt,
  done: [],
  artifacts: {
    mock: [{ choiceId: null, at: updatedAt, endedBy: null, lines: [], costUsd: 0, recordingPath }],
  },
});

const row = (s: TrainingSession, deleted = false): RemoteRow => ({
  id: s.id,
  training_id: s.trainingId,
  title: s.title,
  data: s,
  updated_at: s.updatedAt,
  deleted,
});

describe("syncOnce", () => {
  it("uploads new local sessions and their recordings", async () => {
    const file = join(recordings, "take1.webm");
    writeFileSync(file, "AUDIO");
    store.save(session("a", "2026-11-25T10:00:00.000Z", file));
    const remote = fakeRemote();

    const result = await syncOnce({ store, remote, recordingsDir: recordings });

    expect(result).toMatchObject({ uploaded: 1, downloaded: 0 });
    expect(remote.rows.get("a")?.title).toBe("S a");
    expect(remote.files["take1.webm"]?.toString()).toBe("AUDIO");
  });

  it("downloads remote sessions, relinking recordings to this machine's folder", async () => {
    const remoteSession = session("b", "2026-11-25T10:00:00.000Z", "/Users/other/rec/take2.webm");
    const remote = fakeRemote([row(remoteSession)], { "take2.webm": Buffer.from("SOUND") });

    await syncOnce({ store, remote, recordingsDir: recordings });

    const local = store.get("b");
    const run = (local?.artifacts.mock as { recordingPath: string }[] | undefined)?.[0];
    expect(run?.recordingPath).toBe(join(recordings, "take2.webm"));
    expect(readFileSync(join(recordings, "take2.webm"), "utf8")).toBe("SOUND");
  });

  it("syncs and relinks the mic-only recording too", async () => {
    const mic = join(recordings, "take3-mic.webm");
    writeFileSync(mic, "MIC");
    const withMic = (id: string, path: string): TrainingSession => {
      const s = session(id, "2026-11-25T10:00:00.000Z");
      const [run] = s.artifacts.mock as object[];
      return { ...s, artifacts: { mock: [{ ...run, micRecordingPath: path }] } };
    };
    store.save(withMic("c", mic));
    const remote = fakeRemote([row(withMic("d", "/Users/other/rec/take4-mic.webm"))], {
      "take4-mic.webm": Buffer.from("MIC2"),
    });

    await syncOnce({ store, remote, recordingsDir: recordings });

    expect(remote.files["take3-mic.webm"]?.toString()).toBe("MIC");
    const run = (store.get("d")?.artifacts.mock as { micRecordingPath: string }[] | undefined)?.[0];
    expect(run?.micRecordingPath).toBe(join(recordings, "take4-mic.webm"));
    expect(readFileSync(join(recordings, "take4-mic.webm"), "utf8")).toBe("MIC2");
  });

  it("propagates deletions both ways and clears tombstones", async () => {
    store.save(session("mine", "2026-11-25T10:00:00.000Z"));
    store.save(session("theirs", "2026-11-25T10:00:00.000Z"));
    store.remove("mine");
    const remote = fakeRemote([
      row(session("mine", "2026-11-25T10:00:00.000Z")),
      row(session("theirs", "2026-11-26T10:00:00.000Z"), true),
    ]);

    await syncOnce({
      store,
      remote,
      recordingsDir: recordings,
      now: () => "2026-11-27T00:00:00.000Z",
    });

    expect(remote.rows.get("mine")?.deleted).toBe(true);
    expect(store.get("theirs")).toBeNull();
    expect(store.tombstones()).toEqual([]);
  });

  it("skips recordings whose file is missing instead of failing", async () => {
    store.save(session("a", "2026-11-25T10:00:00.000Z", join(recordings, "gone.webm")));
    const remote = fakeRemote();

    await expect(syncOnce({ store, remote, recordingsDir: recordings })).resolves.toMatchObject({
      uploaded: 1,
    });
    expect(existsSync(join(recordings, "gone.webm"))).toBe(false);
  });
});
