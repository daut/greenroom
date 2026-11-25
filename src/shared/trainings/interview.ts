import { z } from "zod";
import type { RubricCriterion } from "../report";
import {
  type Card,
  type FormArtifact,
  generatePhase,
  type PhaseContext,
  type TrainingDefinition,
} from "../training";

const questionSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        category: z.enum(["behavioral", "technical", "role", "company"]),
        question: z.string(),
        why: z.string(),
        followUps: z.array(z.string()),
      }),
    )
    .min(1),
});
export type QuestionBank = z.infer<typeof questionSchema>;

const RUBRIC: RubricCriterion[] = [
  {
    id: "structure",
    label: "Structure",
    description:
      "Answers follow a clear arc (e.g. situation, task, action, result) and get to the point.",
  },
  {
    id: "specificity",
    label: "Specifics and impact",
    description:
      "Concrete examples, the candidate's own decisions, numbers and outcomes rather than generalities.",
  },
  {
    id: "relevance",
    label: "Relevance",
    description: "Answers connect to the role and company in the job description.",
  },
  {
    id: "depth",
    label: "Depth under follow-ups",
    description: "Holds up when pushed: trade-offs, alternatives, what they would change.",
  },
  {
    id: "delivery",
    label: "Delivery",
    description: "Clear, confident, concise spoken delivery; few fillers; sensible answer length.",
  },
];

const questions = generatePhase<QuestionBank>({
  kind: "generate",
  id: "questions",
  title: "Question bank",
  intro: "Likely questions for this role, built from the job description, your CV and your notes.",
  role: "generate",
  system:
    "You are an experienced hiring manager and interview coach. You write realistic interview questions that a real interviewer at this company would ask for this exact role. Prefer specific, probing questions over generic ones.",
  schema: questionSchema,
  prompt: (ctx) =>
    `${background(ctx)}

Write 12 interview questions for this candidate: about 5 behavioral, 3 technical or craft questions matched to the role's seniority, 2 about the role itself, and 2 about the company or motivation. Target the gaps and strengths visible in the CV against the job description. For each give a short id (q1, q2, …), the category, the question, one sentence on why an interviewer would ask it, and 2 likely follow-ups.`,
  items: (bank) =>
    bank.questions.map((q) => ({
      label: q.category,
      text: q.question,
      detail: `${q.why} Follow-ups: ${q.followUps.join(" / ")}`,
    })),
});

