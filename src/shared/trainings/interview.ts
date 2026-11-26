import { z } from "zod";
import { UNDERSTANDABILITY } from "../pronunciation";
import type { Report, ReportArtifact, RubricCriterion } from "../report";
import {
  type Card,
  type FormArtifact,
  type FormPhase,
  generatePhase,
  type Phase,
  type PhaseContext,
  pickedIds,
  type ReportPhase,
  type TrainingDefinition,
  type VoicePhase,
} from "../training";
import { CRITERIA, type InterviewRound, ROUNDS } from "./interview-rounds";

const questionItem = z.object({
  id: z.string(),
  category: z.enum(["behavioral", "technical", "role", "company"]),
  question: z.string(),
  why: z.string(),
  followUps: z.array(z.string()),
});
const questionSchema = z.object({ questions: z.array(questionItem).min(1) });
export type QuestionBank = z.infer<typeof questionSchema>;

/** A loop's bank: every question belongs to one of the picked rounds. */
const loopQuestionSchema = z.object({
  questions: z.array(questionItem.extend({ round: z.string() })).min(1),
});
type Question = QuestionBank["questions"][number] & { round?: string };

const VERDICTS = ["strong hire", "hire", "lean hire", "lean no hire", "no hire"] as const;
const debriefSchema = z.object({
  rounds: z.array(z.object({ round: z.string(), verdict: z.enum(VERDICTS), reason: z.string() })),
  verdict: z.enum(VERDICTS),
  reason: z.string(),
  fixes: z.array(z.string()),
});
type Debrief = z.infer<typeof debriefSchema>;

const RUBRIC: RubricCriterion[] = [
  CRITERIA.structure,
  CRITERIA.specificity,
  CRITERIA.relevance,
  CRITERIA.depth,
  CRITERIA.delivery,
  UNDERSTANDABILITY,
];

const FINDINGS_GUIDANCE = `What to look for:
- Content: a missing result or number, an unclear personal role ("we" for everything), no trade-offs under follow-ups, an answer that misses what the question was testing. "better" is a short rewrite of how that part of the answer could go, in the candidate's own story; "why" says what the interviewer needed to hear.
- Habits: rambling openings, repeating the question, hedging ("I think maybe"), weak endings, fillers. "better" is a concrete alternative phrase or structure.
- Corrections only when wording changed the meaning or sounded unprofessional.`;

const QUESTION_BANK_SYSTEM =
  "You are an experienced hiring manager and interview coach. You write realistic interview questions that a real interviewer at this company would ask for this exact role. Prefer specific, probing questions over generic ones.";

const SETUP: FormPhase = {
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
    {
      id: "rounds",
      label: "Interview rounds",
      kind: "pick",
      options: ROUNDS.map((r) => ({ id: r.id, label: r.title, detail: r.detail })),
      hint: "Tick the rounds of your loop to rehearse them in order, each with its own interviewer, then get a hiring debrief. Leave them all empty for a single mock interview.",
    },
  ],
};

