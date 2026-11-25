import { z } from "zod";
import type { RubricCriterion } from "../report";
import {
  type FormArtifact,
  generatePhase,
  type PhaseContext,
  type TrainingDefinition,
} from "../training";

const qaSchema = z.object({
  questions: z.array(z.object({ id: z.string(), question: z.string(), angle: z.string() })).min(1),
});
type QaBank = z.infer<typeof qaSchema>;

const RUBRIC: RubricCriterion[] = [
  {
    id: "message",
    label: "Clear message",
    description: "The audience could repeat the main point and the ask afterwards.",
  },
  {
    id: "flow",
    label: "Structure and flow",
    description: "Strong opening, logical order, signposting, a real close.",
  },
  {
    id: "audience",
    label: "Audience fit",
    description: "Level, examples and vocabulary suit this audience and its goal.",
  },
  {
    id: "delivery",
    label: "Delivery",
    description: "Pace, few fillers, confident phrasing, sensible length for the slot.",
  },
  {
    id: "qa",
    label: "Q&A",
    description: "Direct, honest, concise answers; handles tough or off-topic questions.",
  },
];

const FRAME =
  "You are an audience member and Q&A host at the user's presentation rehearsal. The user is the presenter. Your interviewer persona settings describe how tough your questions are.";

export const presentationTraining: TrainingDefinition = {
  id: "presentation",
  title: "Presentation or demo",
  summary:
    "Rehearse a talk or demo out loud to a listening audience, take their questions, and get a scored report on message, flow and delivery.",
  sessionTitle: (ctx) => ctx.artifact<FormArtifact>("setup")?.title || undefined,
  phases: [
    {
      kind: "form",
      id: "setup",
      title: "The talk",
      intro: "What you're presenting, to whom, and what you want from them.",
      fields: [
        {
          id: "title",
          label: "Talk title",
          kind: "text",
          required: true,
          placeholder: "Q3 platform roadmap",
        },
        {
          id: "audience",
          label: "Audience",
          kind: "text",
          required: true,
          placeholder: "Engineering leads, mixed seniority",
        },
        {
          id: "goal",
          label: "What should they think or do afterwards?",
          kind: "longtext",
          required: true,
        },
        { id: "minutes", label: "Time slot (minutes)", kind: "text", placeholder: "10" },
        {
          id: "outline",
          label: "Outline, script or slide notes",
          kind: "document",
          required: true,
          hint: "Import your slide notes or paste an outline.",
        },
      ],
    },
    generatePhase<QaBank>({
      kind: "generate",
      id: "questions",
      title: "Likely questions",
      intro: "Questions this audience is likely to ask, including the awkward ones.",
      role: "generate",
      system:
        "You anticipate audience questions for a talk. Include supportive, skeptical and awkward questions this specific audience would really ask.",
      schema: qaSchema,
      prompt: (ctx) =>
        `${background(ctx)}\n\nWrite 8 likely audience questions. For each give an id (q1…), the question, and the angle behind it (e.g. skeptical about cost).`,
      items: (bank) =>
        bank.questions.map((q) => ({ label: q.id, text: q.question, detail: q.angle })),
    }),
    {
      kind: "voice",
      id: "rehearsal",
      title: "Rehearsal",
      intro:
        "Present out loud. The audience stays quiet until you press “Open the Q&A”, then asks questions.",
      session: "mock",
      frame: FRAME,
      listenFirst: {
        button: "Open the Q&A",
        message:
          "[The presenter has finished the talk. Thank them in one sentence and start the Q&A now.]",
      },
      task: (ctx) => `${briefing(ctx)}

First say only: "Whenever you're ready, go ahead." Then stay silent and listen to the whole presentation without replying.
When the Q&A opens, ask 3 or 4 questions one at a time, drawn from these and from what you actually heard:
${qaOf(ctx)
  .map((q) => `- ${q.question}`)
  .join("\n")}
Then thank the presenter and end the session.`,
    },
    {
      kind: "report",
      id: "report",
      title: "Rehearsal report",
      intro: "A scored report for each rehearsal, with pace and filler metrics.",
      source: "rehearsal",
      rubric: RUBRIC,
      system:
        "You are a presentation coach giving honest, specific feedback after a rehearsal. Score strictly: 3 is a competent talk, 5 is exceptional. Reference specific moments. The transcript is machine-transcribed; ignore small errors.",
      background,
      guidance: `The "Candidate" is the presenter. What to look for:
- Content: a buried main message or ask, a missing transition between sections, an example that doesn't suit this audience, a Q&A answer that dodged the question. "better" is a rewritten sentence they could actually say on stage; "why" says what the audience loses without it.
- Habits: weak openings ("so, um, today I'll…"), trailing endings, hedging, fillers, rushing. "better" is a concrete alternative phrase.
- Corrections only when wording changed the meaning.`,
    },
    {
      kind: "drills",
      id: "practice",
      title: "Practice",
      intro:
        "Work on what the report found, plus habits still open from earlier rehearsals: typed reps, then say it out loud.",
    },
  ],
};

function qaOf(ctx: PhaseContext): QaBank["questions"] {
  return ctx.artifact<QaBank>("questions")?.questions ?? [];
}

function background(ctx: PhaseContext): string {
  const s = ctx.artifact<FormArtifact>("setup") ?? {};
  return [
    `Talk: ${s.title ?? ""}`,
    `Audience: ${s.audience ?? ""}`,
    `Goal: ${s.goal ?? ""}`,
    s.minutes ? `Time slot: ${s.minutes} minutes` : "",
    `Outline:\n${clip(s.outline, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function briefing(ctx: PhaseContext): string {
  const s = ctx.artifact<FormArtifact>("setup") ?? {};
  return `The talk is "${s.title ?? ""}" for ${s.audience ?? "an audience"}. Its goal: ${clip(s.goal, 400)}`;
}

function clip(text: string | undefined, max: number): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