export const interviewTraining: TrainingDefinition = {
  id: "interview",
  title: "Job interview",
  summary:
    "Prep from the job description and your CV, drill single answers out loud, then sit a full mock interview and get a scored report.",
  sessionTitle: (ctx) => {
    const setup = ctx.artifact<FormArtifact>("setup");
    if (!setup?.role) return undefined;
    return setup.company ? `${setup.role} at ${setup.company}` : setup.role;
  },
  phases: [
    {
      kind: "form",
      id: "setup",
      title: "The role",
      intro: "Everything the interviewer should know. Paste text, or import a file or a link.",
      fields: [
        {
          id: "role",
          label: "Role title",
          kind: "text",
          required: true,
          placeholder: "Staff software engineer",
        },
        { id: "company", label: "Company", kind: "text", placeholder: "Acme" },
        { id: "jobDescription", label: "Job description", kind: "document", required: true },
        { id: "cv", label: "Your CV", kind: "document", required: true },
        {
          id: "notes",
          label: "Company notes",
          kind: "longtext",
          hint: "Products, values, recent news, who you'll meet. Optional.",
        },
      ],
    },
    questions,
    {
      kind: "cards",
      id: "study",
      title: "Study cards",
      intro:
        "Draft an answer for the questions you're unsure about and get written feedback. Optional.",
      after: ["questions"],
      cards: (ctx) =>
        bankOf(ctx).map(
          (q): Card => ({ id: q.id, label: q.category, prompt: q.question, hint: q.why }),
        ),
      feedback: {
        system:
          "You are a blunt but kind interview coach. Give specific, actionable feedback on a drafted interview answer in under 150 words: what works, what's missing (structure, specifics, numbers, the candidate's own role), and one concrete rewrite suggestion. No preamble.",
        prompt: (card, draft, ctx) =>
          `${background(ctx)}\n\nQuestion: ${card.prompt}\n\nThe candidate's draft answer:\n${draft}`,
      },
    },
    {
      kind: "voice",
      id: "drill",
      title: "Drill",
      intro:
        "Answer one question out loud. The interviewer follows up like your preset says, then wraps up.",
      session: "drill",
      after: ["questions"],
      choices: (ctx) => bankOf(ctx).map((q) => ({ id: q.id, label: q.question })),
      task: (ctx, choiceId) => {
        const q = bankOf(ctx).find((x) => x.id === choiceId) ?? bankOf(ctx)[0];
        return `${briefing(ctx)}

This is a single-question drill. Briefly greet the candidate, then ask exactly this question: "${q?.question ?? "Tell me about yourself."}"
Ask follow-ups as your persona's follow-up depth says, for example: ${q?.followUps.join(" / ") ?? ""}. Then thank them and end the session.`;
      },
    },
    {
      kind: "voice",
      id: "mock",
      title: "Mock interview",
      intro: "A full interview with your interviewer preset. Uses the mock voice model.",
      session: "mock",
      after: ["questions"],
      task: (ctx) => `${briefing(ctx)}

Run a realistic full interview. Introduce yourself in one sentence and give a one-line agenda. Start with "tell me about yourself", then work through 5 or 6 of these questions, choosing the most relevant and adapting to the answers, with follow-ups as your persona says:
${bankOf(ctx)
  .map((q) => `- ${q.question}`)
  .join("\n")}
Leave a minute for the candidate's questions and answer them briefly in character. Then close politely and end the session.`,
    },
    {
      kind: "report",
      id: "report",
      title: "Mock report",
      intro: "A scored report for each mock interview, with speech metrics from the transcript.",
      source: "mock",
      after: ["mock"],
      rubric: RUBRIC,
      system:
        "You are an experienced interviewer writing honest, specific feedback after a mock interview. Score strictly: 3 is a typical hire-bar answer, 5 is exceptional. Quote or reference specific moments. The transcript is machine-transcribed, so ignore small transcription errors.",
      prompt: (ctx, transcript, rubric) =>
        `${background(ctx)}

Score the candidate's interview on each criterion from 1 to 5 with a one-to-two sentence comment:
${rubric}

Then give a 2-3 sentence summary, up to 3 strengths, and up to 3 improvements, each concrete enough to practise.

Transcript:
${transcript}`,
    },
    {
      kind: "report",
      id: "drill-notes",
      title: "Drill notes",
      intro: "Quick scored feedback on each drill.",
      source: "drill",
      after: ["drill"],
      rubric: RUBRIC.filter((c) => c.id !== "relevance"),
      system:
        "You are an interview coach giving quick, specific feedback on a single-question drill. Score strictly: 3 is a typical hire-bar answer. The transcript is machine-transcribed; ignore small errors.",
      prompt: (ctx, transcript, rubric) =>
        `${background(ctx)}

Score the answer on each criterion from 1 to 5 with a short comment:
${rubric}

Then a 1-2 sentence summary, up to 2 strengths and up to 2 improvements.

Transcript:
${transcript}`,
    },
  ],
};

function bankOf(ctx: PhaseContext): QuestionBank["questions"] {
  return ctx.artifact<QuestionBank>("questions")?.questions ?? [];
}

const LIMIT = 6000;

/** Full context for text tasks. */
function background(ctx: PhaseContext): string {
  const s = ctx.artifact<FormArtifact>("setup") ?? {};
  return [
    `Role: ${s.role ?? ""}${s.company ? ` at ${s.company}` : ""}`,
    `Job description:\n${clip(s.jobDescription)}`,
    `Candidate CV:\n${clip(s.cv)}`,
    s.notes ? `Company notes:\n${clip(s.notes)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Shorter context for the voice interviewer, whose instructions are re-read every turn. */
function briefing(ctx: PhaseContext): string {
  const s = ctx.artifact<FormArtifact>("setup") ?? {};
  return [
    `You are interviewing for: ${s.role ?? "the role"}${s.company ? ` at ${s.company}` : ""}.`,
    `Job description (excerpt): ${clip(s.jobDescription, 1500)}`,
    `Candidate CV (excerpt): ${clip(s.cv, 1500)}`,
    s.notes ? `Company notes: ${clip(s.notes, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function clip(text: string | undefined, max = LIMIT): string {
  const t = (text ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
