import type { KeyStatus, KeyTestResult, Provider } from "./keys";
import type { Settings } from "./settings";
import type { ClaudeCodeStatus, TextRequest } from "./text";
import type { TrainingSession } from "./training";

export type Route = "home" | "history" | "soundcheck" | "settings";

export type VoiceSessionKind = "drill" | "mock";

export interface VoiceCallRequest {
  kind: VoiceSessionKind;
  sdp: string;
  /** What the interviewer should do this session. */
  task: string;
  /** Who the voice plays; defaults to a job interviewer. */
  frame?: string;
  /** Listen without replying until handed over. */
  listenFirst?: boolean;
  /** Use this voice instead of the active preset's (voice preview). */
  voice?: string;
}

export interface VoiceCall {
  sdp: string;
  model: string;
  maxMinutes: number;
}

export interface SyncStatus {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  lastResult: {
    uploaded: number;
    downloaded: number;
    deleted: number;
    recordingsUp: number;
    recordingsDown: number;
  } | null;
}

export interface MonthSpend {
  spentUsd: number;
  budgetUsd: number;
}

export interface AppInfo {
  version: string;
  platform: string;
  settingsPath: string;
  /** Whether the opt-in Claude Code text provider is available in this build. */
  claudeCodeEnabled: boolean;
}

/** Exposed to the renderer as `window.greenroom`. Raw API keys never cross this boundary. */
export interface GreenroomApi {
  settings: {
    get(): Promise<Settings>;
    save(settings: Settings): Promise<Settings>;
    reveal(): Promise<void>;
  };
  keys: {
    status(): Promise<KeyStatus[]>;
    set(provider: Provider, key: string): Promise<KeyStatus>;
    clear(provider: Provider): Promise<KeyStatus>;
    test(provider: Provider): Promise<KeyTestResult>;
  };
  voice: {
    /** Exchanges the SDP offer for an answer; rejects when over budget or without a key. */
    connect(request: VoiceCallRequest): Promise<VoiceCall>;
    recordSpend(usd: number): Promise<MonthSpend>;
    monthSpend(): Promise<MonthSpend>;
    saveRecording(audio: ArrayBuffer): Promise<string>;
    /** Raw Realtime events of the last session as JSON lines, for debugging. */
    saveEventLog(jsonl: string): Promise<string>;
    revealRecording(path: string): Promise<void>;
    readRecording(path: string): Promise<ArrayBuffer | null>;
  };
  sessions: {
    list(): Promise<TrainingSession[]>;
    get(id: string): Promise<TrainingSession | null>;
    save(session: TrainingSession): Promise<TrainingSession>;
    remove(id: string): Promise<void>;
  };
  sync: {
    status(): Promise<SyncStatus>;
    sendCode(email: string): Promise<void>;
    verifyCode(email: string, code: string): Promise<SyncStatus>;
    signOut(): Promise<SyncStatus>;
    now(): Promise<SyncStatus>;
  };
  data: {
    /** Writes every session to a JSON file the user picks; returns its path or null. */
    exportAll(): Promise<string | null>;
    /** Deletes all local sessions and recordings (settings and keys stay). */
    deleteAll(): Promise<void>;
  };
  files: {
    /** Opens a file picker for a CV or notes file; null when cancelled. */
    pickDocument(): Promise<{ name: string; text: string } | null>;
  };
  text: {
    /** Text or, when `schema` is set, the parsed JSON object. */
    complete(request: TextRequest): Promise<unknown>;
    claudeCodeStatus(): Promise<ClaudeCodeStatus>;
  };
  app: {
    info(): Promise<AppInfo>;
    openExternal(url: string): Promise<void>;
    onNavigate(listener: (route: Route) => void): () => void;
  };
}

export const IPC = {
  settingsGet: "settings:get",
  settingsSave: "settings:save",
  settingsReveal: "settings:reveal",
  keysStatus: "keys:status",
  keysSet: "keys:set",
  keysClear: "keys:clear",
  keysTest: "keys:test",
  voiceConnect: "voice:connect",
  voiceRecordSpend: "voice:record-spend",
  voiceMonthSpend: "voice:month-spend",
  voiceSaveRecording: "voice:save-recording",
  voiceSaveEventLog: "voice:save-event-log",
  voiceRevealRecording: "voice:reveal-recording",
  sessionsList: "sessions:list",
  sessionsGet: "sessions:get",
  sessionsSave: "sessions:save",
  sessionsRemove: "sessions:remove",
  filesPickDocument: "files:pick-document",
  syncStatus: "sync:status",
  syncSendCode: "sync:send-code",
  syncVerifyCode: "sync:verify-code",
  syncSignOut: "sync:sign-out",
  syncNow: "sync:now",
  dataExportAll: "data:export-all",
  dataDeleteAll: "data:delete-all",
  voiceReadRecording: "voice:read-recording",
  textComplete: "text:complete",
  textClaudeCodeStatus: "text:claude-code-status",
  appInfo: "app:info",
  appOpenExternal: "app:open-external",
  appNavigate: "app:navigate",
} as const;
