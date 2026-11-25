import type { KeyStatus, Provider } from "@shared/keys";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Key statuses and this session's latest test result per provider, shared by the rail, Home,
 * and the Keys tab so they never disagree.
 */
export type Readiness = "none" | "untested" | "works" | "rejected";

export interface KeyState extends KeyStatus {
  readiness: Readiness;
}

let statuses: KeyStatus[] = [];
let testResults: Partial<Record<Provider, boolean>> = {};
let snapshot: KeyState[] = [];
const listeners = new Set<() => void>();

export function useKeyStates(): KeyState[] {
  useEffect(() => {
    refreshKeyStatuses();
  }, []);
  return useSyncExternalStore(subscribe, () => snapshot);
}

export async function refreshKeyStatuses() {
  statuses = await window.greenroom.keys.status();
  publish();
}

/** A changed key invalidates its earlier test result. */
export function publishKeyStatus(next: KeyStatus) {
  statuses = statuses.map((s) => (s.provider === next.provider ? next : s));
  const { [next.provider]: _stale, ...rest } = testResults;
  testResults = rest;
  publish();
}

export function publishTestResult(provider: Provider, ok: boolean) {
  testResults = { ...testResults, [provider]: ok };
  publish();
}

function publish() {
  snapshot = statuses.map((s) => ({ ...s, readiness: readinessOf(s) }));
  for (const listener of listeners) listener();
}

function readinessOf(status: KeyStatus): Readiness {
  if (status.source === "none") return "none";
  const tested = testResults[status.provider];
  if (tested === undefined) return "untested";
  return tested ? "works" : "rejected";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
