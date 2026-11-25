import { estimateSessionCostUsd } from "@shared/billing";
import { PROVIDER_INFO } from "@shared/keys";
import { activePersona, type Settings } from "@shared/settings";
import { isFinished, newSession, type TrainingSession } from "@shared/training";
import { TRAININGS, trainingById } from "@shared/trainings";
import { type ReactNode, useEffect, useState } from "react";
import { type KeyState, useKeyStates } from "./keyStatus";
import { SessionRow } from "./SessionRow";
import { capitalize, formatUsd } from "./text";

export function Home({
  onOpenSettings,
  onOpenSession,
  onOpenHistory,
}: {
  onOpenSettings: () => void;
  onOpenSession: (id: string) => void;
  onOpenHistory: () => void;
}) {
  const keys = useKeyStates();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
    window.greenroom.sessions.list().then(setSessions);
  }, []);

  const inProgress = sessions.filter((s) => !isFinished(s)).slice(0, 4);
  const finished = recentlyFinished(sessions).slice(0, 3);

  const start = async (trainingId: string) => {
    const def = trainingById(trainingId);
    if (!def) return;
    const session = await window.greenroom.sessions.save(newSession(def, crypto.randomUUID()));
    onOpenSession(session.id);
  };

  return (
    <section className="page">
      <h1 className="page-title">Tonight's programme</h1>

      {settings && (
        <KeyNotice
          keys={keys.filter(
            (k) => k.provider === "openai" || settings.text.provider === "anthropic",
          )}
          onOpenSettings={onOpenSettings}
        />
      )}

      {inProgress.length > 0 && (
        <div className="programme">
          <h2 className="section-title">Continue</h2>
          <SessionList sessions={inProgress} onOpenSession={onOpenSession} />
        </div>
      )}

      <div className="programme">
        <h2 className="section-title">Trainings</h2>
        <ol className="acts">
          {TRAININGS.map((t) => (
            <li key={t.id} className="training-row">
              <span className="act-title">{t.title}</span>
              <span className="act-text">
                {t.summary}
                <span className="item-detail">{t.phases.map((p) => p.title).join(" · ")}</span>
              </span>
              <button type="button" className="btn primary" onClick={() => start(t.id)}>
                New session
              </button>
            </li>
          ))}
        </ol>
      </div>

      {finished.length > 0 && (
        <div className="programme">
          <div className="programme-head">
            <h2 className="section-title">Recently finished</h2>
            <button type="button" className="link" onClick={onOpenHistory}>
              All sessions
            </button>
          </div>
          <SessionList sessions={finished} onOpenSession={onOpenSession} />
        </div>
      )}

      {settings && <Billing settings={settings} onOpenSettings={onOpenSettings} />}
    </section>
  );
}

function SessionList({
  sessions,
  onOpenSession,
}: {
  sessions: TrainingSession[];
  onOpenSession: (id: string) => void;
}) {
  return (
    <ul className="cards">
      {sessions.map((s) => (
        <li key={s.id}>
          <SessionRow session={s} onOpen={() => onOpenSession(s.id)} />
        </li>
      ))}
    </ul>
  );
}

function recentlyFinished(sessions: TrainingSession[]): TrainingSession[] {
  return sessions
    .filter(isFinished)
    .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
}

function KeyNotice({ keys, onOpenSettings }: { keys: KeyState[]; onOpenSettings: () => void }) {
  if (keys.length === 0) return null;

  const missing = keys.filter((k) => k.readiness === "none");
  const rejected = keys.filter((k) => k.readiness === "rejected");

  if (missing.length > 0) {
    return (
      <Notice stamp="To do" title="Before the curtain" action="Add keys" onAction={onOpenSettings}>
        Add your {labels(missing)} API {missing.length > 1 ? "keys" : "key"} to start rehearsing.
      </Notice>
    );
  }
  if (rejected.length > 0) {
    return (
      <Notice
        stamp="Rejected"
        bad
        title="A key was rejected"
        action="Fix keys"
        onAction={onOpenSettings}
      >
        {labels(rejected)} refused the saved key the last time it was tested. Replace it before
        rehearsing.
      </Notice>
    );
  }
  return null;
}

function Notice({
  stamp,
  bad = false,
  title,
  action,
  onAction,
  children,
}: {
  stamp: string;
  bad?: boolean;
  title: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <div className="notice">
      <span className={bad ? "stamp bad" : "stamp"}>{stamp}</span>
      <div className="notice-body">
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <button type="button" className="btn primary" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function Billing({ settings, onOpenSettings }: { settings: Settings; onOpenSettings: () => void }) {
  const persona = activePersona(settings);
  const minutes = settings.limits.mockMaxMinutes;
  const cost = estimateSessionCostUsd(settings.models.mock, minutes);

  return (
    <div className="stack">
      <div className="cast-line">
        <span>The interviewer</span>
        <span className="leader" aria-hidden="true" />
        <button type="button" className="link" onClick={onOpenSettings}>
          {persona.name}, voiced by {capitalize(persona.voice)}
        </button>
      </div>
      <div className="cast-line">
        <span>Mock interview</span>
        <span className="leader" aria-hidden="true" />
        <span>
          about {minutes} min{cost === null ? "" : `, about ${formatUsd(cost)}`}
        </span>
      </div>
    </div>
  );
}

function labels(keys: KeyState[]): string {
  return keys.map((k) => PROVIDER_INFO[k.provider].label).join(" and ");
}
