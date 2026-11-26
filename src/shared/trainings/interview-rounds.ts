import { UNDERSTANDABILITY } from "../pronunciation";
import type { RubricCriterion } from "../report";
import type { PersonaOverride } from "../settings";
import type { VoicePhase } from "../training";

/** One round of an interview loop: who interviews, what they ask, how it's scored. */
export interface InterviewRound {
  id: string;
  title: string;
  /** Shown when picking rounds. */
  detail: string;
  /** Who the voice plays. */
  frame: string;
  persona: PersonaOverride;
  minutes: number;
  /** What the question bank should hold for this round. */
  questions: string;
  /** How the interviewer runs the round. */
  conduct: string;
  rubric: RubricCriterion[];
  scratchpad?: VoicePhase["scratchpad"];
}

export const CRITERIA = {
  structure: {
    id: "structure",
    label: "Structure",
    description:
      "Answers follow a clear arc (e.g. situation, task, action, result) and get to the point.",
  },
  specificity: {
    id: "specificity",
    label: "Specifics and impact",
    description:
      "Concrete examples, the candidate's own decisions, numbers and outcomes rather than generalities.",
  },
  relevance: {
    id: "relevance",
    label: "Relevance",
    description: "Answers connect to the role and company in the job description.",
  },
  depth: {
    id: "depth",
    label: "Depth under follow-ups",
    description: "Holds up when pushed: trade-offs, alternatives, what they would change.",
  },
  delivery: {
    id: "delivery",
    label: "Delivery",
    description: "Clear, confident, concise spoken delivery; few fillers; sensible answer length.",
  },
} satisfies Record<string, RubricCriterion>;

const SEES_SCRATCHPAD =
  "You can't see the candidate's screen. When they share their scratchpad it arrives as a message; read it carefully and refer to specific parts.";

