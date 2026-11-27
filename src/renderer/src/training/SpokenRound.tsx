import {
  type DrillResult,
  drillPassed,
  type SpokenCheckMethod,
  type SpokenDrill,
} from "@shared/drills";
import { dateTime } from "../text";

/** A spoken round: its score, each try with its verdict, and the coach's notes. */
export function SpokenRound({
  drill,
  busy,
  onCheck,
}: {
  drill: SpokenDrill;
  busy: string | null;
  onCheck: () => void;
}) {
  const { result, attempts } = drill;
  return (
    <li>
      <span className="script-speaker">
        {dateTime(drill.at)}
        {result ? (
          <ScoreStamp result={result} />
        ) : (
          <span className="stamp pending">{drill.unchecked ? "Not scored" : "Unchecked"}</span>
        )}
      </span>
      <span className="script-text">
        {result && attempts ? (
          <>
            <strong>{triesLine(result.correct, result.total)}</strong>{" "}
            <span className="hint">{CHECKED_BY[drill.checkedBy ?? "transcript"]}</span>
          </>
        ) : (
          "Spoken"
        )}
        {result?.notes && <span className="item-detail">{result.notes}</span>}
        {drill.unchecked && !result && <span className="item-detail">{drill.unchecked}</span>}
        {!result && (
          <button type="button" className="link" disabled={busy !== null} onClick={onCheck}>
            {busy === "listening" ? "Checking" : "Check this round"}
          </button>
        )}
        {attempts && attempts.length > 0 && (
          <ol className="attempts">
            {attempts.map((a, i) => (
              // Tries are often word-for-word repeats, so only the position tells them apart.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <li key={i}>
                <span className={a.ok ? "stamp ok" : "stamp bad"}>
                  {a.ok ? "Right" : "Not yet"}
                </span>{" "}
                “{a.said}”{!a.ok && a.heard && <> sounded like “{a.heard}”</>}
                {a.why && <span className="item-detail">{a.why}</span>}
              </li>
            ))}
          </ol>
        )}
        {!attempts &&
          drill.slips?.map((s) => (
            <span key={s.quote} className="item-detail">
              “{s.quote}” → {s.better}
            </span>
          ))}
      </span>
    </li>
  );
}

const CHECKED_BY: Record<Exclude<SpokenCheckMethod, "none">, string> = {
  audio: "Checked by ear from your recording.",
  transcript: "Checked from the transcript.",
};

function triesLine(correct: number, total: number): string {
  if (total === 0) return "No tries at the target yet.";
  return `${correct} of ${total} ${total === 1 ? "try" : "tries"} right.`;
}

export function ScoreStamp({ result }: { result: DrillResult }) {
  return (
    <span className={drillPassed(result) ? "stamp ok" : "stamp"}>
      {result.correct}/{result.total}
    </span>
  );
}
