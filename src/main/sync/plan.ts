export interface SyncPlan {
  upload: string[];
  download: string[];
  deleteLocal: string[];
  deleteRemote: string[];
}

/** Last writer wins per session; deletions travel as tombstones in both directions. */
export function planSync(
  local: { id: string; updatedAt: string }[],
  remote: { id: string; updatedAt: string; deleted: boolean }[],
  localTombstones: string[],
): SyncPlan {
  const plan: SyncPlan = { upload: [], download: [], deleteLocal: [], deleteRemote: [] };
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((s) => s.id));
  const tombstones = new Set(localTombstones);

  for (const s of local) {
    const r = remoteById.get(s.id);
    if (!r) plan.upload.push(s.id);
    else if (r.deleted) plan.deleteLocal.push(s.id);
    else if (s.updatedAt > r.updatedAt) plan.upload.push(s.id);
    else if (s.updatedAt < r.updatedAt) plan.download.push(s.id);
  }
  for (const r of remote) {
    if (tombstones.has(r.id)) {
      if (!r.deleted) plan.deleteRemote.push(r.id);
    } else if (!r.deleted && !localIds.has(r.id)) {
      plan.download.push(r.id);
    }
  }
  return plan;
}
