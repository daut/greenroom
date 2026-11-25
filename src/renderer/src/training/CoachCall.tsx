import type { Settings } from "@shared/settings";
import type { VoiceRun } from "@shared/training";
import { useEffect, useRef, useState } from "react";
import { SessionBilling } from "../voice/SessionBilling";
import { RunningTime, Transcript } from "../voice/SessionPanel";
import { useVoiceSession } from "../voice/useVoiceSession";

export interface CoachCallResult {
  lines: VoiceRun["lines"];
  costUsd: number;
}

/**
 * A short spoken session with a coaching voice (it may explain and correct). Not recorded;
 * the transcript is handed back when it ends.
 */
export function CoachCall({
  label,
  frame,
  task,
  maxMinutes,
  onFinished,
}: {
  /** Button text, e.g. "Talk it through". */
  label: string;
  frame: string;
  task: () => string;
  maxMinutes?: number;
  onFinished: (result: CoachCallResult) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const voice = useVoiceSession(settings?.audio ?? null);
  const handled = useRef(true);
  const latest = useRef({ voice, onFinished });
  latest.current = { voice, onFinished };

  // Leaving the screen mid-call still keeps what was said.
  useEffect(
    () => () => {
      if (handled.current) return;
      handled.current = true;
      const { voice: v, onFinished: finish } = latest.current;
      const lines = keptLines(v.transcript.lines);
      if (lines.length) finish({ lines, costUsd: v.transcript.costUsd });
    },
    [],
  );

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
  }, []);

  useEffect(() => {
    const finished = voice.status === "ended" || voice.status === "failed";
    if (!finished || handled.current) return;
    handled.current = true;
    const lines = keptLines(voice.transcript.lines);
    if (lines.length) onFinished({ lines, costUsd: voice.transcript.costUsd });
  }, [voice, onFinished]);

  const start = () => {
    handled.current = false;
    void voice.start("drill", task(), { frame, coach: true, maxMinutes, record: false });
  };

  const live =
    voice.status === "live" || voice.status === "connecting" || voice.status === "ending";

  return (
    <div className="stack tight">
      {settings && !live && (
        <SessionBilling settings={settings} kind="drill" maxMinutes={maxMinutes} />
      )}
      <div className="session-controls">
        {voice.status === "live" ? (
          <button type="button" className="btn primary" onClick={() => void voice.stop("you")}>
            End call
          </button>
        ) : (
          <button type="button" className="btn" disabled={live || !settings} onClick={start}>
            {voice.status === "connecting"
              ? "Connecting"
              : voice.status === "ending"
                ? "Saving"
                : label}
          </button>
        )}
        {voice.status === "live" && <span className="stamp live">Live</span>}
        <span className="hint">Wear headphones. Not recorded.</span>
      </div>
      {voice.error && (
        <p className="warn-text" role="alert">
          {voice.error}
        </p>
      )}
      {voice.transcript.error && (
        <p className="warn-text">OpenAI reported: {voice.transcript.error}</p>
      )}
      {live && voice.maxMinutes !== null && (
        <RunningTime
          elapsedMs={voice.elapsedMs}
          maxMinutes={voice.maxMinutes}
          costUsd={settings?.limits.showCostMeter ? voice.transcript.costUsd : null}
        />
      )}
      {live && voice.transcript.lines.length > 0 && (
        <Transcript
          lines={voice.transcript.lines}
          speaking={voice.transcript.speaking}
          them="Coach"
        />
      )}
    </div>
  );
}

function keptLines(lines: ReturnType<typeof useVoiceSession>["transcript"]["lines"]) {
  return lines
    .filter((l) => l.text.trim())
    .map(({ speaker, text, startMs, endMs }) => ({ speaker, text, startMs, endMs }));
}
