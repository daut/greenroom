import type { RubricCriterion } from "../report";
import type { FormArtifact, PhaseContext, TrainingDefinition } from "../training";

const TOPICS = [
  { id: "work", label: "Your work and a recent project" },
  { id: "opinion", label: "Defend an opinion on a tech trend" },
  { id: "story", label: "Tell a story about a mistake you learned from" },
  { id: "explain", label: "Explain a technical idea to a non-engineer" },
  { id: "smalltalk", label: "Small talk before a meeting" },
];

const RUBRIC: RubricCriterion[] = [
  {
    id: "fluency",
    label: "Fluency",
    description: "Speaks in connected sentences without long hesitations or restarts.",
  },
  {
    id: "grammar",
    label: "Grammar",
    description: "Tenses, articles, prepositions and word order are correct.",
  },
  {
    id: "vocabulary",
    label: "Vocabulary",
    description: "Precise, varied, natural word choice and idiom.",
  },
  {
    id: "coherence",
    label: "Coherence",
    description: "Ideas are linked clearly with appropriate connectors.",
  },
];

export const englishTraining: TrainingDefinition = {
  id: "english",
  title: "English conversation",
  summary:
    "Short spoken conversations on topics you pick, with corrections on grammar, vocabulary and fluency afterwards.",
  sessionTitle: (ctx) => {
    const level = ctx.artifact<FormArtifact>("setup")?.level;
    return level ? `English practice (${level})` : undefined;
  },
  phases: [
    {
      kind: "form",
      id: "setup",
      title: "Your goals",
      fields: [
        {
          id: "level",
          label: "Your level",
          kind: "text",
          required: true,
          placeholder: "B2, upper intermediate",
        },
        {
          id: "focus",
          label: "What to work on",
          kind: "longtext",
          placeholder: "Articles, past tenses, sounding less formal in meetings…",
        },
      ],
    },
    {
      kind: "voice",
      id: "conversation",
      title: "Conversation",
      intro: "A five-minute conversation on the topic you pick. Uses the drill voice model.",
      session: "drill",
      frame:
        "You are a friendly English conversation partner for a non-native professional. The user is practising spoken English.",
      choices: () => TOPICS,
      task: (ctx, choiceId) => {
        const topic = TOPICS.find((t) => t.id === choiceId) ?? TOPICS[0];
        return `${goals(ctx)}
Topic: ${topic?.label}. Open the topic with one question, then keep a natural conversation going with short turns and follow-up questions that make the user speak more than you. Use English only, at a level slightly above theirs. Don't correct mistakes during the conversation. After about five minutes, close warmly and end the session.`;
      },
    },
    {
      kind: "report",
      id: "report",
      title: "Corrections",
      intro: "Scores plus the specific mistakes to fix, quoted from what you said.",
      source: "conversation",
      rubric: RUBRIC,
      system:
        "You are an English teacher reviewing a spoken conversation by a non-native professional. Be specific and kind. The transcript is machine-transcribed, so it may already have smoothed some errors; judge what is there.",
      prompt: (ctx, transcript, rubric) =>
        `${goals(ctx)}

Score the learner (the "Candidate") on each criterion from 1 to 5 with a short comment:
${rubric}

Then a 2-sentence summary. As strengths, give up to 3 things they did well. As improvements, give up to 5 corrections in the form: "You said: … → Better: …", choosing the most useful.

Transcript:
${transcript}`,
    },
  ],
};

function goals(ctx: PhaseContext): string {
  const s = ctx.artifact<FormArtifact>("setup") ?? {};
  return `Learner level: ${s.level ?? "unknown"}.${s.focus ? ` They want to work on: ${s.focus}.` : ""}`;
}
