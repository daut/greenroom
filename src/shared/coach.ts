import {
  type ChatTurn,
  type Finding,
  formatTranscript,
  type KnownHabit,
  type Report,
  type ReportArtifact,
  rubricText,
} from "./report";
import {
  type PhaseContext,
  type ReportPhase,
  saveArtifact,
  type TrainingSession,
  type VoiceRun,
} from "./training";

const COACH_ROLE = `Now you are talking the learner through this report one-to-one. Answer their questions about their scores and findings: explain the rule or reason behind each point simply, give two or three fresh examples, point to the exact moment in the transcript, and suggest one small thing to try. Be honest; if a finding was too harsh or the transcript misheard them, say so. Keep replies under 150 words unless they ask for more. Plain text: short paragraphs, "- " bullets, **bold** for the key phrase. When it helps, end with a quick check question for them to answer.`;

export const VOICE_COACH_FRAME =
  "You are the user's speaking coach, talking them through the feedback on a practice session they just did. Unlike a rehearsal, here you explain and correct.";

export function coachSystem(phase: ReportPhase): string {
  return `${phase.system}\n\n${COACH_ROLE}`;
}

/** Everything the coach needs about one scored run. */
export function coachBriefing(
  phase: ReportPhase,
  ctx: PhaseContext,
  run: VoiceRun,
  report: Report,
  known: KnownHabit[],
  { transcript = true } = {},
): string {
  return [
    phase.background(ctx),
    `Rubric:\n${rubricText(phase.rubric)}`,
    `The report\nScores:\n${scoresText(phase, report)}\nSummary: ${report.summary}\nStrengths:\n${bullets(report.strengths)}`,
    findingsText(report),
    `Speech: ${Math.round(report.metrics.wordsPerMinute)} wpm, ${report.metrics.fillersPerMinute.toFixed(1)} fillers/min (${fillersText(report)}), ${Math.round(report.metrics.talkRatio * 100)}% of speaking time.`,
    known.length
      ? `Habits still open from earlier sessions:\n${known.map(habitLine).join("\n")}`
      : "",
    transcript
      ? `Transcript (numbered lines; "Candidate" is the learner):\n${formatTranscript(run.lines)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function discussPrompt(
  briefing: string,
  history: ChatTurn[],
  question: string,
  finding?: Finding,
): string {
  return [
    briefing,
    history.length ? `Your conversation so far:\n${history.map(turnLine).join("\n")}` : "",
    finding
      ? `The learner is asking about finding ${finding.id} ("${finding.quote}" → "${finding.better}").`
      : "",
    `Learner: ${question}`,
    "Reply as the coach.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function voiceCoachTask(briefing: string, finding?: Finding): string {
  const start = finding
    ? `Start with finding ${finding.id} ("${finding.quote}" → "${finding.better}"): explain it, give a fresh example, and have them say a sentence using it.`
    : "Start by asking which point they want to go through; if they don't mind, take the focus findings first.";
  return `${briefing}

${start}
Talk like a coach on a call: short turns, one idea at a time, check they understood before moving on, and have them say the better version out loud. Answer their questions honestly; if a finding was wrong, say so. When they're done, close briefly.`;
}

export function voiceTurns(lines: VoiceRun["lines"], at: string, thread: string): ChatTurn[] {
  return lines
    .filter((l) => l.text.trim())
    .map((l) => ({
      role: l.speaker === "you" ? "you" : "coach",
      text: l.text,
      at,
      via: "voice",
      thread,
    }));
}

/**
 * Each finding has its own conversation, keyed by what it corrects rather than its id, so it
 * survives re-scoring when the same correction comes back. "" is the whole report.
 */
export function threadKey(finding: Finding | null): string {
  return finding ? `${finding.quote}→${finding.better}` : "";
}

/** The turns of one conversation. */
export function threadTurns(discussion: ChatTurn[], findings: Finding[], thread: string) {
  return withThreads(discussion, findings).filter((t) => t.thread === thread);
}

/**
 * Tags older turns with their conversation, using the findings they were asked about (so do it
 * before re-scoring renumbers them). A reply follows its question; calls were about the report.
 */
export function withThreads(discussion: ChatTurn[], findings: Finding[]): ChatTurn[] {
  let current = "";
  return discussion.map((t) => {
    current = t.thread ?? legacyThread(t, findings, current);
    return t.thread === current ? t : { ...t, thread: current };
  });
}

export function withDiscussion(
  session: TrainingSession,
  phaseId: string,
  runAt: string,
  turns: ChatTurn[],
): TrainingSession {
  const reports = (session.artifacts[phaseId] as ReportArtifact | undefined) ?? {};
  const report = reports[runAt];
  if (!report) return session;
  const discussion = [...(report.discussion ?? []), ...turns];
  return saveArtifact(session, phaseId, { ...reports, [runAt]: { ...report, discussion } });
}

function legacyThread(turn: ChatTurn, findings: Finding[], previous: string): string {
  if (turn.via === "voice") return "";
  if (turn.role === "coach") return previous;
  return threadKey(findings.find((f) => f.id === turn.findingId) ?? null);
}

function scoresText(phase: ReportPhase, report: Report): string {
  return report.scores
    .map((s) => {
      const label = phase.rubric.find((c) => c.id === s.criterion)?.label ?? s.criterion;
      return `- ${label}: ${s.score}/5 — ${s.comment}`;
    })
    .join("\n");
}

function findingsText(report: Report): string {
  if (report.findings?.length) {
    const lines = report.findings.map(
      (f) =>
        `- [${f.id}] ${f.kind}${f.line === null ? "" : `, line #${f.line + 1}`}${f.recurring ? ", recurring" : ""}: "${f.quote}" → "${f.better}". Habit: ${f.habit}. Why: ${f.why}`,
    );
    return `Findings:\n${lines.join("\n")}\nFocus first: ${(report.focus ?? []).join(", ")}`;
  }
  return report.improvements?.length ? `Improvements:\n${bullets(report.improvements)}` : "";
}

function fillersText(report: Report): string {
  const entries = Object.entries(report.metrics.fillers).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([w, n]) => `${w} ×${n}`).join(", ") : "none";
}

function habitLine(h: KnownHabit): string {
  return `- ${h.label} (e.g. "${h.quote}" → "${h.better}")`;
}

function turnLine(t: ChatTurn): string {
  return `${t.role === "you" ? "Learner" : "Coach"}: ${t.text}`;
}

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}
