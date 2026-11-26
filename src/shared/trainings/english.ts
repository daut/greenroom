import type { RubricCriterion } from "../report";
import type { Choice, FormArtifact, PhaseContext, TrainingDefinition } from "../training";

const TOPICS: Choice[] = [
  { id: "work", label: "Your work and a recent project" },
  { id: "opinion", label: "Defend an opinion on a tech trend" },
  { id: "story", label: "Tell a story about a mistake you learned from" },
  { id: "explain", label: "Explain a technical idea to a non-engineer" },
  { id: "smalltalk", label: "Small talk before a meeting" },
  { id: "weekend", label: "What you did last weekend" },
  { id: "hometown", label: "Show a visitor around your hometown" },
  { id: "travel", label: "The best and worst trip you've taken" },
  { id: "food", label: "A dish you'd cook for guests, and how" },
  { id: "media", label: "A book, film or series you'd recommend" },
  { id: "hobby", label: "A hobby you'd like to pick up, and why" },
  { id: "remote", label: "Debate: is remote work better than the office?" },
  { id: "ai", label: "Debate: will AI make jobs better or worse?" },
  { id: "lottery", label: "If you won the lottery tomorrow" },
  { id: "timetravel", label: "If you could live in another decade" },
  { id: "return", label: "Role-play: return a faulty product to a shop" },
  { id: "landlord", label: "Role-play: complain to your landlord about a repair" },
  { id: "networking", label: "Role-play: meet a stranger at a conference" },
  { id: "doctor", label: "Role-play: describe symptoms to a doctor" },
  { id: "feedback", label: "Role-play: give a colleague difficult feedback" },
];

/** Steers the model off its few favourite "random" topics. */
const RANDOM_AREAS = [
  "daily life",
  "childhood memories",
  "travel and places",
  "food and cooking",
  "sports and health",
  "money and shopping",
  "nature and the environment",
  "science and the future",
  "culture and traditions",
  "a hypothetical 'what if' question",
  "a light-hearted debate",
  "a role-play of an everyday situation",
  "a role-play of a tricky situation at work",
  "a moral dilemma",
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
  {
    id: "pronunciation",
    label: "Pronunciation",
    description:
      "Sounds, word stress and endings are clear enough that a listener never has to guess. Scored from the recording.",
    fromAudio: true,
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
          carryHabits: true,
          hint: "Habits still open from earlier sessions are filled in for you.",
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
      randomChoice: {
        label: "Surprise me",
        system:
          "You suggest topics for spoken English practice. Reply with one topic, written as a short instruction or question of at most 12 words, like the examples.",
        prompt: (ctx, pastLabels) => `${goals(ctx)}
Area: ${pick(RANDOM_AREAS)}.
Examples of the style: ${TOPICS.slice(0, 3)
          .map((t) => `"${t.label}"`)
          .join(", ")}.
${pastLabels.length > 0 ? `Don't repeat or closely echo these earlier topics: ${pastLabels.map((l) => `"${l}"`).join(", ")}.` : ""}
Pick something that gives a learner at this level plenty to say.`,
      },
      customChoice: {
        label: "Your own topic",
        placeholder: "Anything you'd like to talk about",
      },
      task: (ctx, choice) => {
        const topic = choice?.label ?? TOPICS[0]?.label;
        return `${goals(ctx)}
Topic: ${topic}. If the topic is a role-play, set the scene in one sentence and play the other person. Open the topic with one question, then keep a natural conversation going with short turns and follow-up questions that make the user speak more than you. Use English only, at a level slightly above theirs. Don't correct mistakes during the conversation. After about five minutes, close warmly and end the session.`;
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
      background: goals,
      guidance: `What to look for:
- Corrections: grammar (tenses, agreement, articles, prepositions, question forms, parallel verb forms) and word choice. Quote the exact words; "better" is how a fluent speaker would say it; "why" names the rule in plain words.
- Habits: patterns in how they speak, such as repeating the question to buy time, a filler they lean on, trailing endings like "so yeah", or a structure they always avoid. "better" is a concrete alternative phrase they can use.
- Content only when it hurt the conversation, e.g. an answer with no specifics.
If the learner said they want to work on something, check that first. Skip slips that look like transcription errors.`,
    },
    {
      kind: "drills",
      id: "practice",
      title: "Practice",
      intro:
        "Drill the corrections and habits from your reports, plus any still open from earlier sessions: typed reps, then say it out loud.",
    },
  ],
};

function goals(ctx: PhaseContext): string {
  const s = ctx.artifact<FormArtifact>("setup") ?? {};
  return `Learner level: ${s.level ?? "unknown"}.${s.focus ? ` They want to work on: ${s.focus}.` : ""}`;
}

function pick<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}
