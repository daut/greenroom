import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type Cipher, createKeyStore } from "./key-store";

const fakeCipher = (available = true): Cipher => ({
  isAvailable: () => available,
  encrypt: (plain) => Buffer.from([...plain].reverse().join("")),
  decrypt: (data) => [...data.toString()].reverse().join(""),
});

let file: string;

beforeEach(() => {
  file = join(mkdtempSync(join(tmpdir(), "greenroom-keys-")), "keys.json");
});

describe("key store", () => {
  it("reports no key when nothing is stored or in env", () => {
    const store = createKeyStore({ filePath: file, cipher: fakeCipher(), env: {} });

    expect(store.get("openai")).toBeNull();
    expect(store.status("openai")).toMatchObject({ source: "none", hint: null });
  });

  it("stores keys encrypted and only exposes a hint", () => {
    const store = createKeyStore({ filePath: file, cipher: fakeCipher(), env: {} });

    store.set("openai", "  sk-secret-1234  ");

    expect(store.get("openai")).toBe("sk-secret-1234");
    expect(store.status("openai")).toEqual({
      provider: "openai",
      source: "stored",
      hint: "1234",
      encrypted: true,
    });
    expect(readFileSync(file, "utf8")).not.toContain("sk-secret-1234");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("falls back to the environment variable", () => {
    const store = createKeyStore({
      filePath: file,
      cipher: fakeCipher(),
      env: { ANTHROPIC_API_KEY: "sk-ant-env-9999" },
    });

    expect(store.get("anthropic")).toBe("sk-ant-env-9999");
    expect(store.status("anthropic")).toMatchObject({ source: "env", hint: "9999" });
  });

  it("prefers the stored key over env, and clearing restores env", () => {
    const store = createKeyStore({
      filePath: file,
      cipher: fakeCipher(),
      env: { OPENAI_API_KEY: "sk-env-0000" },
    });

    store.set("openai", "sk-stored-1111");
    expect(store.get("openai")).toBe("sk-stored-1111");

    store.clear("openai");
    expect(store.get("openai")).toBe("sk-env-0000");
  });

  it("stores plain text when the OS keyring is unavailable and says so", () => {
    const store = createKeyStore({ filePath: file, cipher: fakeCipher(false), env: {} });

    store.set("openai", "sk-plain-2222");

    expect(store.get("openai")).toBe("sk-plain-2222");
    expect(store.status("openai").encrypted).toBe(false);
  });

  it("treats an empty value as clearing the key", () => {
    const store = createKeyStore({ filePath: file, cipher: fakeCipher(), env: {} });
    store.set("openai", "sk-1");

    store.set("openai", "   ");

    expect(store.get("openai")).toBeNull();
  });
});