/** In the order a loop usually runs. */
export const ROUNDS: InterviewRound[] = [
  {
    id: "recruiter",
    title: "Recruiter screen",
    detail: "Motivation, a quick background pitch, logistics. Friendly and short.",
    frame:
      "You are a recruiter running a first phone screen in a spoken job-interview rehearsal. The user is the candidate.",
    persona: { style: "friendly", interruptions: "none", followUpDepth: 1 },
    minutes: 15,
    questions:
      "3 questions a recruiter asks on a first screen: why this company and role, a short walk-through of their background, and what they're looking for in their next role.",
    conduct:
      "Run a recruiter screen. Introduce yourself and the company in two sentences. Ask for a short background walk-through, then work through the questions below. Ask about their notice period, but don't negotiate salary; if asked, say it comes later in the process. Leave time for their questions about the process, answer briefly in character, and close by explaining the next steps.",
    rubric: [
      {
        id: "motivation",
        label: "Motivation and fit",
        description: "Clear, specific reasons for this company and role, not generic ones.",
      },
      {
        id: "pitch",
        label: "Background pitch",
        description:
          "A concise walk-through of their background, in about two minutes, pointed at this role.",
      },
      CRITERIA.delivery,
      UNDERSTANDABILITY,
    ],
  },
  {
    id: "coding",
    title: "Coding round",
    detail: "Solve a problem out loud. Write code in the scratchpad and share it.",
    frame: `You are a software engineer running a live coding interview in a spoken rehearsal. The user is the candidate. ${SEES_SCRATCHPAD}`,
    persona: { style: "neutral", interruptions: "some", followUpDepth: 2 },
    minutes: 30,
    questions:
      "2 coding problems for a 30-minute live round, matched to the seniority and the languages in the job description: a warm-up and a main problem. State each with its input, output and one example.",
    conduct:
      "Run a live coding round. Introduce yourself in one sentence. Give the first problem below clearly, with its example, and answer clarifying questions. Ask the candidate to talk through their approach and its complexity before coding. While they code, stay quiet unless they ask or are stuck for a long time; then give one small hint. When they share their code, ask about bugs, edge cases, complexity and how they would test it. Move to the next problem only if time allows. Never write the solution for them.",
    rubric: [
      {
        id: "problem-solving",
        label: "Problem solving",
        description:
          "Clarifies the problem, breaks it down, and reaches a workable approach before coding.",
      },
      {
        id: "thinking-aloud",
        label: "Thinking out loud",
        description: "Explains the approach, trade-offs and what they're doing while they code.",
      },
      {
        id: "correctness",
        label: "Correctness",
        description:
          "The code in the scratchpad works and handles edge cases; judge it from the scratchpad.",
      },
      {
        id: "testing",
        label: "Testing and complexity",
        description:
          "Walks through examples and edge cases, and states time and space complexity correctly.",
      },
      UNDERSTANDABILITY,
    ],
    scratchpad: {
      label: "Code",
      placeholder: "Write your solution here. Share it when you want the interviewer to look.",
    },
  },
  {
    id: "design",
    title: "System design",
    detail: "Design a system out loud. Sketch components and numbers in the scratchpad.",
    frame: `You are a senior engineer running a system design interview in a spoken rehearsal. The user is the candidate. ${SEES_SCRATCHPAD}`,
    persona: { style: "tough", interruptions: "some", followUpDepth: 3 },
    minutes: 30,
    questions:
      "1 or 2 system design prompts that fit this company's product and the role's seniority, each stated in one or two sentences, the way an interviewer opens the round.",
    conduct:
      "Run a system design round. Introduce yourself in one sentence and give the first prompt below. Expect the candidate to drive: clarify requirements, estimate scale, propose a high-level design, then go deep. Answer clarifying questions with reasonable assumptions. Push on trade-offs, bottlenecks, failure modes and scaling. Don't design it for them.",
    rubric: [
      {
        id: "requirements",
        label: "Requirements and scale",
        description:
          "Asks the right clarifying questions and estimates load and data before designing.",
      },
      {
        id: "design",
        label: "High-level design",
        description:
          "A coherent set of components, APIs and data model that meets the requirements.",
      },
      {
        id: "tradeoffs",
        label: "Trade-offs",
        description: "Names alternatives and says why they chose one, with its costs.",
      },
      {
        id: "deep-dives",
        label: "Deep dives",
        description: "Holds up when pushed on scaling, bottlenecks, consistency and failure.",
      },
      {
        id: "driving",
        label: "Drives the conversation",
        description: "Leads the design with a clear plan instead of waiting to be asked.",
      },
      UNDERSTANDABILITY,
    ],
    scratchpad: {
      label: "Design notes",
      placeholder: "Requirements, numbers, components, APIs, data model…",
    },
  },
  {
    id: "behavioral",
    title: "Behavioral round",
    detail: "Stories about conflict, failure, leadership and hard calls.",
    frame:
      "You are the interviewer in a spoken job-interview rehearsal, running the behavioral round of an interview loop. The user is the candidate.",
    persona: { style: "neutral", interruptions: "some", followUpDepth: 2 },
    minutes: 30,
    questions:
      "4 behavioral questions aimed at the competencies in the job description and the gaps in the CV: a conflict, a failure, leading or influencing others, and a hard decision.",
    conduct:
      "Run a behavioral round. Introduce yourself in one sentence. Work through the questions below one story at a time, pushing for the candidate's own actions, the result and what they learned. Then close.",
    rubric: [
      CRITERIA.structure,
      CRITERIA.specificity,
      CRITERIA.relevance,
      CRITERIA.depth,
      CRITERIA.delivery,
      UNDERSTANDABILITY,
    ],
  },
  {
    id: "manager",
    title: "Hiring manager",
    detail: "Past impact, ownership, how you work with a team, why this role.",
    frame:
      "You are the hiring manager for this role, interviewing in a spoken job-interview rehearsal. The user is the candidate.",
    persona: { style: "neutral", interruptions: "some", followUpDepth: 2 },
    minutes: 30,
    questions:
      "4 questions a hiring manager asks: impact they owned, a project they led end to end, how they work with a team and handle disagreement, and why this role on this team.",
    conduct:
      "Run a hiring-manager interview. Introduce yourself as the manager and say what the team does in one sentence. Work through the questions below, digging into the candidate's own role, decisions and results. Leave time for their questions about the team and answer briefly in character. Then close.",
    rubric: [
      CRITERIA.specificity,
      {
        id: "ownership",
        label: "Ownership",
        description: "Their own decisions and role are clear, not just what the team did.",
      },
      CRITERIA.relevance,
      CRITERIA.structure,
      CRITERIA.delivery,
      UNDERSTANDABILITY,
    ],
  },
];
