import { BrowserWindow, session } from "electron";
import type { PageSnapshot } from "./extract";

const LOAD_TIMEOUT_MS = 20_000;
const SETTLE_POLL_MS = 500;
const SETTLE_MAX_MS = 6_000;
/** In-memory (no `persist:` prefix), shared by imports and wiped after each one. */
const PARTITION = "link-import";
let lockedDown = false;

/**
 * Loads a page in a hidden, sandboxed window with a throwaway in-memory session
 * (no preload, no app cookies, no popups, downloads or permissions) and reads it.
 * Page JavaScript runs so client-rendered job boards finish drawing.
 */
export async function loadPage(rawUrl: string): Promise<PageSnapshot> {
  const url = parseHttpsUrl(rawUrl);
  const ses = importSession();
  const window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      partition: PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  const contents = window.webContents;
  contents.setAudioMuted(true);
  contents.setUserAgent(browserUserAgent(contents.getUserAgent()));
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, target) => {
    if (!target.startsWith("https://")) event.preventDefault();
  });

  try {
    return await withTimeout(open(window, url), LOAD_TIMEOUT_MS);
  } finally {
    window.destroy();
    await ses.clearStorageData().catch(() => undefined);
  }
}

async function open(window: BrowserWindow, url: string): Promise<PageSnapshot> {
  let status = 200;
  window.webContents.on("did-navigate", (_event, _url, code) => {
    status = code;
  });
  try {
    await window.loadURL(url);
  } catch (e) {
    // ERR_ABORTED: the page replaced itself (client-side redirect); read what loaded.
    const code = loadErrorCode(e);
    if (code !== "ERR_ABORTED") throw new Error(`Couldn't open that link (${code}).`);
  }
  if (status >= 400) throw new Error(`That page answered with an error (HTTP ${status}).`);
  const snapshot = await settledSnapshot(window);
  return { url: window.webContents.getURL() || url, ...snapshot };
}

/** Waits for client-side rendering: until a job posting appears or the text stops changing. */
async function settledSnapshot(window: BrowserWindow): Promise<Omit<PageSnapshot, "url">> {
  const deadline = Date.now() + SETTLE_MAX_MS;
  let previous = await readPage(window);
  while (Date.now() < deadline && !previous.jsonLd.some((s) => s.includes("JobPosting"))) {
    await sleep(SETTLE_POLL_MS);
    const next = await readPage(window);
    const settled = next.text.length > 0 && next.text.length === previous.text.length;
    previous = next;
    if (settled) break;
  }
  return previous;
}

async function readPage(window: BrowserWindow): Promise<Omit<PageSnapshot, "url">> {
  const raw: unknown = await window.webContents.executeJavaScript(READ_PAGE_SCRIPT, true);
  const page = (raw ?? {}) as Record<string, unknown>;
  return {
    title: typeof page.title === "string" ? page.title : "",
    jsonLd: Array.isArray(page.jsonLd) ? page.jsonLd.filter((s) => typeof s === "string") : [],
    text: typeof page.text === "string" ? page.text : "",
  };
}

/** Runs in the page. Strips site chrome from the live DOM (the window is thrown away after). */
const READ_PAGE_SCRIPT = `(() => {
  const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent || "");
  const chrome = "nav, header, footer, aside, form, button, script, style, noscript, dialog, [role=navigation], [role=banner], [role=contentinfo], [aria-hidden=true]";
  const main = document.querySelector("main, [role=main], article");
  const root = main && main.innerText.trim().length > 200 ? main : document.body;
  if (root) root.querySelectorAll(chrome).forEach((n) => n.remove());
  return { title: document.title, jsonLd, text: root ? root.innerText : "" };
})()`;

function parseHttpsUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a full link starting with https://.");
  }
  if (url.protocol !== "https:") throw new Error("Only https:// links can be imported.");
  return url.toString();
}

function importSession(): Electron.Session {
  const ses = session.fromPartition(PARTITION);
  if (lockedDown) return ses;
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.on("will-download", (event) => event.preventDefault());
  lockedDown = true;
  return ses;
}

/** Some sites turn away unknown browsers; drop the Electron and app tokens. */
function browserUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s(Electron|greenroom|Greenroom)\/\S+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function loadErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.match(/ERR_[A-Z_]+/)?.[0] ?? message;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("That page took too long to load. Paste the text instead.")),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
