import { IPC } from "@shared/api";
import type { TextRequest } from "@shared/text";
import { app, ipcMain } from "electron";
import type { KeyStore } from "../key-store";
import type { SettingsStore } from "../settings-store";
import { completeWithAnthropic } from "./anthropic";
import { claudeCodeStatus, completeWithClaudeCode, findClaudeBinary } from "./claude-code";
import { createTextCompleter } from "./complete";
import { completeWithOpenAI } from "./openai";

export function registerTextIpc(settingsStore: SettingsStore, keyStore: KeyStore) {
  const complete = createTextCompleter({
    settings: () => settingsStore.load(),
    key: (provider) => keyStore.get(provider),
    claudeBinary: () => findClaudeBinary(process.env),
    claudeCodeEnabled,
    anthropic: completeWithAnthropic,
    openai: completeWithOpenAI,
    claudeCode: completeWithClaudeCode,
  });

  ipcMain.handle(IPC.textComplete, (_e, request: TextRequest) => complete(request));
  ipcMain.handle(IPC.textClaudeCodeStatus, () => claudeCodeStatus());
}

/** Personal-setup feature: on in development, opt-in via env var in packaged releases. */
export function claudeCodeEnabled(): boolean {
  return !app.isPackaged || process.env.GREENROOM_ENABLE_CLAUDE_CODE === "1";
}
