import { type KeyStatus, type KeyTestResult, PROVIDER_INFO } from "@shared/keys";
import { useState } from "react";
import { publishKeyStatus, publishTestResult, useKeyStates } from "../keyStatus";

export function KeysTab() {
  const statuses = useKeyStates();

  return (
    <div className="stack">
      <p className="lede">
        Keys stay in the app's main process, encrypted with your system keychain. When no key is
        saved here, Greenroom uses the matching environment variable.
      </p>
      <div className="key-list">
        {statuses.map((status) => (
          <KeyRow key={status.provider} status={status} />
        ))}
      </div>
    </div>
  );
}

type TestState = KeyTestResult | "running" | null;

function KeyRow({ status }: { status: KeyStatus }) {
  const info = PROVIDER_INFO[status.provider];
  const [draft, setDraft] = useState("");
  const [test, setTest] = useState<TestState>(null);
  const inputId = `key-${status.provider}`;

  const runTest = async () => {
    setTest("running");
    const result = await window.greenroom.keys.test(status.provider);
    setTest(result);
    publishTestResult(status.provider, result.ok);
  };

  const save = async () => {
    publishKeyStatus(await window.greenroom.keys.set(status.provider, draft));
    setDraft("");
    runTest();
  };

  const remove = async () => {
    publishKeyStatus(await window.greenroom.keys.clear(status.provider));
    setTest(null);
  };

  return (
    <section className="key-row" aria-labelledby={`${inputId}-name`}>
      <div className="key-head">
        <h2 id={`${inputId}-name`}>{info.label}</h2>
        <span className="leader" aria-hidden="true" />
        <span className="key-source">{describeSource(status, info.envVar)}</span>
        <TestStamp test={test} />
      </div>

      {!status.encrypted && (
        <p className="warn-text">
          No system keyring found, so this key is stored unencrypted in a file only you can read.
          Install gnome-keyring or KWallet, or set {info.envVar} instead.
        </p>
      )}

      <div className="key-controls">
        <label htmlFor={inputId} className="visually-hidden">
          {info.label} API key
        </label>
        <input
          id={inputId}
          type="password"
          placeholder={status.hint ? `Replace key ending ${status.hint}` : "Paste API key"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && draft.trim() && save()}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="btn primary" disabled={!draft.trim()} onClick={save}>
          Save
        </button>
        <button
          type="button"
          className="btn"
          disabled={status.source === "none" || test === "running"}
          onClick={runTest}
        >
          {test === "running" ? "Testing" : "Test"}
        </button>
        {status.source === "stored" && (
          <button type="button" className="btn danger" onClick={remove}>
            Remove
          </button>
        )}
      </div>

      <div className="key-foot">
        <span className={test && test !== "running" && !test.ok ? "warn-text" : "muted"}>
          {test && test !== "running" && !test.ok
            ? `${test.message}. Paste a new key and save, or check it in the ${info.label} console.`
            : ""}
        </span>
        <button
          type="button"
          className="link"
          onClick={() => window.greenroom.app.openExternal(info.consoleUrl)}
        >
          Get an {info.label} key
        </button>
      </div>
    </section>
  );
}

function TestStamp({ test }: { test: TestState }) {
  if (test === null) return null;
  if (test === "running") return <span className="stamp pending">Testing</span>;
  return <span className={test.ok ? "stamp ok" : "stamp bad"}>{test.ok ? "Works" : "Failed"}</span>;
}

function describeSource(status: KeyStatus, envVar: string): string {
  if (status.source === "stored") return `Saved, ends ${status.hint}`;
  if (status.source === "env") return `From ${envVar}, ends ${status.hint}`;
  return "Not set";
}
