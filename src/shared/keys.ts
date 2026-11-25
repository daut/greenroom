export const PROVIDERS = ["openai", "anthropic"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_INFO: Record<
  Provider,
  { label: string; envVar: string; consoleUrl: string }
> = {
  openai: {
    label: "OpenAI",
    envVar: "OPENAI_API_KEY",
    consoleUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    consoleUrl: "https://platform.claude.com/settings/keys",
  },
};

export interface KeyStatus {
  provider: Provider;
  source: "stored" | "env" | "none";
  /** Last 4 characters, never the full key. */
  hint: string | null;
  /** False when the OS has no keyring and the key sits in a 0600 file in plain text. */
  encrypted: boolean;
}

export interface KeyTestResult {
  ok: boolean;
  message: string;
}
