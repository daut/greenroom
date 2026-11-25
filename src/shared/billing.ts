import type { Persona } from "./settings";

/** Rough $/min for a realtime session (user ~60% / model ~40% talk, history caching). */
const REALTIME_USD_PER_MINUTE: Record<string, number> = {
  "gpt-realtime-2.1": 0.08,
  "gpt-realtime-2": 0.08,
  "gpt-realtime-2.1-mini": 0.03,
  "gpt-realtime-mini": 0.03,
};

const COMPANY_LABELS: Record<string, string> = {
  faang: "FAANG-style",
};

const INTERRUPTIONS: Record<Persona["interruptions"], string> = {
  none: "Lets you finish",
  some: "Cuts in now and then",
  frequent: "Interrupts often",
};

const FOLLOW_UPS = [
  "moves on without follow-ups",
  "asks one follow-up",
  "digs two follow-ups deep",
  "digs three follow-ups deep",
];

/** The persona as one programme-style billing line, e.g. "A tough interviewer at …". */
export function describePersona(persona: Persona): string {
  const company = companyClause(persona.companyStyle);
  const who = `A ${persona.style} interviewer${company} hiring for ${persona.seniority} roles.`;
  const followUps = FOLLOW_UPS[persona.followUpDepth] ?? FOLLOW_UPS[1];
  const how = `${INTERRUPTIONS[persona.interruptions]} and ${followUps}.`;
  const voice = `Speaks ${persona.language} at a ${persona.pace} pace.`;
  return `${who} ${how} ${voice}`;
}

export function estimateSessionCostUsd(model: string, minutes: number): number | null {
  const rate = REALTIME_USD_PER_MINUTE[model];
  return rate === undefined ? null : rate * minutes;
}

function companyClause(companyStyle: string): string {
  const style = companyStyle.trim();
  if (!style || style.toLowerCase() === "general") return "";
  return ` at a ${COMPANY_LABELS[style.toLowerCase()] ?? style} company,`;
}
