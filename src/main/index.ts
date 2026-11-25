import { join } from "node:path";
import { IPC, type Route } from "@shared/api";
import { PROVIDERS, type Provider } from "@shared/keys";
import type { Settings } from "@shared/settings";
import { app, BrowserWindow, ipcMain, safeStorage, session, shell } from "electron";
import { registerDataIpc } from "./data-ipc";
import { createKeyStore } from "./key-store";
import { testKey } from "./key-tester";
import { installAppMenu } from "./menu";
import { createSessionStore } from "./session-store";
import { registerSessionsIpc } from "./sessions-ipc";
import { createSettingsStore } from "./settings-store";
import { createSpendLedger } from "./spend-ledger";
import { createSyncService } from "./sync/service";
import { claudeCodeEnabled, registerTextIpc } from "./text/ipc";
import { registerVoiceIpc } from "./voice-ipc";

if (!app.requestSingleInstanceLock()) app.quit();

const settingsPath = join(app.getPath("userData"), "settings.json");
const settingsStore = createSettingsStore(settingsPath);
const cipher = {
  isAvailable: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain: string) => safeStorage.encryptString(plain),
  decrypt: (data: Buffer) => safeStorage.decryptString(data),
};
const keyStore = createKeyStore({
  filePath: join(app.getPath("userData"), "keys.json"),
  cipher,
  env: process.env,
});

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  allowMicrophoneOnly();
  registerIpc();
  registerTextIpc(settingsStore, keyStore);
  const recordingsDir = join(app.getPath("userData"), "recordings");
  const sessionStore = createSessionStore(join(app.getPath("userData"), "sessions"));
  const sync = createSyncService({
    settingsStore,
    store: sessionStore,
    recordingsDir,
    tokenFile: join(app.getPath("userData"), "sync-auth.bin"),
    cipher,
  });
  registerSessionsIpc(sessionStore, () => sync.changed());
  registerDataIpc(sessionStore, sync, recordingsDir);
  sync.start();
  registerVoiceIpc({
    settingsStore,
    keyStore,
    ledger: createSpendLedger(join(app.getPath("userData"), "spend.json")),
    recordingsDir,
  });
  installAppMenu(navigate);
  mainWindow = createWindow();
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    title: "Greenroom",
    backgroundColor: "#fbfbf9",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttps(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else window.loadFile(join(__dirname, "../renderer/index.html"));

  return window;
}

function registerIpc() {
  ipcMain.handle(IPC.settingsGet, () => settingsStore.load());
  ipcMain.handle(IPC.settingsSave, (_e, settings: Settings) => settingsStore.save(settings));
  ipcMain.handle(IPC.settingsReveal, () => shell.showItemInFolder(settingsPath));

  ipcMain.handle(IPC.keysStatus, () => PROVIDERS.map((p) => keyStore.status(p)));
  ipcMain.handle(IPC.keysSet, (_e, provider: unknown, key: unknown) => {
    const p = assertProvider(provider);
    keyStore.set(p, typeof key === "string" ? key : "");
    return keyStore.status(p);
  });
  ipcMain.handle(IPC.keysClear, (_e, provider: unknown) => {
    const p = assertProvider(provider);
    keyStore.clear(p);
    return keyStore.status(p);
  });
  ipcMain.handle(IPC.keysTest, (_e, provider: unknown) => {
    const p = assertProvider(provider);
    return testKey(p, keyStore.get(p));
  });

  ipcMain.handle(IPC.appInfo, () => ({
    version: app.getVersion(),
    platform: process.platform,
    settingsPath,
    claudeCodeEnabled: claudeCodeEnabled(),
  }));
  ipcMain.handle(IPC.appOpenExternal, (_e, url: unknown) => {
    if (typeof url === "string" && isHttps(url)) return shell.openExternal(url);
  });
}

function allowMicrophoneOnly() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const mediaTypes = "mediaTypes" in details ? (details.mediaTypes ?? []) : [];
    callback(permission === "media" && mediaTypes.every((t) => t === "audio"));
  });
}

function navigate(route: Route) {
  mainWindow?.webContents.send(IPC.appNavigate, route);
}

function assertProvider(value: unknown): Provider {
  if (PROVIDERS.includes(value as Provider)) return value as Provider;
  throw new Error(`Unknown provider: ${String(value)}`);
}

function isHttps(url: string): boolean {
  return url.startsWith("https://");
}
