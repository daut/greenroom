import type { ReportArtifact } from "@shared/report";
import type { Settings } from "@shared/settings";
import {
  type Choice,
  completePhase,
  contextOf,
  type TrainingDefinition,
  type TrainingSession,
  type VoiceArtifact,
  type VoicePhase,
  type VoiceRun,
} from "@shared/training";
import { useEffect, useRef, useState } from "react";
import { dateTime, formatUsd } from "../text";
import { SessionBilling } from "../voice/SessionBilling";
import { clock, RunningTime, Transcript } from "../voice/SessionPanel";
import { type EndReason, useVoiceSession } from "../voice/useVoiceSession";
import { ChoicePicker } from "./ChoicePicker";
import type { UpdateSession } from "./useTrainingSession";

const ENDED_BY: Record<EndReason, string> = {
  interviewer: "interviewer wrapped up",
  time: "ran past the time",
  you: "you ended it",
};

export function VoicePhaseView({
  def,
  phase,
  session,
  update,
  onOpenReport,
  reports,
}: {
  def: TrainingDefinition;
  phase: VoicePhase;
  session: TrainingSession;
  update: UpdateSession;
  onOpenReport: (() => void) | null;
  /** Reports of the report phase that scores this voice phase, if any. */
  reports: ReportArtifact | null;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const voice = useVoiceSession(settings?.audio ?? null);
  const choices = phase.choices?.(contextOf(session)) ?? [];
  const asksForChoice = choices.length > 0 || Boolean(phase.customChoice || phase.randomChoice);
  const [choice, setChoice] = useState<Choice | null>(null);
  const startedWith = useRef<Choice | null>(null);
  const runs = (session.artifacts[phase.id] as VoiceArtifact | undefined) ?? [];
  const saved = useRef(false);
  const [pad, setPad] = useState("");
  const padAtEnd = useRef(pad);
  padAtEnd.current = pad;
  const unscored = reports ? runs.filter((r) => !reports[r.at]).length : 0;

  useEffect(() => {
    window.greenroom.settings.get().then(setSettings);
  }, []);

  // When a session ends, keep it as a run of this phase.
  useEffect(() => {
    const finished = voice.status === "ended" || voice.status === "failed";
    if (!finished || saved.current) return;
    saved.current = true;
    const lines = voice.transcript.lines.filter((l) => l.text.trim());
    if (lines.length === 0) return;
    const run: VoiceRun = {
      choiceId: startedWith.current?.id ?? null,
      choiceLabel: startedWith.current?.label,
      at: new Date().toISOString(),
      endedBy: voice.endedBy,
      lines: lines.map(({ speaker, text, startMs, endMs }) => ({ speaker, text, startMs, endMs })),
      costUsd: voice.transcript.costUsd,
      recordingPath: voice.recordingPath,
      micRecordingPath: voice.micRecordingPath,
      recordingOffsetMs: voice.recordingOffsetMs,
      ...(padAtEnd.current.trim() && { scratchpad: padAtEnd.current }),
    };
    setPad("");
    update((s) => {
      const previous = (s.artifacts[phase.id] as VoiceArtifact | undefined) ?? [];
      return completePhase(def, s, phase.id, [...previous, run]);
    });
  }, [voice, def, phase.id, update]);

  const [handedOff, setHandedOff] = useState(false);

  const start = () => {
    saved.current = false;
    startedWith.current = choice;
    setHandedOff(false);
    void voice.start(phase.session, phase.task(contextOf(session), choice), {
      frame: phase.frame,
      listenFirst: Boolean(phase.listenFirst),
      persona: phase.persona,
      maxMinutes: phase.maxMinutes,
    });
  };

  const handOff = () => {
    if (!phase.listenFirst) return;
    voice.handOff(phase.listenFirst.message);
    setHandedOff(true);
  };

  const live =
    voice.status === "live" || voice.status === "connecting" || voice.status === "ending";

  return (
    <div className="stack voice-phase">
      <ChoicePicker
        phase={phase}
        ctx={contextOf(session)}
        pastLabels={runs.flatMap((r) => r.choiceLabel ?? [])}
        disabled={live}
        onChange={setChoice}
      />

      {settings && !live && (
        <SessionBilling
          settings={settings}
          kind={phase.session}
          maxMinutes={phase.maxMinutes}
          override={phase.persona}
        />
      )}

      <div className="session-controls">
        {voice.status === "live" ? (
          <button type="button" className="btn primary" onClick={() => void voice.stop("you")}>
            End {phase.session === "mock" ? "session" : "drill"}
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            disabled={live || !settings || (asksForChoice && !choice)}
            onClick={start}
          >
            {voice.status === "connecting"
              ? "Connecting"
              : voice.status === "ending"
                ? "Saving"
                : `Start ${phase.title.toLowerCase()}`}
          </button>
        )}
        {voice.status === "live" && phase.listenFirst && !handedOff && (
          <button type="button" className="btn" onClick={handOff}>
            {phase.listenFirst.button}
          </button>
        )}
        {voice.status === "live" && <span className="stamp live">Live</span>}
        <span className="hint">Wear headphones.</span>
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
      {phase.scratchpad && (
        <Scratchpad
          key={runs.length}
          {...phase.scratchpad}
          value={pad}
          onChange={setPad}
          onShare={voice.status === "live" ? () => voice.share(pad) : null}
        />
      )}
      {live && voice.transcript.lines.length > 0 && (
        <Transcript lines={voice.transcript.lines} speaking={voice.transcript.speaking} />
      )}

      {runs.length > 0 && !live && (
        <div className="programme">
          <h2 className="section-title">Runs</h2>
          <ol className="script">
            {[...runs].reverse().map((run) => (
              <li key={run.at}>
                <span className="script-speaker">
                  {dateTime(run.at)}
                  {reports && (
                    <span className={scoreStamp(reports[run.at]?.overall)}>
                      {reports[run.at]
                        ? `Scored ${reports[run.at]?.overall.toFixed(1)}`
                        : "Unscored"}
                    </span>
                  )}
                </span>
                <span className="script-text">
                  {run.choiceLabel ??
                    choices.find((c) => c.id === run.choiceId)?.label ??
                    phase.title}
                  <span className="item-detail">
                    {clock(lastMs(run))} · {run.lines.filter((l) => l.speaker === "you").length}{" "}
                    answers · {formatUsd(run.costUsd)}
                    {run.endedBy ? ` · ${ENDED_BY[run.endedBy as EndReason] ?? run.endedBy}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {onOpenReport && (
            <button
              type="button"
              className={unscored > 0 ? "btn primary" : "btn"}
              onClick={onOpenReport}
            >
              {unscored > 0
                ? `Score ${unscored === 1 ? "the new run" : `${unscored} runs`}`
                : "Open the report"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The interviewer sees the pad only when you share it, like turning your laptop around. */
function Scratchpad({
  label,
  placeholder,
  value,
  onChange,
  onShare,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Null while there's no call to share with. */
  onShare: (() => void) | null;
}) {
  const [shared, setShared] = useState<string | null>(null);
  const status =
    shared === null ? "Not shared yet" : shared === value ? "Shared" : "Changed since you shared";

  return (
    <div className="field scratchpad">
      <div className="field-head">
        <label htmlFor="scratchpad">{label}</label>
        {onShare && (
          <span className="field-actions">
            <span className="hint">{status}</span>
            <button
              type="button"
              className="btn"
              disabled={shared === value}
              onClick={() => {
                onShare();
                setShared(value);
              }}
            >
              Share with interviewer
            </button>
          </span>
        )}
      </div>
      <textarea
        id="scratchpad"
        rows={14}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="hint">The scorer reads what's here when the call ends.</span>
    </div>
  );
}

function lastMs(run: VoiceRun): number {
  return Math.max(0, ...run.lines.map((l) => l.endMs ?? l.startMs));
}

/** Green only at or above the hire bar (3); a lower score is plain ink, not "good". */
function scoreStamp(overall: number | undefined): string {
  if (overall === undefined) return "stamp pending";
  return overall >= 3 ? "stamp ok" : "stamp";
}
