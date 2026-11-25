import type { SyncStatus } from "@shared/api";
import type { Cipher } from "../key-store";
import type { SessionStore } from "../session-store";
import type { SettingsStore } from "../settings-store";
import { syncOnce } from "./engine";
import { createSupabase, type Supabase } from "./supabase";

const INTERVAL_MS = 5 * 60_000;
const AFTER_CHANGE_MS = 10_000;

interface Deps {
  settingsStore: SettingsStore;
  store: SessionStore;
  recordingsDir: string;
  tokenFile: string;
  cipher: Cipher;
}

/** Keeps sessions and recordings in sync with the user's Supabase project, when configured. */
export function createSyncService(deps: Deps) {
  let client: { key: string; supabase: Supabase } | null = null;
  let syncing = false;
  let lastSyncAt: string | null = null;
  let lastError: string | null = null;
  let lastResult: SyncStatus["lastResult"] = null;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;

  function supabase(): Supabase | null {
    const { url, publishableKey } = deps.settingsStore.load().sync;
    if (!url.trim() || !publishableKey.trim()) return null;
    const key = `${url}|${publishableKey}`;
    if (client?.key !== key) {
      client = {
        key,
        supabase: createSupabase(url.trim(), publishableKey.trim(), deps.tokenFile, deps.cipher),
      };
    }
    return client.supabase;
  }

  async function status(): Promise<SyncStatus> {
    const sb = supabase();
    const user = sb ? await sb.user().catch(() => null) : null;
    return {
      configured: sb !== null,
      email: user?.email ?? null,
      signedIn: user !== null,
      syncing,
      lastSyncAt,
      lastError,
      lastResult,
    };
  }

  async function run(): Promise<SyncStatus> {
    const sb = supabase();
    const user = sb ? await sb.user().catch(() => null) : null;
    if (!sb || !user || syncing) return status();
    syncing = true;
    try {
      lastResult = await syncOnce({
        store: deps.store,
        remote: sb.remote(user.id),
        recordingsDir: deps.recordingsDir,
      });
      lastSyncAt = new Date().toISOString();
      lastError = null;
    } catch (error) {
      lastError = (error as Error).message;
    } finally {
      syncing = false;
    }
    return status();
  }

  function requireClient(): Supabase {
    const sb = supabase();
    if (!sb) throw new Error("Add your Supabase project URL and publishable key first.");
    return sb;
  }

  return {
    status,
    run,
    async sendCode(email: string) {
      await requireClient().sendCode(email.trim());
    },
    async verifyCode(email: string, code: string) {
      await requireClient().verifyCode(email.trim(), code.trim());
      return run();
    },
    async signOut() {
      await supabase()?.signOut();
      lastSyncAt = null;
      lastResult = null;
      return status();
    },
    /** Starts periodic sync; call `changed()` after local edits to sync soon after. */
    start() {
      setTimeout(() => void run(), 3_000);
      setInterval(() => void run(), INTERVAL_MS);
    },
    changed() {
      clearTimeout(changeTimer);
      changeTimer = setTimeout(() => void run(), AFTER_CHANGE_MS);
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