const QUESTIONS = generatePhase<QuestionBank>({
  kind: "generate",
  id: "questions",
  title: "Question bank",
  intro: "Likely questions for this role, built from the job description, your CV and your notes.",
  role: "generate",
  system: QUESTION_BANK_SYSTEM,
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

const STUDY: Phase = {
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
};

const DRILL: Phase = {
  kind: "voice",
  id: "drill",
  title: "Drill",
  intro:
    "Answer one question out loud. The interviewer follows up like your preset says, then wraps up.",
  session: "drill",
  after: ["questions"],
  choices: (ctx) => bankOf(ctx).map((q) => ({ id: q.id, label: q.question })),
  task: (ctx, choice) => {
    const q = bankOf(ctx).find((x) => x.id === choice?.id) ?? bankOf(ctx)[0];
    return `${briefing(ctx)}

This is a single-question drill. Briefly greet the candidate, then ask exactly this question: "${q?.question ?? "Tell me about yourself."}"
Ask follow-ups as your persona's follow-up depth says, for example: ${q?.followUps.join(" / ") ?? ""}. Then thank them and end the session.`;
  },
};

const MOCK: Phase = {
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
};

const MOCK_REPORT: Phase = {
  kind: "report",
  id: "report",
  title: "Mock report",
  intro: "A scored report for each mock interview, with speech metrics from the transcript.",
  source: "mock",
  after: ["mock"],
  rubric: RUBRIC,
  system:
    "You are an experienced interviewer writing honest, specific feedback after a mock interview. Score strictly: 3 is a typical hire-bar answer, 5 is exceptional. Quote or reference specific moments. The transcript is machine-transcribed, so ignore small transcription errors.",
  background,
  guidance: FINDINGS_GUIDANCE,
};

const DRILL_NOTES: Phase = {
  kind: "report",
  id: "drill-notes",
  title: "Drill notes",
  intro: "Quick scored feedback on each drill.",
  source: "drill",
  after: ["drill"],
  rubric: RUBRIC.filter((c) => c.id !== "relevance"),
  system:
    "You are an interview coach giving quick, specific feedback on a single-question drill. Score strictly: 3 is a typical hire-bar answer. The transcript is machine-transcribed; ignore small errors.",
  background,
  guidance: FINDINGS_GUIDANCE,
  maxFindings: 3,
};

const PRACTICE: Phase = {
  kind: "drills",
  id: "practice",
  title: "Practice",
  intro:
    "Work on what the reports found, plus habits still open from earlier sessions: typed reps, then say it out loud.",
  after: ["questions"],
};

export const interviewTraining: TrainingDefinition = {
  id: "interview",
  title: "Job interview",
  summary:
    "Prep from the job description and your CV, drill single answers out loud, then sit a full mock interview or a loop of rounds and get scored reports.",
  sessionTitle: (ctx) => {
    const setup = ctx.artifact<FormArtifact>("setup");
    if (!setup?.role) return undefined;
    return setup.company ? `${setup.role} at ${setup.company}` : setup.role;
  },
  phases: interviewPhases([]),
  phasesFor: (ctx) => interviewPhases(pickedRounds(ctx)),
};

/** One mock interview, or the picked rounds in loop order followed by a hiring debrief. */
function interviewPhases(rounds: InterviewRound[]): Phase[] {
  const last = rounds.at(-1);
  if (!last) return [SETUP, QUESTIONS, STUDY, DRILL, MOCK, MOCK_REPORT, DRILL_NOTES, PRACTICE];
  return [
    SETUP,
    loopQuestions(rounds),
    STUDY,
    DRILL,
    ...rounds.flatMap((round, i) => [roundCall(round, rounds.slice(0, i)), roundReport(round)]),
    DRILL_NOTES,
    debrief(rounds, last),
    PRACTICE,
  ];
}

function pickedRounds(ctx: PhaseContext): InterviewRound[] {
  const picked = new Set(pickedIds(ctx.artifact<FormArtifact>("setup")?.rounds));
  return ROUNDS.filter((r) => picked.has(r.id));
}

function loopQuestions(rounds: InterviewRound[]): Phase {
  return generatePhase<z.infer<typeof loopQuestionSchema>>({
    kind: "generate",
    id: "questions",
    title: "Question bank",
    intro:
      "Likely questions for each round you picked, built from the job description, your CV and your notes.",
    role: "generate",
    system: QUESTION_BANK_SYSTEM,
    schema: loopQuestionSchema,
    prompt: (ctx) =>
      `${background(ctx)}

The candidate faces an interview loop with these rounds. Write the questions for each round:
${rounds.map((r) => `- ${r.id} (${r.title}): ${r.questions}`).join("\n")}
Target the gaps and strengths visible in the CV against the job description. For each question give a short id (q1, q2, …), the round id, the category (behavioral, technical, role or company), the question, one sentence on why an interviewer would ask it, and 2 likely follow-ups.`,
    items: (bank) =>
      bank.questions.map((q) => ({
        label: ROUNDS.find((r) => r.id === q.round)?.title ?? q.category,
        text: q.question,
        detail: `${q.why} Follow-ups: ${q.followUps.join(" / ")}`,
      })),
  });
}

/** A round opens once the previous one is scored; its interviewer reads the earlier rounds' notes. */
function roundCall(round: InterviewRound, earlier: InterviewRound[]): VoicePhase {
  const previous = earlier.at(-1);
  return {
    kind: "voice",
    id: callId(round),
    title: round.title,
    intro: `${round.detail} Your interviewer for this round, about ${round.minutes} minutes.`,
    session: "mock",
    after: previous ? [reportId(previous)] : ["questions"],
    frame: round.frame,
    persona: round.persona,
    maxMinutes: round.minutes,
    scratchpad: round.scratchpad,
    task: (ctx) =>
      [briefing(ctx), round.conduct, roundQuestions(ctx, round), panelNotes(ctx, earlier)]
        .filter(Boolean)
        .join("\n\n"),
  };
}

function roundReport(round: InterviewRound): ReportPhase {
  return {
    kind: "report",
    id: reportId(round),
    title: `${round.title} report`,
    intro: "Scored debrief notes for each run of this round. Scoring one opens the next round.",
    source: callId(round),
    after: [callId(round)],
    rubric: round.rubric,
    system: `You are the interviewer of the ${round.title.toLowerCase()} in an interview loop, writing honest, specific debrief notes. Score strictly: 3 is a typical hire-bar performance, 5 is exceptional. Quote or reference specific moments. The transcript is machine-transcribed, so ignore small transcription errors.`,
    background: (ctx) => `${background(ctx)}\n\nThis was the ${round.title} of the loop.`,
    guidance: FINDINGS_GUIDANCE,
  };
}

function debrief(rounds: InterviewRound[], last: InterviewRound): Phase {
  return generatePhase<Debrief>({
    kind: "generate",
    id: "debrief",
    title: "Debrief",
    intro: "The hiring committee's call across all rounds, and what to fix before the real loop.",
    role: "score",
    after: [reportId(last)],
    system:
      "You are the hiring committee for this role, deciding after a full interview loop. Be honest and calibrated, like a real committee: one weak round can sink an otherwise good loop, and when it does, say so.",
    schema: debriefSchema,
    prompt: (ctx) =>
      `${background(ctx)}

The interviewers' notes from each round (their latest run):
${rounds.map((r) => roundNotes(ctx, r)).join("\n\n")}

For each round give its title, a verdict and a one-sentence reason. Then the overall verdict with a two-sentence reason, and the 3 things that would most improve the outcome before the real loop, each one concrete.`,
    items: (d) => [
      ...d.rounds.map((r) => ({ label: r.round, text: r.verdict, detail: r.reason })),
      { label: "Overall", text: d.verdict, detail: d.reason },
      ...d.fixes.map((fix, i) => ({ label: `Fix ${i + 1}`, text: fix })),
    ],
  });
}

function roundQuestions(ctx: PhaseContext, round: InterviewRound): string {
  const questions = bankOf(ctx).filter((q) => q.round === round.id);
  if (questions.length === 0) return "Choose questions that fit this round and the role.";
  return `Questions for this round, with likely follow-ups:\n${questions
    .map((q) => `- ${q.question} (follow-ups: ${q.followUps.join(" / ")})`)
    .join("\n")}`;
}

/** What earlier interviewers wrote down, so later ones probe the weak spots like a real panel. */
function panelNotes(ctx: PhaseContext, earlier: InterviewRound[]): string {
  const notes = earlier.flatMap((r) => {
    const report = latestReport(ctx, r);
    if (!report) return [];
    const weak = focusHabits(report);
    return [
      `- ${r.title} (${report.overall.toFixed(1)}/5): ${report.summary}${weak ? ` Weak spots: ${weak}.` : ""}`,
    ];
  });
  if (notes.length === 0) return "";
  return `Debrief notes from earlier rounds of this loop. Don't mention them; use them to probe where the candidate was weak:\n${notes.join("\n")}`;
}

function roundNotes(ctx: PhaseContext, round: InterviewRound): string {
  const report = latestReport(ctx, round);
  if (!report) return `${round.title}: not scored.`;
  const scores = report.scores.map((s) => `${s.criterion} ${s.score}/5`).join(", ");
  const weak = focusHabits(report);
  return [
    `${round.title}: ${report.overall.toFixed(1)}/5${scores ? ` (${scores})` : ""}`,
    report.summary,
    report.strengths.length ? `Strengths: ${report.strengths.join("; ")}` : "",
    weak ? `Weak spots: ${weak}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function latestReport(ctx: PhaseContext, round: InterviewRound): Report | undefined {
  const reports = Object.values(ctx.artifact<ReportArtifact>(reportId(round)) ?? {});
  return reports.sort((a, b) => b.runAt.localeCompare(a.runAt))[0];
}

function focusHabits(report: Report): string {
  const focus = new Set(report.focus ?? []);
  return (report.findings ?? [])
    .filter((f) => focus.has(f.id))
    .map((f) => f.habit)
    .join("; ");
}

function callId(round: InterviewRound): string {
  return `round-${round.id}`;
}

function reportId(round: InterviewRound): string {
  return `round-${round.id}-report`;
}

function bankOf(ctx: PhaseContext): Question[] {
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
