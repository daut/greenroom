import type { Settings } from "@shared/settings";
import { CLAUDE_CODE_INSTALL, type TextRequest } from "@shared/text";
import type { completeWithAnthropic } from "./anthropic";
import type { completeWithClaudeCode } from "./claude-code";
import type { completeWithOpenAI } from "./openai";

interface Deps {
  settings: () => Settings;
  key: (provider: "openai" | "anthropic") => string | null;
  claudeBinary: () => string | null;
  /** Off in release builds unless GREENROOM_ENABLE_CLAUDE_CODE=1 (personal setup only). */
  claudeCodeEnabled: () => boolean;
  anthropic: typeof completeWithAnthropic;
  openai: typeof completeWithOpenAI;
  claudeCode: typeof completeWithClaudeCode;
}

/** One text completion through whichever provider Settings → Models selects. */
export function createTextCompleter(deps: Deps) {
  return async ({ role, system, prompt, schema }: TextRequest): Promise<unknown> => {
    const settings = deps.settings();
    const model = settings.models[role];
    const base = { model, system, prompt, schema };

    switch (settings.text.provider) {
      case "anthropic":
        return deps.anthropic({ ...base, apiKey: requireKey(deps, "anthropic", "Anthropic") });
      case "openai":
        return deps.openai({ ...base, apiKey: requireKey(deps, "openai", "OpenAI") });
      case "claude-code": {
        if (!deps.claudeCodeEnabled()) {
          throw new Error(
            "Claude Code is turned off in this build. Pick an API key in Settings → Models & cost.",
          );
        }
        const binary = deps.claudeBinary();
        if (!binary) {
          throw new Error(`Claude Code is not installed. Install it with: ${CLAUDE_CODE_INSTALL}`);
        }
        return deps.claudeCode({ ...base, binary });
      }
    }
  };
}

function requireKey(deps: Deps, provider: "openai" | "anthropic", label: string): string {
  const key = deps.key(provider);
  if (!key) throw new Error(`No ${label} key set. Add one in Settings → Keys.`);
  return key;
}
