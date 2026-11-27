import type { KeyStatus, KeyTestResult, Provider } from "./keys";
import type { PersonaOverride, Settings } from "./settings";
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
  /** Use this voice instead of the active preset's (voice preview). */
  voice?: string;
  /** The voice may explain and correct (discussions, drills) instead of staying in character. */
  coach?: boolean;
  /** A shorter limit than the one in Settings, e.g. a three-minute drill. */
  maxMinutes?: number;
  /** This call's interviewer manner, over the active preset (e.g. a tough design round). */
  persona?: PersonaOverride;
}

export interface VoiceCall {
  sdp: string;
  model: string;
  maxMinutes: number;
}

export interface PronunciationRequest {
  system: string;
  prompt: string;
  /** JSON schema of the reply. */
  schema: Record<string, unknown>;
  clips: { label: string; wav: ArrayBuffer }[];
}

export interface PronunciationResult {
  /** Unvalidated; the renderer checks it against its schema. */
  reply: unknown;
  costUsd: number;
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
    /** `variant` "mic" marks the mic-only copy in the file name. */
    saveRecording(audio: ArrayBuffer, variant?: "mic"): Promise<string>;
    /** Sends recorded clips to the audio model; spend goes on the monthly ledger. */
    reviewPronunciation(request: PronunciationRequest): Promise<PronunciationResult>;
    /** Raw Realtime events of the last session as JSON lines, for debugging. */
    saveEventLog(jsonl: string): Promise<string>;
    revealRecording(path: string): Promise<void>;
    readRecording(path: string): Promise<ArrayBuffer | null>;
    /** Deletes recordings here and, on the next sync, on the server. */
    deleteRecordings(paths: string[]): Promise<void>;
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
    signInWithPassword(email: string, password: string): Promise<SyncStatus>;
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
    /** Reads a web page (e.g. a job posting); `name` is the host. */
    importUrl(url: string): Promise<{ name: string; text: string }>;
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
  voiceReviewPronunciation: "voice:review-pronunciation",
  sessionsList: "sessions:list",
  sessionsGet: "sessions:get",
  sessionsSave: "sessions:save",
  sessionsRemove: "sessions:remove",
  filesPickDocument: "files:pick-document",
  filesImportUrl: "files:import-url",
  syncStatus: "sync:status",
  syncSendCode: "sync:send-code",
  syncVerifyCode: "sync:verify-code",
  syncPassword: "sync:password",
  syncSignOut: "sync:sign-out",
  syncNow: "sync:now",
  dataExportAll: "data:export-all",
  dataDeleteAll: "data:delete-all",
  voiceReadRecording: "voice:read-recording",
  voiceDeleteRecordings: "voice:delete-recordings",
  textComplete: "text:complete",
  textClaudeCodeStatus: "text:claude-code-status",
  appInfo: "app:info",
  appOpenExternal: "app:open-external",
  appNavigate: "app:navigate",
} as const;
