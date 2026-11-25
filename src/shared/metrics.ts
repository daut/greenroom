export interface SpokenLine {
  speaker: "you" | "interviewer";
  text: string;
  startMs: number;
  endMs: number | null;
}

export interface SpeechMetrics {
  wordsPerMinute: number;
  /** Your share of the total speaking time, 0..1. */
  talkRatio: number;
  answers: number;
  averageAnswerSeconds: number;
  longestAnswerSeconds: number;
  fillers: Record<string, number>;
  fillersPerMinute: number;
}

const FILLERS = [
  "um",
  "uh",
  "er",
  "erm",
  "like",
  "you know",
  "basically",
  "actually",
  "sort of",
  "kind of",
  "i mean",
  "literally",
];

/** Speaking pace when a turn has no measured end, used to estimate its duration. */
const ESTIMATED_WPM = 150;

export function speechMetrics(lines: SpokenLine[]): SpeechMetrics {
  const yours = lines.filter((l) => l.speaker === "you" && l.text.trim());
  const theirs = lines.filter((l) => l.speaker === "interviewer" && l.text.trim());
  const yourMs = yours.map(durationMs);
  const yourTotal = sum(yourMs);
  const theirTotal = sum(theirs.map(durationMs));
  const words = sum(yours.map((l) => wordCount(l.text)));
  const fillers = countFillers(yours.map((l) => l.text).join(" "));
  const minutes = yourTotal / 60_000;

  return {
    wordsPerMinute: minutes > 0 ? words / minutes : 0,
    talkRatio: yourTotal + theirTotal > 0 ? yourTotal / (yourTotal + theirTotal) : 0,
    answers: yours.length,
    averageAnswerSeconds: yours.length ? yourTotal / yours.length / 1000 : 0,
    longestAnswerSeconds: yourMs.length ? Math.max(...yourMs) / 1000 : 0,
    fillers,
    fillersPerMinute: minutes > 0 ? sum(Object.values(fillers)) / minutes : 0,
  };
}

export function countFillers(text: string): Record<string, number> {
  const normalized = ` ${text
    .toLowerCase()
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")} `;
  const counts: Record<string, number> = {};
  for (const filler of FILLERS) {
    const n = normalized.split(` ${filler} `).length - 1;
    if (n > 0) counts[filler] = n;
  }
  return counts;
}

function durationMs(line: SpokenLine): number {
  if (line.endMs !== null && line.endMs > line.startMs) return line.endMs - line.startMs;
  return (wordCount(line.text) / ESTIMATED_WPM) * 60_000;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
