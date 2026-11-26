import type { z } from "zod";
import type { VoiceSessionKind } from "./api";
import type { RubricCriterion } from "./report";
import type { PersonaOverride } from "./settings";
import type { TextRole } from "./text";

/**
 * A training is an ordered list of phases. Each phase produces an artifact that later
 * phases read through the context. Add a training by writing a TrainingDefinition and
 * registering it in `trainings/index.ts`; the generic phase screens do the rest.
 */
export interface TrainingDefinition {
  id: string;
  title: string;
  summary: string;
  /** The phases of a fresh session, also listed on Home. */
  phases: Phase[];
  /** The phases once the setup is known, e.g. one voice phase per picked round. */
  phasesFor?: (ctx: PhaseContext) => Phase[];
  /** Session name once the inputs are known, e.g. "Staff engineer at Acme". */
  sessionTitle?: (ctx: PhaseContext) => string | undefined;
}

export type Phase = FormPhase | GeneratePhase | CardsPhase | VoicePhase | ReportPhase | DrillsPhase;

interface PhaseBase {
  id: string;
  title: string;
  intro?: string;
  /** Phases that must be done first. Defaults to the previous phase. */
  after?: string[];
}

export interface FormField {
  id: string;
  label: string;
  /**
   * `document` is long text that can also be imported from a PDF/TXT/Markdown file.
   * `pick` ticks any of `options`; the answer is their ids, comma-separated.
   */
  kind: "text" | "longtext" | "document" | "pick";
  options?: PickOption[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Starts a new session filled with the habits still open from earlier sessions. */
  carryHabits?: boolean;
}

export interface PickOption {
  id: string;
  label: string;
  detail?: string;
}

export interface FormPhase extends PhaseBase {
  kind: "form";
  fields: FormField[];
}
export type FormArtifact = Record<string, string>;

/** The ids ticked in a `pick` field. */
export function pickedIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export interface GeneratePhase<T = unknown> extends PhaseBase {
  kind: "generate";
  role: TextRole;
  system: string;
  prompt: (ctx: PhaseContext) => string;
  schema: z.ZodType<T>;
  /** How the generated result is listed on screen. */
  items: (output: T) => GeneratedItem[];
}
/** Type-checks a generate phase against its own schema, then erases T for the phase list. */
export function generatePhase<T>(phase: GeneratePhase<T>): GeneratePhase {
  return phase as unknown as GeneratePhase;
}

export interface GeneratedItem {
  label: string;
  text: string;
  detail?: string;
}

export interface Card {
  id: string;
  label: string;
  prompt: string;
  hint?: string;
}
export interface CardsPhase extends PhaseBase {
  kind: "cards";
  cards: (ctx: PhaseContext) => Card[];
  feedback: { system: string; prompt: (card: Card, draft: string, ctx: PhaseContext) => string };
}
export const CONFIDENCE = ["shaky", "okay", "solid"] as const;
export interface CardWork {
  draft: string;
  feedback?: string;
  confidence?: (typeof CONFIDENCE)[number];
}
export type CardsArtifact = Record<string, CardWork>;

export interface VoicePhase extends PhaseBase {
  kind: "voice";
  session: VoiceSessionKind;
  /** Optional pick before starting, e.g. which question to drill. */
  choices?: (ctx: PhaseContext) => Choice[];
  /** Adds a "type your own" option to the choices. */
  customChoice?: { label: string; placeholder: string };
  /** Adds an option whose label the text model writes on the fly. */
  randomChoice?: {
    label: string;
    system: string;
    prompt: (ctx: PhaseContext, pastLabels: string[]) => string;
  };
  task: (ctx: PhaseContext, choice: Choice | null) => string;
  /** Who the voice plays, e.g. "an audience member". Defaults to a job interviewer. */
  frame?: string;
  /** The voice only listens until you press the hand-over button (e.g. present, then Q&A). */
  listenFirst?: { button: string; message: string };
  /** Overrides the active preset's manner for this phase, e.g. a tough system-design round. */
  persona?: PersonaOverride;
  /** Shorter than the Settings limit for this session kind. */
  maxMinutes?: number;
  /** A text pad next to the call (code, design notes); shared on demand and scored. */
  scratchpad?: { label: string; placeholder: string };
}
export interface Choice {
  id: string;
  label: string;
}
export const CUSTOM_CHOICE = "custom";
export const RANDOM_CHOICE = "random";

export interface VoiceRun {
  choiceId: string | null;
  /** What was picked, typed or generated; older runs only have `choiceId`. */
  choiceLabel?: string;
  at: string;
  endedBy: string | null;
  lines: { speaker: "you" | "interviewer"; text: string; startMs: number; endMs: number | null }[];
  costUsd: number;
  recordingPath: string | null;
  /** Your mic alone, same clock as `recordingPath`; older runs don't have it. */
  micRecordingPath?: string | null;
  /** Transcript time at which the recording starts. */
  recordingOffsetMs?: number;
  /** The scratchpad as it was when the call ended. */
  scratchpad?: string;
}
export type VoiceArtifact = VoiceRun[];

/** Scores runs of a voice phase against a rubric and adds speech metrics. */
export interface ReportPhase extends PhaseBase {
  kind: "report";
  /** The voice phase whose runs are scored. */
  source: string;
  rubric: RubricCriterion[];
  /** Who scores, e.g. "You are an English teacher…". Also the coach in discussions and drills. */
  system: string;
  /** What the scorer and coach need to know about this session (goals, role, talk). */
  background: (ctx: PhaseContext) => string;
  /** Training-specific scoring guidance: how strict, which findings matter here. */
  guidance: string;
  /** Defaults to 6. */
  maxFindings?: number;
}

/**
 * Typed and spoken reps on the findings of this session's reports and on habits still open
 * from earlier sessions. The coach is the first report phase's scorer.
 */
export interface DrillsPhase extends PhaseBase {
  kind: "drills";
}

export interface TrainingSession {
  id: string;
  trainingId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  artifacts: Record<string, unknown>;
  done: string[];
  /** Set when the user marks the session done; it then leaves Continue on Home. */
  finishedAt?: string;
}

export type SessionStatus = "open" | "finished";

export interface SessionFilter {
  training: string | "all";
  status: SessionStatus | "all";
}

export interface PhaseContext {
  artifact<T>(phaseId: string): T | undefined;
}

export type PhaseState = "locked" | "ready" | "done";

export function newSession(def: TrainingDefinition, id: string, now = new Date()): TrainingSession {
  const at = now.toISOString();
  return {
    id,
    trainingId: def.id,
    title: def.title,
    createdAt: at,
    updatedAt: at,
    artifacts: {},
    done: [],
  };
}

/** This session's phases: they can depend on its setup. */
export function phasesOf(def: TrainingDefinition, session: TrainingSession): Phase[] {
  return def.phasesFor?.(contextOf(session)) ?? def.phases;
}

export function phaseState(
  def: TrainingDefinition,
  session: TrainingSession,
  phaseId: string,
): PhaseState {
  return stateIn(phasesOf(def, session), session, phaseId);
}

/** Stores the artifact and marks the phase done; phases built on it reopen (their work stays). */
export function completePhase(
  def: TrainingDefinition,
  session: TrainingSession,
  phaseId: string,
  artifact: unknown,
  now = new Date(),
): TrainingSession {
  const saved = saveArtifact(session, phaseId, artifact, now);
  const reopened = dependents(phasesOf(def, saved), phaseId);
  const done = session.done.filter((d) => !reopened.has(d) && d !== phaseId);
  const next = { ...saved, done: [...done, phaseId] };
  const title = def.sessionTitle?.(contextOf(next));
  return title ? { ...next, title } : next;
}

/** Keeps work in progress without changing whether the phase is done. */
export function saveArtifact(
  session: TrainingSession,
  phaseId: string,
  artifact: unknown,
  now = new Date(),
): TrainingSession {
  return {
    ...session,
    artifacts: { ...session.artifacts, [phaseId]: artifact },
    updatedAt: now.toISOString(),
  };
}

export function nextPhase(def: TrainingDefinition, session: TrainingSession): Phase | null {
  const phases = phasesOf(def, session);
  return phases.find((p) => stateIn(phases, session, p.id) === "ready") ?? null;
}

export function isFinished(session: TrainingSession): boolean {
  return Boolean(session.finishedAt);
}

export function finishSession(session: TrainingSession, now = new Date()): TrainingSession {
  const at = now.toISOString();
  return { ...session, finishedAt: at, updatedAt: at };
}

export function reopenSession(session: TrainingSession, now = new Date()): TrainingSession {
  const { finishedAt: _, ...rest } = session;
  return { ...rest, updatedAt: now.toISOString() };
}

export function filterSessions(
  sessions: TrainingSession[],
  filter: SessionFilter,
): TrainingSession[] {
  return sessions.filter(
    (s) =>
      (filter.training === "all" || s.trainingId === filter.training) &&
      (filter.status === "all" || (filter.status === "finished") === isFinished(s)),
  );
}

export function contextOf(session: TrainingSession): PhaseContext {
  return { artifact: <T>(id: string) => session.artifacts[id] as T | undefined };
}

function stateIn(phases: Phase[], session: TrainingSession, phaseId: string): PhaseState {
  if (session.done.includes(phaseId)) return "done";
  return dependencies(phases, phaseId).every((d) => session.done.includes(d)) ? "ready" : "locked";
}

function dependencies(phases: Phase[], phaseId: string): string[] {
  const index = phases.findIndex((p) => p.id === phaseId);
  const phase = phases[index];
  if (!phase) return [];
  if (phase.after) return phase.after;
  const previous = phases[index - 1];
  return previous ? [previous.id] : [];
}

function dependents(phases: Phase[], phaseId: string): Set<string> {
  const found = new Set<string>();
  const visit = (id: string) => {
    for (const p of phases) {
      if (!found.has(p.id) && dependencies(phases, p.id).includes(id)) {
        found.add(p.id);
        visit(p.id);
      }
    }
  };
  visit(phaseId);
  return found;
}
