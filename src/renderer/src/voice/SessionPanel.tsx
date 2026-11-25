import type { TranscriptLine } from "@shared/transcript";
import { useEffect, useLayoutEffect, useRef } from "react";
import { formatUsd } from "../text";

export function RunningTime({
  elapsedMs,
  maxMinutes,
  costUsd,
}: {
  elapsedMs: number;
  maxMinutes: number;
  costUsd: number | null;
}) {
  const limitMs = maxMinutes * 60_000;
  const share = Math.min(1, elapsedMs / limitMs);

  return (
    <div className="limit running">
      <span className="limit-label">{elapsedMs < limitMs ? "Running time" : "Wrapping up"}</span>
      <div
        className="limit-bar"
        role="progressbar"
        aria-label="Running time"
        aria-valuemin={0}
        aria-valuemax={maxMinutes * 60}
        aria-valuenow={Math.floor(elapsedMs / 1000)}
      >
        <span style={{ width: `${share * 100}%` }} />
      </div>
      <span className="clock">
        {clock(elapsedMs)} of {clock(limitMs)}
      </span>
      <span className="limit-cost">{costUsd === null ? "" : `${formatUsd(costUsd)} so far`}</span>
    </div>
  );
}

export function Transcript({
  lines,
  speaking,
  them = "Interviewer",
}: {
  lines: TranscriptLine[];
  speaking: TranscriptLine["speaker"] | null;
  /** Who the voice plays. */
  them?: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const last = lines.at(-1);
  const growth = `${lines.length}:${last?.text.length ?? 0}:${speaking}`;

  // Track whether the reader is at the bottom; scrolling up stops the auto-follow.
  useEffect(() => {
    const scroller = list.current?.closest<HTMLElement>(".content");
    if (!scroller) return;
    const onScroll = () => {
      atBottom.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  // Follow new speech only while the reader is at the bottom.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the transcript grows
  useLayoutEffect(() => {
    const scroller = list.current?.closest<HTMLElement>(".content");
    if (scroller && atBottom.current) scroller.scrollTop = scroller.scrollHeight;
  }, [growth]);

  return (
    <div className="programme">
      <h2 className="section-title">Transcript</h2>
      <ol className="script" aria-live="polite" ref={list}>
        {lines.map((line) => (
          <li key={line.id} className={line.final ? "" : "pending"}>
            <span className="script-speaker">{line.speaker === "you" ? "You" : them}</span>
            <span className="script-text">
              {line.text || (line.speaker === "you" ? "Listening…" : "…")}
            </span>
          </li>
        ))}
        <li className="script-cue" aria-hidden={!speaking}>
          {speaking === "you" && "You are speaking"}
          {speaking === "interviewer" && `${them} is speaking`}
        </li>
      </ol>
    </div>
  );
}

export function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
