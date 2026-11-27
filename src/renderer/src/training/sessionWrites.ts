import type { TrainingSession } from "@shared/training";

type Change = (session: TrainingSession) => TrainingSession;

const openScreens = new Map<string, (change: Change) => void>();
const diskWrites = new Map<string, Promise<void>>();
const writesStarted = new Map<string, number>();

/**
 * Changes a session wherever it currently lives: through the open session screen, so its state
 * stays current, or straight on disk when nothing has it open (e.g. a coach reply arriving after
 * the user left).
 */
export function updateSession(id: string, change: Change): Promise<void> {
  const live = openScreens.get(id);
  if (live) {
    live(change);
    return Promise.resolve();
  }
  return writeToDisk(id, change);
}

/** Routes this session's changes to `update` until the returned function is called. */
export function openSession(id: string, update: (change: Change) => void): () => void {
  openScreens.set(id, update);
  return () => {
    if (openScreens.get(id) === update) openScreens.delete(id);
  };
}

/** Reads a session once no write to its file is still in flight. */
export async function loadSession(id: string): Promise<TrainingSession | null> {
  for (;;) {
    const started = writesStarted.get(id);
    await diskWrites.get(id);
    const session = await window.greenroom.sessions.get(id);
    if (writesStarted.get(id) === started) return session;
  }
}

function writeToDisk(id: string, change: Change): Promise<void> {
  writesStarted.set(id, (writesStarted.get(id) ?? 0) + 1);
  const write = (diskWrites.get(id) ?? Promise.resolve()).then(async () => {
    const session = await window.greenroom.sessions.get(id);
    if (session) await window.greenroom.sessions.save(change(session));
  });
  const settled = write.catch(() => {});
  diskWrites.set(id, settled);
  void settled.then(() => {
    if (diskWrites.get(id) === settled) diskWrites.delete(id);
  });
  return write;
}
