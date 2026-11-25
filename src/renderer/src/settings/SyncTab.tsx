import type { SyncStatus } from "@shared/api";
import type { Settings } from "@shared/settings";
import { useCallback, useEffect, useState } from "react";
import { Field } from "../components/fields";
import { dateTime, errorMessage } from "../text";
import type { UpdateSettings } from "./SettingsPage";

export function SyncTab({ settings, update }: { settings: Settings; update: UpdateSettings }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => window.greenroom.sync.status().then(setStatus), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check when the project changes
  useEffect(() => {
    const timer = setTimeout(refresh, 400);
    return () => clearTimeout(timer);
  }, [refresh, settings.sync.url, settings.sync.publishableKey]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const setSync = (patch: Partial<Settings["sync"]>) =>
    update((s) => ({ ...s, sync: { ...s.sync, ...patch } }));

  return (
    <div className="stack wide">
      <section className="stack">
        <h2 className="section-title">Sync</h2>
        <p className="lede">
          Keep sessions and recordings in your own Supabase project so every machine sees the same
          history. Optional: everything works locally without it. Setup steps are in the README.
        </p>
        <div className="grid-2">
          <Field label="Project URL" hint="https://<project>.supabase.co">
            {(id) => (
              <input
                id={id}
                value={settings.sync.url}
                onChange={(e) => setSync({ url: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Publishable key"
            hint="sb_publishable_… (safe to store; never the secret key)"
          >
            {(id) => (
              <input
                id={id}
                value={settings.sync.publishableKey}
                spellCheck={false}
                onChange={(e) => setSync({ publishableKey: e.target.value })}
              />
            )}
          </Field>
        </div>

        {status?.configured && !status.signedIn && (
          <div className="stack">
            <div className="key-controls">
              <label className="visually-hidden" htmlFor="sync-email">
                Email
              </label>
              <input
                id="sync-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                disabled={busy || !email.includes("@")}
                onClick={() =>
                  act(async () => {
                    await window.greenroom.sync.sendCode(email);
                    setCodeSent(true);
                  })
                }
              >
                {codeSent ? "Send again" : "Email me a sign-in"}
              </button>
            </div>
            <div className="key-controls">
              <label className="visually-hidden" htmlFor="sync-password">
                Password
              </label>
              <input
                id="sync-password"
                type="password"
                placeholder="Password (create the user in Supabase → Authentication → Users)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  password &&
                  act(() => window.greenroom.sync.signInWithPassword(email, password))
                }
              />
              <button
                type="button"
                className="btn primary"
                disabled={busy || !email.includes("@") || !password}
                onClick={() => act(() => window.greenroom.sync.signInWithPassword(email, password))}
              >
                Sign in
              </button>
            </div>
            <p className="hint">
              Or sign in by email instead of a password. Supabase's built-in mailer sends at most 2
              emails an hour per project.
            </p>
            {codeSent && (
              <div className="key-controls">
                <label className="visually-hidden" htmlFor="sync-code">
                  Code or link
                </label>
                <input
                  id="sync-code"
                  spellCheck={false}
                  placeholder="6-digit code, or paste the whole link from the email"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || code.trim().length < 6}
                  onClick={() => act(() => window.greenroom.sync.verifyCode(email, code))}
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        )}

        {status?.signedIn && (
          <div className="stack">
            <div className="cast-line">
              <span>Signed in</span>
              <span className="leader" aria-hidden="true" />
              <span>{status.email}</span>
            </div>
            <div className="cast-line">
              <span>Last sync</span>
              <span className="leader" aria-hidden="true" />
              <span>
                {status.syncing
                  ? "Syncing…"
                  : status.lastSyncAt
                    ? `${dateTime(status.lastSyncAt)}${summary(status)}`
                    : "Not yet"}
              </span>
            </div>
            <div className="session-controls">
              <button
                type="button"
                className="btn primary"
                disabled={busy || status.syncing}
                onClick={() => act(() => window.greenroom.sync.now())}
              >
                Sync now
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => act(() => window.greenroom.sync.signOut())}
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {(error || status?.lastError) && (
          <p className="warn-text" role="alert">
            {error ?? status?.lastError}
          </p>
        )}
      </section>

      <DataSection />
    </div>
  );
}

function DataSection() {
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="stack">
      <h2 className="section-title">Your data</h2>
      <p className="lede">
        Sessions and recordings live in this app's data folder. Export them, or wipe them. Settings
        and keys are kept.
      </p>
      <div className="session-controls">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            const path = await window.greenroom.data.exportAll();
            setMessage(path ? `Exported to ${path}` : null);
          }}
        >
          Export all sessions
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                await window.greenroom.data.deleteAll();
                setConfirming(false);
                setMessage("All sessions and recordings on this machine were deleted.");
              }}
            >
              Delete everything
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Keep my data
            </button>
          </>
        ) : (
          <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
            Delete all sessions…
          </button>
        )}
      </div>
      {confirming && (
        <p className="warn-text">This can't be undone. With sync on, it deletes them everywhere.</p>
      )}
      {message && <p className="hint">{message}</p>}
    </section>
  );
}

function summary({ lastResult: r }: SyncStatus): string {
  if (!r) return "";
  const parts = [
    r.uploaded && `${r.uploaded} up`,
    r.downloaded && `${r.downloaded} down`,
    r.deleted && `${r.deleted} deleted`,
    r.recordingsUp + r.recordingsDown > 0 && `${r.recordingsUp + r.recordingsDown} recordings`,
  ].filter(Boolean);
  return parts.length ? `, ${parts.join(", ")}` : ", up to date";
}
