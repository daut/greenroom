import type { Settings } from "@shared/settings";
import {
  CLAUDE_CODE_INSTALL,
  type ClaudeCodeStatus,
  TEXT_PROVIDER_INFO,
  TEXT_PROVIDERS,
  type TextProvider,
} from "@shared/text";
import { useEffect, useState } from "react";
import { errorMessage } from "../text";
import type { UpdateSettings } from "./SettingsPage";

type TestState = { ok: boolean; message: string } | "running" | null;

/** Where question generation, feedback and scoring run. */
export function TextProviderPicker({
  settings,
  update,
}: {
  settings: Settings;
  update: UpdateSettings;
}) {
  const provider = settings.text.provider;
  const [claudeCode, setClaudeCode] = useState<ClaudeCodeStatus | null>(null);
  const [test, setTest] = useState<TestState>(null);
  const [claudeCodeAllowed, setClaudeCodeAllowed] = useState(false);

  useEffect(() => {
    window.greenroom.app.info().then((info) => {
      setClaudeCodeAllowed(info.claudeCodeEnabled);
      if (info.claudeCodeEnabled) window.greenroom.text.claudeCodeStatus().then(setClaudeCode);
    });
  }, []);

  const providers = TEXT_PROVIDERS.filter(
    (p) => p !== "claude-code" || claudeCodeAllowed || provider === "claude-code",
  );

  const choose = (next: TextProvider) => {
    setTest(null);
    update((s) => ({
      ...s,
      text: { provider: next },
      models: { ...s.models, ...TEXT_PROVIDER_INFO[next].models },
    }));
  };

  const runTest = async () => {
    setTest("running");
    try {
      const reply = await window.greenroom.text.complete({
        role: "generate",
        system: "Reply with exactly the word: ready",
        prompt: "Are you there?",
      });
      setTest({ ok: true, message: `Replied: “${String(reply).trim().slice(0, 60)}”` });
    } catch (error) {
      setTest({ ok: false, message: errorMessage(error) });
    }
  };

  return (
    <section className="stack">
      <h2 className="section-title">Text tasks</h2>
      <p className="lede">Question generation, answer feedback and scoring run here.</p>

      <fieldset className="choice-list">
        <legend className="visually-hidden">Text provider</legend>
        {providers.map((p) => (
          <label key={p} className={p === provider ? "choice active" : "choice"}>
            <input
              type="radio"
              name="text-provider"
              checked={p === provider}
              onChange={() => choose(p)}
            />
            <span className="choice-label">{TEXT_PROVIDER_INFO[p].label}</span>
            <span className="choice-detail">{TEXT_PROVIDER_INFO[p].detail}</span>
            {p === "claude-code" &&
              (claudeCodeAllowed ? (
                <ClaudeCodeLine status={claudeCode} />
              ) : (
                <span className="choice-status warn-text">
                  Off in this build. Start Greenroom with GREENROOM_ENABLE_CLAUDE_CODE=1 to use it.
                </span>
              ))}
          </label>
        ))}
      </fieldset>

      <div className="session-controls">
        <button type="button" className="btn" disabled={test === "running"} onClick={runTest}>
          {test === "running" ? "Testing" : "Test text tasks"}
        </button>
        {test && test !== "running" && (
          <span className={test.ok ? "muted" : "warn-text"}>
            <span className={test.ok ? "stamp ok" : "stamp bad"}>
              {test.ok ? "Works" : "Failed"}
            </span>{" "}
            {test.message}
          </span>
        )}
      </div>
    </section>
  );
}

function ClaudeCodeLine({ status }: { status: ClaudeCodeStatus | null }) {
  if (!status) return <span className="choice-status muted">Checking…</span>;
  if (!status.installed) {
    return (
      <span className="choice-status warn-text">
        Not installed. In a terminal: <code>{CLAUDE_CODE_INSTALL}</code>, then run{" "}
        <code>claude</code> once to log in.
      </span>
    );
  }
  if (!status.loggedIn) {
    return (
      <span className="choice-status warn-text">
        Installed but not logged in. Run <code>claude</code> in a terminal to log in.
      </span>
    );
  }
  return (
    <span className="choice-status">
      <span className="stamp ok">Found</span> Claude Code {status.version}, logged in
    </span>
  );
}
