import type { z } from "zod";
import type { VoiceSessionKind } from "./api";
import type { RubricCriterion } from "./report";
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
  phases: Phase[];
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
  /** `document` is long text that can also be imported from a PDF/TXT/Markdown file. */
  kind: "text" | "longtext" | "document";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Starts a new session filled with the habits still open from earlier sessions. */
  carryHabits?: boolean;
}

export interface FormPhase extends PhaseBase {
  kind: "form";
  fields: FormField[];
}
export type FormArtifact = Record<string, string>;

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
  choices?: (ctx: PhaseContext) => { id: string; label: string }[];
  task: (ctx: PhaseContext, choiceId: string | null) => string;
  /** Who the voice plays, e.g. "an audience member". Defaults to a job interviewer. */
  frame?: string;
  /** The voice only listens until you press the hand-over button (e.g. present, then Q&A). */
  listenFirst?: { button: string; message: string };
}
export interface VoiceRun {
  choiceId: string | null;
  at: string;
  endedBy: string | null;
  lines: { speaker: "you" | "interviewer"; text: string; startMs: number; endMs: number | null }[];
  costUsd: number;
  recordingPath: string | null;
  /** Transcript time at which the recording starts. */
  recordingOffsetMs?: number;
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

export function phaseState(
  def: TrainingDefinition,
  session: TrainingSession,
  phaseId: string,
): PhaseState {
  if (session.done.includes(phaseId)) return "done";
  return dependencies(def, phaseId).every((d) => session.done.includes(d)) ? "ready" : "locked";
}

/** Stores the artifact and marks the phase done; phases built on it reopen (their work stays). */
export function completePhase(
  def: TrainingDefinition,
  session: TrainingSession,
  phaseId: string,
  artifact: unknown,
  now = new Date(),
): TrainingSession {
  const reopened = dependents(def, phaseId);
  const done = session.done.filter((d) => !reopened.has(d) && d !== phaseId);
  const next = saveArtifact({ ...session, done: [...done, phaseId] }, phaseId, artifact, now);
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
  return def.phases.find((p) => phaseState(def, session, p.id) === "ready") ?? null;
}

export function contextOf(session: TrainingSession): PhaseContext {
  return { artifact: <T>(id: string) => session.artifacts[id] as T | undefined };
}

function dependencies(def: TrainingDefinition, phaseId: string): string[] {
  const index = def.phases.findIndex((p) => p.id === phaseId);
  const phase = def.phases[index];
  if (!phase) return [];
  if (phase.after) return phase.after;
  const previous = def.phases[index - 1];
  return previous ? [previous.id] : [];
}

function dependents(def: TrainingDefinition, phaseId: string): Set<string> {
  const found = new Set<string>();
  const visit = (id: string) => {
    for (const p of def.phases) {
      if (!found.has(p.id) && dependencies(def, p.id).includes(id)) {
        found.add(p.id);
        visit(p.id);
      }
    }
  };
  visit(phaseId);
  return found;
}
