import type { MonthSpend } from "@shared/api";
import { activePersona, type Settings } from "@shared/settings";
import { useEffect, useState } from "react";
import { capitalize, formatUsd } from "../text";
import { RunningTime, Transcript } from "./SessionPanel";
import { useVoiceSession, type VoiceStatus } from "./useVoiceSession";

const TASK =
  "This is a short sound check. Greet the candidate in one sentence, then ask two easy warm-up " +
  "questions, one at a time (for example about their current role). After the second answer, " +
  "thank them and say the sound check is done.";

const STAMP: Record<VoiceStatus, { label: string; tone: string } | null> = {
  idle: null,
  connecting: { label: "Connecting", tone: "pending" },
  live: { label: "Live", tone: "live" },
  ending: { label: "Saving", tone: "pending" },
  ended: null,
  failed: null,
};

const ENDED_BY = {
  interviewer: "The interviewer wrapped up the sound check.",
  time: "The time limit ended the session.",
  you: "You ended the session.",
} as const;

export function SoundCheck() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [spend, setSpend] = useState<MonthSpend | null>(null);
  const session = useVoiceSession(settings?.audio ?? null);

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
  }, []);

  useEffect(() => {
    if (session.status === "idle" || session.status === "ended" || session.status === "failed") {
      window.greenroom.voice.monthSpend().then(setSpend);
    }
  }, [session.status]);

  if (!settings) return null;
  const persona = activePersona(settings);
  const busy = session.status === "connecting" || session.status === "ending";
  const running = session.status === "live";
  const stamp = STAMP[session.status];

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Sound check</h1>
        {stamp && <span className={`stamp ${stamp.tone}`}>{stamp.label}</span>}
      </header>

      <p className="lede">
        A short warm-up with your interviewer to check the microphone, your headphones and the voice
        before a real rehearsal. Uses the drill voice model.
      </p>

      <div className="stack">
        <div className="cast-line">
          <span>The interviewer</span>
          <span className="leader" aria-hidden="true" />
          <span>
            {persona.name}, voiced by {capitalize(persona.voice)}
          </span>
        </div>
        {spend && (
          <div className="cast-line">
            <span>Voice spend this month</span>
            <span className="leader" aria-hidden="true" />
            <span>
              {formatUsd(spend.spentUsd)}
              {spend.budgetUsd > 0 ? ` of ${formatUsd(spend.budgetUsd)}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="session-controls">
        {running ? (
          <button type="button" className="btn primary" onClick={() => void session.stop("you")}>
            End sound check
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void session.start("drill", TASK)}
          >
            {session.status === "ended" || session.status === "failed"
              ? "Run it again"
              : "Start sound check"}
          </button>
        )}
        <span className="hint">Headphones stop the interviewer hearing itself.</span>
      </div>

      {session.error && (
        <div className="notice" role="alert">
          <span className="stamp bad">Failed</span>
          <div className="notice-body">
            <h2>The session didn't start</h2>
            <p>{session.error}</p>
          </div>
        </div>
      )}

      {session.transcript.error && (
        <p className="warn-text" role="alert">
          OpenAI reported: {session.transcript.error}
        </p>
      )}

      {session.maxMinutes !== null && (
        <RunningTime
          elapsedMs={session.elapsedMs}
          maxMinutes={session.maxMinutes}
          costUsd={settings.limits.showCostMeter ? session.transcript.costUsd : null}
        />
      )}

      {session.transcript.lines.length > 0 && (
        <Transcript lines={session.transcript.lines} speaking={session.transcript.speaking} />
      )}

      {session.status === "ended" && session.endedBy && (
        <p className="ready-line">
          <span className="stamp ok">Done</span>
          {ENDED_BY[session.endedBy]}
        </p>
      )}

      {session.recordingPath && (
        <div className="cast-line">
          <span>Recording</span>
          <span className="leader" aria-hidden="true" />
          <button
            type="button"
            className="link"
            onClick={() => window.greenroom.voice.revealRecording(session.recordingPath ?? "")}
          >
            Show in folder
          </button>
        </div>
      )}
    </section>
  );
}
