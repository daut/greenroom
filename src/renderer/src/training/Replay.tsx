import type { VoiceRun } from "@shared/training";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { clock } from "../voice/SessionPanel";

/** Plays a run's recording with the transcript following along; click a line to jump to it. */
export function Replay({ run }: { run: VoiceRun }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [nowMs, setNowMs] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const offset = run.recordingOffsetMs ?? 0;
  // MediaRecorder WebM has no duration header; fall back to the transcript's length.
  const transcriptMs = Math.max(0, ...run.lines.map((l) => l.endMs ?? l.startMs)) - offset;
  const totalMs = durationMs > 0 ? durationMs : transcriptMs;

  useEffect(() => {
    if (!run.recordingPath) return;
    let objectUrl: string | null = null;
    window.greenroom.voice.readRecording(run.recordingPath).then((data) => {
      if (!data) return setMissing(true);
      objectUrl = URL.createObjectURL(new Blob([data], { type: "audio/webm" }));
      setUrl(objectUrl);
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [run.recordingPath]);

  const active = activeLine(run, nowMs);
  const positionMs = Math.max(0, nowMs - offset);

  const seekTo = (recordingMs: number, play = true) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, recordingMs / 1000);
    setNowMs(recordingMs + offset);
    if (play) void el.play().catch(() => {});
  };

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  return (
    <div className="stack tight">
      <h3 className="label">Replay</h3>
      {url ? (
        <div className="player">
          {/* biome-ignore lint/a11y/useMediaCaption: the synced transcript below is the caption track */}
          <audio
            ref={audio}
            src={url}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d)) setDurationMs(d * 1000);
            }}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d)) setDurationMs(d * 1000);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setNowMs(e.currentTarget.currentTime * 1000 + offset)}
          />
          <button type="button" className="btn primary" onClick={toggle}>
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            className="scrubber"
            aria-label="Position"
            min={0}
            max={Math.max(1, Math.round(totalMs))}
            value={Math.min(Math.round(positionMs), Math.round(totalMs))}
            style={{ "--fill": `${totalMs ? (positionMs / totalMs) * 100 : 0}%` } as CSSProperties}
            onChange={(e) => seekTo(Number(e.target.value), false)}
          />
          <span className="clock">
            {clock(positionMs)} / {clock(totalMs)}
          </span>
        </div>
      ) : (
        <p className="hint">
          {missing
            ? "The recording file is gone."
            : run.recordingPath
              ? "Loading recording…"
              : "No recording for this run (recording is off in Settings → Audio)."}
        </p>
      )}
      <ol className="script replay">
        {run.lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are an immutable recorded list
          <li key={i} className={i === active ? "now" : ""}>
            <button
              type="button"
              className="script-speaker link-plain"
              disabled={!url}
              onClick={() => seekTo(line.startMs - offset)}
              title="Play from here"
            >
              {line.speaker === "you" ? "You" : "Interviewer"} {clock(line.startMs)}
            </button>
            <span className="script-text">{line.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function activeLine(run: VoiceRun, nowMs: number): number {
  if (nowMs < 0) return -1;
  let index = -1;
  run.lines.forEach((l, i) => {
    if (l.startMs <= nowMs) index = i;
  });
  return index;
}
