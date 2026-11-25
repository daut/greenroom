import { IPC } from "@shared/api";
import type { TrainingSession } from "@shared/training";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { DOCUMENT_EXTENSIONS, readDocumentText } from "./documents";
import type { SessionStore } from "./session-store";

export function registerSessionsIpc(store: SessionStore, onChange: () => void) {
  ipcMain.handle(IPC.sessionsList, () => store.list());
  ipcMain.handle(IPC.sessionsGet, (_e, id: unknown) =>
    typeof id === "string" ? store.get(id) : null,
  );
  ipcMain.handle(IPC.sessionsSave, (_e, session: TrainingSession) => {
    const saved = store.save(session);
    onChange();
    return saved;
  });
  ipcMain.handle(IPC.sessionsRemove, (_e, id: unknown) => {
    if (typeof id === "string") store.remove(id);
    onChange();
  });

  ipcMain.handle(IPC.filesPickDocument, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = {
      properties: ["openFile" as const],
      filters: [{ name: "Documents", extensions: DOCUMENT_EXTENSIONS }],
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    const path = result.filePaths[0];
    return result.canceled || !path ? null : readDocumentText(path);
  });
}
