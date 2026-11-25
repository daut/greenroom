// Renders build/icon.png from icon.html with the bundled Archivo face.
//   npx electron scripts/icon/render.cjs
const { app, BrowserWindow } = require("electron");
const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  await win.loadFile(join(__dirname, "icon.html"));
  await win.webContents.executeJavaScript("document.fonts.ready.then(() => true)");
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage();
  const out = join(__dirname, "..", "..", "build");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "icon.png"), image.resize({ width: 1024, height: 1024 }).toPNG());
  app.quit();
});
