import { type GreenroomApi, IPC, type Route } from "@shared/api";
import { contextBridge, ipcRenderer } from "electron";

const api: GreenroomApi = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    save: (settings) => ipcRenderer.invoke(IPC.settingsSave, settings),
    reveal: () => ipcRenderer.invoke(IPC.settingsReveal),
  },
  keys: {
    status: () => ipcRenderer.invoke(IPC.keysStatus),
    set: (provider, key) => ipcRenderer.invoke(IPC.keysSet, provider, key),
    clear: (provider) => ipcRenderer.invoke(IPC.keysClear, provider),
    test: (provider) => ipcRenderer.invoke(IPC.keysTest, provider),
  },
  voice: {
    connect: (request) => ipcRenderer.invoke(IPC.voiceConnect, request),
    recordSpend: (usd) => ipcRenderer.invoke(IPC.voiceRecordSpend, usd),
    monthSpend: () => ipcRenderer.invoke(IPC.voiceMonthSpend),
    saveRecording: (audio) => ipcRenderer.invoke(IPC.voiceSaveRecording, audio),
    saveEventLog: (jsonl) => ipcRenderer.invoke(IPC.voiceSaveEventLog, jsonl),
    revealRecording: (path) => ipcRenderer.invoke(IPC.voiceRevealRecording, path),
    readRecording: (path) => ipcRenderer.invoke(IPC.voiceReadRecording, path),
  },
  sessions: {
    list: () => ipcRenderer.invoke(IPC.sessionsList),
    get: (id) => ipcRenderer.invoke(IPC.sessionsGet, id),
    save: (session) => ipcRenderer.invoke(IPC.sessionsSave, session),
    remove: (id) => ipcRenderer.invoke(IPC.sessionsRemove, id),
  },
  sync: {
    status: () => ipcRenderer.invoke(IPC.syncStatus),
    sendCode: (email) => ipcRenderer.invoke(IPC.syncSendCode, email),
    verifyCode: (email, code) => ipcRenderer.invoke(IPC.syncVerifyCode, email, code),
    signInWithPassword: (email, password) => ipcRenderer.invoke(IPC.syncPassword, email, password),
    signOut: () => ipcRenderer.invoke(IPC.syncSignOut),
    now: () => ipcRenderer.invoke(IPC.syncNow),
  },
  data: {
    exportAll: () => ipcRenderer.invoke(IPC.dataExportAll),
    deleteAll: () => ipcRenderer.invoke(IPC.dataDeleteAll),
  },
  files: {
    pickDocument: () => ipcRenderer.invoke(IPC.filesPickDocument),
    importUrl: (url) => ipcRenderer.invoke(IPC.filesImportUrl, url),
  },
  text: {
    complete: (request) => ipcRenderer.invoke(IPC.textComplete, request),
    claudeCodeStatus: () => ipcRenderer.invoke(IPC.textClaudeCodeStatus),
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    openExternal: (url) => ipcRenderer.invoke(IPC.appOpenExternal, url),
    onNavigate: (listener) => {
      const handler = (_event: unknown, route: Route) => listener(route);
      ipcRenderer.on(IPC.appNavigate, handler);
      return () => ipcRenderer.removeListener(IPC.appNavigate, handler);
    },
  },
};

contextBridge.exposeInMainWorld("greenroom", api);
