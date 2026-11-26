import type { Settings } from "@shared/settings";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioTab } from "./AudioTab";
import { InterviewerTab } from "./InterviewerTab";
import { KeysTab } from "./KeysTab";
import { ModelsTab } from "./ModelsTab";
import { SyncTab } from "./SyncTab";

const TABS = [
  { id: "keys", label: "Keys" },
  { id: "interviewer", label: "Interviewer" },
  { id: "models", label: "Models & cost" },
  { id: "audio", label: "Audio" },
  { id: "sync", label: "Sync & data" },
] as const;

export type SettingsTab = (typeof TABS)[number]["id"];
export type UpdateSettings = (change: (current: Settings) => Settings) => void;

export function SettingsPage({
  initialTab = "keys",
  onOpenSoundCheck,
}: {
  initialTab?: SettingsTab;
  onOpenSoundCheck: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const { settings, update, saved } = usePersistedSettings();

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <span className={saved ? "stamp" : "stamp pending"} role="status">
          {saved ? "Saved" : "Saving"}
        </span>
        <button
          type="button"
          className="link"
          onClick={() => window.greenroom.settings.reveal()}
          title="settings.json can be edited by hand"
        >
          Show settings file
        </button>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="settings-panel"
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "keys" && <KeysTab />}
        {settings && tab === "interviewer" && (
          <InterviewerTab settings={settings} update={update} />
        )}
        {settings && tab === "models" && <ModelsTab settings={settings} update={update} />}
        {settings && tab === "audio" && (
          <AudioTab settings={settings} update={update} onOpenSoundCheck={onOpenSoundCheck} />
        )}
        {settings && tab === "sync" && <SyncTab settings={settings} update={update} />}
      </div>
    </section>
  );
}

const SAVE_DELAY_MS = 300;
export const SETTINGS_CHANGED = "greenroom:settings-changed";

function usePersistedSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
  }, []);

  const update = useCallback<UpdateSettings>((change) => {
    setSettings((current) => {
      if (!current) return current;
      const next = change(current);
      setSaved(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        window.greenroom.settings.save(next).then(() => {
          setSaved(true);
          window.dispatchEvent(new Event(SETTINGS_CHANGED));
        });
      }, SAVE_DELAY_MS);
      return next;
    });
  }, []);

  return { settings, update, saved };
}
