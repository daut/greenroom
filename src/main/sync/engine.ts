import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { TrainingSession } from "@shared/training";
import type { SessionStore } from "../session-store";
import { planSync } from "./plan";

export interface RemoteRow {
  id: string;
  training_id: string;
  title: string;
  data: TrainingSession;
  updated_at: string;
  deleted: boolean;
}

/** What sync needs from the server; the Supabase adapter implements it. */
export interface SyncRemote {
  listSessions(): Promise<RemoteRow[]>;
  upsertSessions(rows: RemoteRow[]): Promise<void>;
  markDeleted(ids: string[], at: string): Promise<void>;
  listRecordings(): Promise<string[]>;
  uploadRecording(name: string, data: Buffer): Promise<void>;
  downloadRecording(name: string): Promise<Buffer | null>;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  deleted: number;
  recordingsUp: number;
  recordingsDown: number;
}

interface Options {
  store: SessionStore;
  remote: SyncRemote;
  recordingsDir: string;
  now?: () => string;
}

export async function syncOnce({
  store,
  remote,
  recordingsDir,
  now = () => new Date().toISOString(),
}: Options): Promise<SyncResult> {
  const local = store.list();
  const remoteRows = await remote.listSessions();
  const tombstones = store.tombstones();
  const plan = planSync(
    local,
    remoteRows.map((r) => ({ id: r.id, updatedAt: normalize(r.updated_at), deleted: r.deleted })),
    tombstones,
  );

  const uploads = local.filter((s) => plan.upload.includes(s.id));
  if (uploads.length) await remote.upsertSessions(uploads.map(toRow));
  if (plan.deleteRemote.length) await remote.markDeleted(plan.deleteRemote, now());
  store.clearTombstones(tombstones);

  for (const id of plan.deleteLocal) store.remove(id, { fromSync: true });
  const downloads = remoteRows.filter((r) => plan.download.includes(r.id));
  for (const r of downloads) store.save(relinkRecordings(r.data, recordingsDir));

  const files = await syncRecordings(store.list(), remote, recordingsDir);
  return {
    uploaded: uploads.length,
    downloaded: downloads.length,
    deleted: plan.deleteLocal.length + plan.deleteRemote.length,
    ...files,
  };
}

async function syncRecordings(sessions: TrainingSession[], remote: SyncRemote, dir: string) {
  const remoteNames = new Set(await remote.listRecordings());
  let recordingsUp = 0;
  let recordingsDown = 0;
  for (const path of recordingPaths(sessions)) {
    const name = basename(path);
    const localPath = join(dir, name);
    const here = existsSync(localPath);
    if (here && !remoteNames.has(name)) {
      await remote.uploadRecording(name, readFileSync(localPath));
      recordingsUp++;
    } else if (!here && remoteNames.has(name)) {
      const data = await remote.downloadRecording(name);
      if (data) {
        writeFileSync(localPath, data);
        recordingsDown++;
      }
    }
  }
  return { recordingsUp, recordingsDown };
}

/** Fields of a voice run that point at files in the recordings folder. */
const RECORDING_FIELDS = ["recordingPath", "micRecordingPath"] as const;
type RunFiles = Partial<Record<(typeof RECORDING_FIELDS)[number], string | null>>;

/** Recording paths point at this machine's recordings folder after download. */
function relinkRecordings(session: TrainingSession, dir: string): TrainingSession {
  const relink = (run: RunFiles) => {
    const next = { ...run };
    for (const field of RECORDING_FIELDS) {
      const path = run[field];
      if (path) next[field] = join(dir, basename(path));
    }
    return next;
  };
  const artifacts = Object.fromEntries(
    Object.entries(session.artifacts).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map((item) => (isRun(item) ? relink(item) : item)) : value,
    ]),
  );
  return { ...session, artifacts };
}

function recordingPaths(sessions: TrainingSession[]): string[] {
  return sessions.flatMap((s) =>
    Object.values(s.artifacts).flatMap((value) =>
      Array.isArray(value)
        ? value
            .filter(isRun)
            .flatMap((r) => RECORDING_FIELDS.flatMap((field) => (r[field] ? [r[field]] : [])))
        : [],
    ),
  );
}

function isRun(value: unknown): value is RunFiles {
  return typeof value === "object" && value !== null && "recordingPath" in value;
}

function toRow(s: TrainingSession): RemoteRow {
  return {
    id: s.id,
    training_id: s.trainingId,
    title: s.title,
    data: s,
    updated_at: s.updatedAt,
    deleted: false,
  };
}

/** Postgres returns "+00:00" timestamps; compare in the app's ISO format. */
function normalize(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toISOString();
}
