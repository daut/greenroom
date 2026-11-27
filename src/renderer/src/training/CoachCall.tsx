import type { VoiceSessionKind } from "@shared/api";
import { estimateSessionCostUsd } from "@shared/billing";
import type { DrillRecording } from "@shared/drills";
import type { Settings } from "@shared/settings";
import type { VoiceRun } from "@shared/training";
import { useEffect, useRef, useState } from "react";
import { formatUsd } from "../text";
import { SessionBilling } from "../voice/SessionBilling";
import { RunningTime, Transcript } from "../voice/SessionPanel";
import { useVoiceSession } from "../voice/useVoiceSession";

export interface CoachCallResult extends DrillRecording {
  lines: VoiceRun["lines"];
  costUsd: number;
}

/**
 * A short spoken session with a coaching voice (it may explain and correct). Not recorded
 * unless `recordYou`; the transcript is handed back when it ends.
 */
export function CoachCall({
  label,
  frame,
  task,
  maxMinutes,
  fullLength,
  onFinished,
  teaser,
  intro,
  onLiveChange,
  model,
  recordYou = false,
}: {
  /** Shown above the controls once expanded. */
  intro?: string;
  /** Button text, e.g. "Talk it through". */
  label: string;
  /** When set, only this link shows (with length and cost) until clicked. */
  teaser?: string;
  onLiveChange?: (live: boolean) => void;
  frame: string;
  task: () => string;
  maxMinutes?: number;
  /** The coach keeps going until time is nearly up instead of ending when it sees fit. */
  fullLength?: boolean;
  onFinished: (result: CoachCallResult) => void;
  /** Which Settings model voices it; defaults to the drill model. */
  model?: VoiceSessionKind;
  /** Keep a recording (if Settings → Audio allows) so the sound can be checked. */
  recordYou?: boolean;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const voice = useVoiceSession(settings?.audio ?? null);
  const handled = useRef(true);
  const [expanded, setExpanded] = useState(!teaser);
  const latest = useRef({ voice, onFinished });
  latest.current = { voice, onFinished };

  // Leaving the screen mid-call still keeps what was said.
  useEffect(
    () => () => {
      if (handled.current) return;
      handled.current = true;
      const { voice: v, onFinished: finish } = latest.current;
      const lines = keptLines(v.transcript.lines);
      if (lines.length) finish({ lines, ...resultOf(v) });
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
    if (lines.length) onFinished({ lines, ...resultOf(voice) });
  }, [voice, onFinished]);

  const recorded = recordYou && settings?.audio.recordSessions === true;

  const start = () => {
    handled.current = false;
    void voice.start("drill", task(), {
      frame,
      coach: true,
      maxMinutes,
      fullLength,
      record: recorded,
      model,
    });
  };

  const live =
    voice.status === "live" || voice.status === "connecting" || voice.status === "ending";

  useEffect(() => {
    onLiveChange?.(live);
  }, [live, onLiveChange]);

  if (!expanded) {
    return (
      <button
        type="button"
        className="link"
        disabled={!settings}
        aria-expanded={false}
        onClick={() => setExpanded(true)}
      >
        {teaser}
        {settings ? ` · ${callSummary(settings, maxMinutes, model)}` : ""}
      </button>
    );
  }

  return (
    <div className="stack tight">
      {intro && <p className="hint">{intro}</p>}
      {settings && !live && (
        <SessionBilling settings={settings} kind="drill" model={model} maxMinutes={maxMinutes} />
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
        <span className="hint">
          Wear headphones.{" "}
          {recorded ? "Your side is recorded to check the sound." : "Not recorded."}
        </span>
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

function resultOf(voice: ReturnType<typeof useVoiceSession>): Omit<CoachCallResult, "lines"> {
  return {
    costUsd: voice.transcript.costUsd,
    recordingPath: voice.recordingPath,
    micRecordingPath: voice.micRecordingPath,
    recordingOffsetMs: voice.recordingOffsetMs,
  };
}

function callSummary(
  settings: Settings,
  maxMinutes: number | undefined,
  model: VoiceSessionKind = "drill",
): string {
  const minutes = Math.min(maxMinutes ?? Infinity, settings.limits.drillMaxMinutes);
  const cost = estimateSessionCostUsd(settings.models[model], minutes);
  return `up to ${minutes} min${cost === null ? "" : `, about ${formatUsd(cost)}`}`;
}
