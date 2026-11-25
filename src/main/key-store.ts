import { existsSync, readFileSync } from "node:fs";
import { type KeyStatus, PROVIDER_INFO, type Provider } from "@shared/keys";
import { writeFileAtomic } from "./fs-utils";

export interface Cipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

interface StoredKey {
  encrypted: boolean;
  value: string;
}

type KeyFile = Partial<Record<Provider, StoredKey>>;

interface Options {
  filePath: string;
  cipher: Cipher;
  env: Record<string, string | undefined>;
}

export type KeyStore = ReturnType<typeof createKeyStore>;

export function createKeyStore({ filePath, cipher, env }: Options) {
  function get(provider: Provider): string | null {
    return readStored(provider) ?? envKey(provider);
  }

  function status(provider: Provider): KeyStatus {
    const stored = readFile()[provider];
    const key = get(provider);
    return {
      provider,
      source: stored ? "stored" : key ? "env" : "none",
      hint: key ? key.slice(-4) : null,
      encrypted: stored ? stored.encrypted : true,
    };
  }

  function set(provider: Provider, rawKey: string) {
    const key = rawKey.trim();
    if (!key) return clear(provider);
    writeFile({ ...readFile(), [provider]: encode(key) });
  }

  function clear(provider: Provider) {
    const { [provider]: _removed, ...rest } = readFile();
    writeFile(rest);
  }

  function readStored(provider: Provider): string | null {
    const stored = readFile()[provider];
    if (!stored) return null;
    return stored.encrypted ? cipher.decrypt(Buffer.from(stored.value, "base64")) : stored.value;
  }

  function envKey(provider: Provider): string | null {
    return env[PROVIDER_INFO[provider].envVar]?.trim() || null;
  }

  function encode(key: string): StoredKey {
    return cipher.isAvailable()
      ? { encrypted: true, value: cipher.encrypt(key).toString("base64") }
      : { encrypted: false, value: key };
  }

  function readFile(): KeyFile {
    if (!existsSync(filePath)) return {};
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as KeyFile;
    } catch {
      return {};
    }
  }

  function writeFile(data: KeyFile) {
    writeFileAtomic(filePath, JSON.stringify(data, null, 2), 0o600);
  }

  return { get, status, set, clear };
}
