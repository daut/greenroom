export const TEXT_PROVIDERS = ["anthropic", "openai", "claude-code"] as const;
export type TextProvider = (typeof TEXT_PROVIDERS)[number];

/** Which configured model a text task uses. */
export type TextRole = "generate" | "score";

export const TEXT_PROVIDER_INFO: Record<
  TextProvider,
  { label: string; detail: string; models: Record<TextRole, string>; suggestions: string[] }
> = {
  anthropic: {
    label: "Anthropic API key",
    detail: "Claude through the API. Uses your Console credits (Max plan credits once linked).",
    models: { generate: "claude-haiku-5-5", score: "claude-sonnet-5-5" },
    suggestions: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
  },
  openai: {
    label: "OpenAI API key",
    detail: "OpenAI text models with the same key as the voice interviewer.",
    models: { generate: "gpt-5.6-luna", score: "gpt-5.6-terra" },
    suggestions: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"],
  },
  "claude-code": {
    label: "Claude Code on this Mac",
    detail:
      "Personal setup: runs your installed Claude Code command with your own login, so it counts against your Claude plan's usage limits. Slower, a few seconds per call.",
    models: { generate: "haiku", score: "sonnet" },
    suggestions: ["haiku", "sonnet", "opus"],
  },
};

export interface TextRequest {
  role: TextRole;
  system: string;
  prompt: string;
  /** JSON Schema; when set, the reply is parsed JSON matching it. */
  schema?: Record<string, unknown>;
}

export interface ClaudeCodeStatus {
  installed: boolean;
  loggedIn: boolean;
  version: string | null;
  path: string | null;
}

export const CLAUDE_CODE_INSTALL = "brew install --cask claude-code";
