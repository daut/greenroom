import { type DrillEntry, drillPassed } from "./drills";
import { type Finding, habitKey, type KnownHabit, type ReportArtifact } from "./report";
import type { TrainingDefinition, TrainingSession } from "./training";

export type HabitStatus = "open" | "improving" | "fixed";

/** A pattern the scorer has flagged, followed across every session of one training. */
export interface Habit extends KnownHabit {
  key: string;
  kind: Finding["kind"];
  why: string;
  /** Runs it showed up in, as a finding or a "recurred" review. */
  seen: number;
  drills: number;
  firstSeen: string;
  lastSeen: string;
  status: HabitStatus;
}

/** Habits worth carrying into the next session: everything not yet fixed, newest first. */
export function knownHabits(
  sessions: TrainingSession[],
  def: TrainingDefinition,
  options: TrackOptions = {},
): Habit[] {
  return trackHabits(sessions, def, options).filter((h) => h.status !== "fixed");
}

/** What a new session's "what to work on" starts with. */
export function carryOverText(habits: Habit[], max = 5): string {
  if (habits.length === 0) return "";
  const lines = habits.slice(0, max).map((h) => `- ${h.label}: say "${h.better}"`);
  return `Still open from earlier sessions:\n${lines.join("\n")}`;
}

export interface TrackOptions {
  /** Only what was known before this time, e.g. when scoring a run. */
  before?: string;
}

type HabitEvent =
  | { at: string; type: "seen"; finding: Finding }
  | { at: string; type: "recurred" | "improved" }
  | { at: string; type: "drill"; passed: boolean };

/** Every tracked habit of a training, most recently seen first. */
export function trackHabits(
  sessions: TrainingSession[],
  def: TrainingDefinition,
  { before }: TrackOptions = {},
): Habit[] {
  const events = new Map<string, HabitEvent[]>();
  const add = (label: string, event: HabitEvent) => {
    if (before && event.at >= before) return;
    const key = habitKey(label);
    events.set(key, [...(events.get(key) ?? []), event]);
  };

  for (const session of sessions.filter((s) => s.trainingId === def.id)) {
    for (const report of reportsOf(session, def)) {
      for (const finding of report.findings ?? []) {
        if (isWorthTracking(finding))
          add(finding.habit, { at: report.runAt, type: "seen", finding });
      }
      for (const review of report.habitReview ?? []) {
        if (review.status !== "not-heard")
          add(review.habit, { at: report.runAt, type: review.status });
      }
    }
    for (const drill of drillsOf(session, def)) {
      if (drill.result)
        add(drill.habit, { at: drill.at, type: "drill", passed: drillPassed(drill.result) });
    }
  }

  return [...events]
    .flatMap(([key, list]) => {
      const habit = habitFrom(key, list);
      return habit ? [habit] : [];
    })
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

function habitFrom(key: string, list: HabitEvent[]): Habit | null {
  const timeline = [...list].sort((a, b) => a.at.localeCompare(b.at));
  const sightings = timeline.filter((e) => e.type === "seen");
  const example = sightings.at(-1);
  if (example?.type !== "seen") return null;
  const slips = timeline.filter((e) => e.type === "seen" || e.type === "recurred");
  const seenRuns = new Set(slips.map((e) => e.at));
  const { finding } = example;
  return {
    key,
    label: finding.habit,
    kind: finding.kind,
    quote: finding.quote,
    better: finding.better,
    why: finding.why,
    seen: seenRuns.size,
    drills: timeline.filter((e) => e.type === "drill").length,
    firstSeen: sightings[0]?.at ?? example.at,
    lastSeen: slips.at(-1)?.at ?? example.at,
    status: statusOf(timeline),
  };
}

/** After the last slip: two good runs in a row fix it; one good run or a passed drill is progress. */
function statusOf(timeline: HabitEvent[]): HabitStatus {
  const isSlip = (e: HabitEvent) => e.type === "seen" || e.type === "recurred";
  const slipRuns = new Set(timeline.filter(isSlip).map((e) => e.at));
  const lastSlip = timeline.findLastIndex(isSlip);
  const since = timeline.slice(lastSlip + 1).filter((e) => !slipRuns.has(e.at));
  const goodRuns = since.filter((e) => e.type === "improved").length;
  if (goodRuns >= 2) return "fixed";
  if (goodRuns === 1 || since.some((e) => e.type === "drill" && e.passed)) return "improving";
  return "open";
}

function isWorthTracking(finding: Finding): boolean {
  return finding.severity >= 2 || finding.recurring;
}

function reportsOf(session: TrainingSession, def: TrainingDefinition) {
  return def.phases.flatMap((p) =>
    p.kind === "report"
      ? Object.values((session.artifacts[p.id] as ReportArtifact | undefined) ?? {})
      : [],
  );
}

function drillsOf(session: TrainingSession, def: TrainingDefinition): DrillEntry[] {
  return def.phases.flatMap((p) =>
    p.kind === "drills" ? ((session.artifacts[p.id] as DrillEntry[] | undefined) ?? []) : [],
  );
}
