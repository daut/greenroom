import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IPC } from "@shared/api";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { SessionStore } from "./session-store";
import type { SyncService } from "./sync/service";

export function registerDataIpc(store: SessionStore, sync: SyncService, recordingsDir: string) {
  ipcMain.handle(IPC.syncStatus, () => sync.status());
  ipcMain.handle(IPC.syncSendCode, (_e, email: string) => sync.sendCode(String(email)));
  ipcMain.handle(IPC.syncVerifyCode, (_e, email: string, code: string) =>
    sync.verifyCode(String(email), String(code)),
  );
  ipcMain.handle(IPC.syncSignOut, () => sync.signOut());
  ipcMain.handle(IPC.syncNow, () => sync.run());

  ipcMain.handle(IPC.dataExportAll, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      defaultPath: join(
        app.getPath("documents"),
        `greenroom-export-${new Date().toISOString().slice(0, 10)}.json`,
      ),
      filters: [{ name: "JSON", extensions: ["json"] }],
    };
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    writeFileSync(
      result.filePath,
      JSON.stringify({ exportedAt: new Date().toISOString(), sessions: store.list() }, null, 2),
    );
    return result.filePath;
  });

  ipcMain.handle(IPC.dataDeleteAll, () => {
    for (const s of store.list()) store.remove(s.id);
    rmSync(recordingsDir, { recursive: true, force: true });
    sync.changed();
  });
}
