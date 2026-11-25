import type { TextRole } from "@shared/text";
import { z } from "zod";

/** Asks the configured text provider for JSON matching `schema`, validated on arrival. */
export async function askStructured<T>(
  role: TextRole,
  system: string,
  prompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
  const reply = await window.greenroom.text.complete({ role, system, prompt, schema: jsonSchema });
  const parsed = schema.safeParse(typeof reply === "string" ? safeJson(reply) : reply);
  if (!parsed.success)
    throw new Error("The model's answer didn't have the expected shape. Try again.");
  return parsed.data;
}

export async function askText(role: TextRole, system: string, prompt: string): Promise<string> {
  return String(await window.greenroom.text.complete({ role, system, prompt })).trim();
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
