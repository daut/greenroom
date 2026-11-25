import { estimateSessionCostUsd } from "@shared/billing";
import { PROVIDER_INFO } from "@shared/keys";
import { activePersona, type Settings } from "@shared/settings";
import { newSession, phaseState, type TrainingSession } from "@shared/training";
import { TRAININGS, trainingById } from "@shared/trainings";
import { type ReactNode, useEffect, useState } from "react";
import { type KeyState, useKeyStates } from "./keyStatus";
import { capitalize, formatUsd, shortDate } from "./text";

export function Home({
  onOpenSettings,
  onOpenSession,
}: {
  onOpenSettings: () => void;
  onOpenSession: (id: string) => void;
}) {
  const keys = useKeyStates();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [recent, setRecent] = useState<TrainingSession[]>([]);

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
    window.greenroom.sessions.list().then((all) => setRecent(all.slice(0, 4)));
  }, []);

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

      {recent.length > 0 && (
        <div className="programme">
          <h2 className="section-title">Continue</h2>
          <ul className="cards">
            {recent.map((s) => (
              <li key={s.id}>
                <SessionRow session={s} onOpen={() => onOpenSession(s.id)} />
              </li>
            ))}
          </ul>
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

      {settings && <Billing settings={settings} onOpenSettings={onOpenSettings} />}
    </section>
  );
}

export function SessionRow({ session, onOpen }: { session: TrainingSession; onOpen: () => void }) {
  const def = trainingById(session.trainingId);
  const total = def?.phases.length ?? 0;
  const done = def ? def.phases.filter((p) => phaseState(def, session, p.id) === "done").length : 0;
  return (
    <button type="button" className="card-row" onClick={onOpen}>
      <span className="script-speaker">{shortDate(session.updatedAt)}</span>
      <span className="card-prompt">
        {session.title}
        <span className="item-detail">{def?.title ?? session.trainingId}</span>
      </span>
      <span className={done === total && total > 0 ? "stamp ok" : "stamp pending"}>
        {done} of {total} acts
      </span>
    </button>
  );
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
          up to {minutes} min{cost === null ? "" : `, about ${formatUsd(cost)}`}
        </span>
      </div>
    </div>
  );
}

function labels(keys: KeyState[]): string {
  return keys.map((k) => PROVIDER_INFO[k.provider].label).join(" and ");
}
