import { z } from "zod";
import { TEXT_PROVIDERS } from "./text";

export const INTERVIEWER_STYLES = ["friendly", "neutral", "tough"] as const;
export const INTERRUPTION_LEVELS = ["none", "some", "frequent"] as const;
export const SENIORITY_LEVELS = ["junior", "mid", "senior", "staff", "principal"] as const;
export const SPEAKING_PACES = ["slow", "normal", "fast"] as const;
export const COMPANY_STYLE_SUGGESTIONS = ["general", "faang", "startup", "enterprise", "agency"];
export const REALTIME_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "marin",
  "sage",
  "shimmer",
  "verse",
] as const;
export const REALTIME_MODEL_SUGGESTIONS = ["gpt-realtime-2.1", "gpt-realtime-2.1-mini"];

const DEFAULT_PRESETS = [
  {
    id: "neutral",
    name: "Neutral",
    style: "neutral",
    interruptions: "some",
    followUpDepth: 1,
    seniority: "senior",
    companyStyle: "general",
    voice: "marin",
    language: "English",
    pace: "normal",
  },
  {
    id: "faang-tough",
    name: "FAANG tough",
    style: "tough",
    interruptions: "frequent",
    followUpDepth: 3,
    seniority: "senior",
    companyStyle: "faang",
    voice: "cedar",
    language: "English",
    pace: "fast",
  },
  {
    id: "startup-friendly",
    name: "Startup friendly",
    style: "friendly",
    interruptions: "none",
    followUpDepth: 1,
    seniority: "senior",
    companyStyle: "startup",
    voice: "coral",
    language: "English",
    pace: "normal",
  },
] as const satisfies readonly Persona[];

const personaSchema = z.object({
  id: z
    .string()
    .min(1)
    .catch(() => crypto.randomUUID()),
  name: z.string().min(1).catch("Untitled"),
  style: z.enum(INTERVIEWER_STYLES).catch("neutral"),
  interruptions: z.enum(INTERRUPTION_LEVELS).catch("some"),
  followUpDepth: z.number().int().min(0).max(3).catch(1),
  seniority: z.enum(SENIORITY_LEVELS).catch("senior"),
  companyStyle: z.string().min(1).catch("general"),
  voice: z.string().min(1).catch("marin"),
  language: z.string().min(1).catch("English"),
  pace: z.enum(SPEAKING_PACES).catch("normal"),
});

const settingsSchema = z.object({
  version: z.literal(1).catch(1),
  interviewer: section({
    activePresetId: z.string().catch(DEFAULT_PRESETS[0].id),
    presets: z
      .array(personaSchema)
      .min(1)
      .catch(() => structuredClone(DEFAULT_PRESETS) as unknown as Persona[]),
  }),
  models: section({
    drill: z.string().min(1).catch("gpt-realtime-2.1-mini"),
    mock: z.string().min(1).catch("gpt-realtime-2.1"),
    generate: z.string().min(1).catch("claude-haiku-5-5"),
    score: z.string().min(1).catch("claude-sonnet-5-5"),
  }),
  text: section({
    provider: z.enum(TEXT_PROVIDERS).catch("anthropic"),
  }),
  sync: section({
    url: z.string().catch(""),
    publishableKey: z.string().catch(""),
  }),
  limits: section({
    drillMaxMinutes: z.number().positive().max(120).catch(5),
    mockMaxMinutes: z.number().positive().max(180).catch(30),
    monthlyBudgetUsd: z.number().nonnegative().catch(20),
    showCostMeter: z.boolean().catch(true),
  }),
  audio: section({
    inputDeviceId: z.string().catch("default"),
    outputDeviceId: z.string().catch("default"),
    recordSessions: z.boolean().catch(true),
  }),
});

export type Persona = z.infer<typeof personaSchema>;
export type Settings = z.infer<typeof settingsSchema>;

/** Never throws: invalid or missing fields fall back to their defaults individually. */
export function parseSettings(raw: unknown): Settings {
  return settingsSchema.parse(isObject(raw) ? raw : {});
}

export function defaultSettings(): Settings {
  return parseSettings({});
}

export function activePersona(settings: Settings): Persona {
  const { presets, activePresetId } = settings.interviewer;
  return presets.find((p) => p.id === activePresetId) ?? (presets[0] as Persona);
}

export function newPersona(base: Persona): Persona {
  return { ...base, id: crypto.randomUUID(), name: `${base.name} copy` };
}

function section<T extends z.ZodRawShape>(shape: T) {
  const schema = z.object(shape);
  return schema.prefault({} as z.input<typeof schema>).catch(() => schema.parse({}));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
