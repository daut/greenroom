import type { Route } from "@shared/api";
import { app, Menu, type MenuItemConstructorOptions } from "electron";

export function installAppMenu(navigate: (route: Route) => void) {
  const settingsItem: MenuItemConstructorOptions = {
    label: "Settings…",
    accelerator: "CmdOrCtrl+,",
    click: () => navigate("settings"),
  };

  const appMenu: MenuItemConstructorOptions =
    process.platform === "darwin"
      ? {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            settingsItem,
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }
      : { label: "File", submenu: [settingsItem, { type: "separator" }, { role: "quit" }] };

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      appMenu,
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}
