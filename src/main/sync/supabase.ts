import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileAtomic } from "../fs-utils";
import type { Cipher } from "../key-store";
import type { RemoteRow, SyncRemote } from "./engine";
import { parseSignInInput } from "./sign-in-input";

const TABLE = "training_sessions";
const BUCKET = "recordings";

/** A Supabase client whose auth session is stored encrypted on disk in the main process. */
export function createSupabase(
  url: string,
  publishableKey: string,
  tokenFile: string,
  cipher: Cipher,
) {
  const client = createClient(url, publishableKey, {
    auth: {
      storage: encryptedStorage(tokenFile, cipher),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return {
    async sendCode(email: string) {
      const { error } = await reachable(() =>
        client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }),
      );
      if (error) throw new Error(friendly(error.message));
    },
    /** Accepts the emailed 6-digit code or the whole emailed link. */
    async verifyCode(email: string, pasted: string) {
      const input = parseSignInInput(pasted);
      const { error } = await reachable(() => {
        if (input.kind === "session") {
          return client.auth.setSession({
            access_token: input.accessToken,
            refresh_token: input.refreshToken,
          });
        }
        if (input.kind === "token_hash") {
          return client.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type });
        }
        return client.auth.verifyOtp({ email, token: input.code, type: "email" });
      });
      if (error) throw new Error(friendly(error.message));
    },
    async signInWithPassword(email: string, password: string) {
      const { error } = await reachable(() => client.auth.signInWithPassword({ email, password }));
      if (error) throw new Error(friendly(error.message));
    },
    async signOut() {
      await client.auth.signOut();
    },
    async user(): Promise<{ id: string; email: string | null } | null> {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      return user ? { id: user.id, email: user.email ?? null } : null;
    },
    remote: (userId: string) => supabaseRemote(client, userId),
  };
}

export type Supabase = ReturnType<typeof createSupabase>;

const UNREACHABLE =
  "Couldn't reach the Supabase project. Check the project URL and your connection.";

function friendly(message: string): string {
  return message.includes("fetch failed") ? UNREACHABLE : message;
}

async function reachable<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if ((error as Error).message.includes("fetch failed")) {
      throw new Error(
        "Couldn't reach the Supabase project. Check the project URL and your connection.",
      );
    }
    throw error;
  }
}

function supabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  const path = (name: string) => `${userId}/${name}`;
  return {
    async listSessions() {
      const { data, error } = await client
        .from(TABLE)
        .select("id, training_id, title, data, updated_at, deleted")
        .range(0, 9999);
      if (error) throw new Error(`Sync read failed: ${error.message}`);
      return (data ?? []) as RemoteRow[];
    },
    async upsertSessions(rows) {
      const { error } = await client.from(TABLE).upsert(
        rows.map((r) => ({ ...r, user_id: userId })),
        { onConflict: "user_id,id" },
      );
      if (error) throw new Error(`Sync upload failed: ${error.message}`);
    },
    async markDeleted(ids, at) {
      const { error } = await client
        .from(TABLE)
        .update({ deleted: true, updated_at: at })
        .in("id", ids);
      if (error) throw new Error(`Sync delete failed: ${error.message}`);
    },
    async listRecordings() {
      const { data, error } = await client.storage.from(BUCKET).list(userId, { limit: 10000 });
      if (error) throw new Error(`Recording list failed: ${error.message}`);
      return (data ?? []).map((f) => f.name);
    },
    async uploadRecording(name, data) {
      const { error } = await client.storage
        .from(BUCKET)
        .upload(path(name), data, { contentType: "audio/webm", upsert: true });
      if (error) throw new Error(`Recording upload failed: ${error.message}`);
    },
    async downloadRecording(name) {
      const { data, error } = await client.storage.from(BUCKET).download(path(name));
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    },
    async deleteRecordings(names) {
      const { error } = await client.storage.from(BUCKET).remove(names.map(path));
      if (error) throw new Error(`Recording delete failed: ${error.message}`);
    },
  };
}

/** supabase-js storage adapter backed by one encrypted JSON file. */
function encryptedStorage(file: string, cipher: Cipher) {
  const read = (): Record<string, string> => {
    if (!existsSync(file)) return {};
    try {
      const raw = readFileSync(file);
      const text = cipher.isAvailable() ? cipher.decrypt(raw) : raw.toString("utf8");
      return JSON.parse(text) as Record<string, string>;
    } catch {
      return {};
    }
  };
  const write = (data: Record<string, string>) => {
    const text = JSON.stringify(data);
    const bytes = cipher.isAvailable() ? cipher.encrypt(text) : Buffer.from(text);
    writeFileAtomic(file, bytes.toString("binary"), 0o600, "binary");
  };
  return {
    getItem: (key: string) => read()[key] ?? null,
    setItem: (key: string, value: string) => write({ ...read(), [key]: value }),
    removeItem: (key: string) => {
      const { [key]: _gone, ...rest } = read();
      write(rest);
    },
  };
}
