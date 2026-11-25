import type { Route } from "@shared/api";
import { PROVIDER_INFO } from "@shared/keys";
import type { TextProvider } from "@shared/text";
import { useEffect, useState } from "react";
import { History } from "./History";
import { Home } from "./Home";
import { type Readiness, useKeyStates } from "./keyStatus";
import { SETTINGS_CHANGED, SettingsPage } from "./settings/SettingsPage";
import { SessionScreen } from "./training/SessionScreen";
import { SoundCheck } from "./voice/SoundCheck";

type View = { page: Route } | { page: "session"; id: string };

const NAV: { route: Route; label: string }[] = [
  { route: "home", label: "Home" },
  { route: "history", label: "History" },
  { route: "soundcheck", label: "Sound check" },
  { route: "settings", label: "Settings" },
];

export function App() {
  const [view, setView] = useState<View>({ page: "home" });
  const go = (page: Route) => setView({ page });
  const openSession = (id: string) => setView({ page: "session", id });

  useEffect(() => window.greenroom.app.onNavigate((page) => setView({ page })), []);

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <div className="masthead">
          <span className="masthead-name">
            Green
            <br />
            room
          </span>
          <span className="masthead-sub">Rehearsal programme</span>
          <span className="masthead-date">{today()}</span>
        </div>
        {NAV.map((item) => (
          <button
            key={item.route}
            type="button"
            className="rail-item"
            aria-current={view.page === item.route ? "page" : undefined}
            onClick={() => go(item.route)}
          >
            {item.label}
          </button>
        ))}
        <KeyReadiness onOpen={() => go("settings")} />
      </nav>
      <main className="content">
        {view.page === "home" && (
          <Home onOpenSettings={() => go("settings")} onOpenSession={openSession} />
        )}
        {view.page === "history" && <History onOpenSession={openSession} />}
        {view.page === "session" && (
          <SessionScreen key={view.id} id={view.id} onBack={() => go("history")} />
        )}
        {view.page === "soundcheck" && <SoundCheck />}
        {view.page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

/** Rail footer: the voice key, plus whatever the text tasks run on. */
function KeyReadiness({ onOpen }: { onOpen: () => void }) {
  const keys = useKeyStates();
  const provider = useTextProvider();
  const [claudeCode, setClaudeCode] = useState<Readiness>("untested");

  useEffect(() => {
    if (provider !== "claude-code") return;
    window.greenroom.app.info().then((info) => {
      if (!info.claudeCodeEnabled) return setClaudeCode("none");
      window.greenroom.text
        .claudeCodeStatus()
        .then((s) => setClaudeCode(s.installed && s.loggedIn ? "works" : "none"));
    });
  }, [provider]);

  const shown = keys.filter((k) => k.provider === "openai" || provider === "anthropic");

  return (
    <button type="button" className="rail-foot" onClick={onOpen} title="Open settings">
      {shown.map((k) => (
        <ReadinessLine
          key={k.provider}
          label={PROVIDER_INFO[k.provider].label}
          state={k.readiness}
        />
      ))}
      {provider === "claude-code" && (
        <ReadinessLine label="Claude Code" state={claudeCode} none="Not ready" />
      )}
    </button>
  );
}

function ReadinessLine({ label, state, none }: { label: string; state: Readiness; none?: string }) {
  return (
    <span className={`readiness ${state}`}>
      <span className="pip" aria-hidden="true" />
      {label}
      <span className="readiness-state">
        {state === "none" && none ? none : READINESS_LABEL[state]}
      </span>
    </span>
  );
}

function useTextProvider(): TextProvider | null {
  const [provider, setProvider] = useState<TextProvider | null>(null);
  useEffect(() => {
    const load = () => window.greenroom.settings.get().then((s) => setProvider(s.text.provider));
    load();
    window.addEventListener(SETTINGS_CHANGED, load);
    return () => window.removeEventListener(SETTINGS_CHANGED, load);
  }, []);
  return provider;
}

const READINESS_LABEL: Record<Readiness, string> = {
  none: "No key",
  untested: "Key set",
  works: "Ready",
  rejected: "Rejected",
};

function today(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
