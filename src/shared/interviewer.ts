import { describePersona } from "./billing";
import type { Persona } from "./settings";

const TONE: Record<Persona["style"], string> = {
  friendly: "Warm and encouraging, but still asks real questions.",
  neutral: "Professional and even. Neither warm nor cold.",
  tough: "Skeptical and direct. Push back on vague answers and ask for specifics and numbers.",
};

const INTERRUPTIONS: Record<Persona["interruptions"], string> = {
  none: "Never interrupt. Wait until the candidate has clearly finished.",
  some: "If an answer rambles past about two minutes, politely steer it back.",
  frequent: "Cut in when an answer drifts or stays abstract, as a busy interviewer would.",
};

/** System instructions for the realtime interviewer voice. */
const INTERVIEW_FRAME =
  "You are the interviewer in a spoken job-interview rehearsal. The user is the candidate.";

const NO_COACHING = "Do not coach, grade, or give feedback during the session. Stay in character.";
const COACHING =
  "You are coaching: explain, correct and encourage as the task says, briefly and kindly. Speak slowly enough for a learner.";
const ONE_TURN =
  "Say one message per turn, then stop and wait for the user to answer. Never speak for the user or react to an answer they haven't given.";

export function interviewerInstructions(
  persona: Persona,
  task: string,
  frame: string = INTERVIEW_FRAME,
  { coach = false } = {},
): string {
  return [
    frame,
    ...(coach ? coachingStyle(persona) : interviewerStyle(persona)),
    "If the user cut you off, pick up naturally from what they said; don't restate your whole question.",
    "If the user repeats or rephrases a request you just answered, build on your last answer instead of giving it again.",
    `Task: ${task}`,
    "When the task is complete, say one short closing sentence, then call end_session in that same response. Never call it earlier.",
    "Saying goodbye without calling end_session leaves the user stuck in the session, so always make the call after your closing sentence.",
  ].join("\n");
}

function interviewerStyle(persona: Persona): string[] {
  return [
    `Persona: ${describePersona(persona)}`,
    `Tone: ${TONE[persona.style]}`,
    `Turn-taking: ${INTERRUPTIONS[persona.interruptions]}`,
    `Speak only ${persona.language}. Keep each turn short, like a real interviewer: one question at a time.`,
    NO_COACHING,
  ];
}

/** A coach isn't the interviewer: only the persona's language carries over. */
function coachingStyle(persona: Persona): string[] {
  return [`Speak only ${persona.language}. Keep each turn short.`, COACHING, ONE_TURN];
}

/** What the voice reads when the user shares their scratchpad mid-call. */
export function sharedScratchpad(text: string): string {
  return `(The candidate shared their scratchpad. This is all of it as of now; earlier versions are out of date.)\n${text.trim() || "(empty)"}`;
}
