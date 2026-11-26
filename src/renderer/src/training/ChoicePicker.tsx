import {
  type Choice,
  CUSTOM_CHOICE,
  type PhaseContext,
  RANDOM_CHOICE,
  type VoicePhase,
} from "@shared/training";
import { useEffect, useState } from "react";
import { z } from "zod";
import { askStructured } from "./ask";

const RandomTopic = z.object({ topic: z.string().min(1) });

type Generated =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; label: string }
  | { status: "failed"; error: string };

/** The pick before a voice phase: listed choices plus optional generated and typed ones. */
export function ChoicePicker({
  phase,
  ctx,
  pastLabels,
  disabled,
  onChange,
}: {
  phase: VoicePhase;
  ctx: PhaseContext;
  /** Labels of earlier runs, so a generated choice doesn't repeat them. */
  pastLabels: string[];
  disabled: boolean;
  /** The usable choice, or null while a typed or generated one isn't there yet. */
  onChange: (choice: Choice | null) => void;
}) {
  const listed = phase.choices?.(ctx) ?? [];
  const [picked, setPicked] = useState<string | null>(listed[0]?.id ?? null);
  const [custom, setCustom] = useState("");
  const [generated, setGenerated] = useState<Generated>({ status: "idle" });
  const { randomChoice, customChoice } = phase;
  const optionCount = listed.length + (randomChoice ? 1 : 0) + (customChoice ? 1 : 0);

  const selected = selectedChoice(picked, listed, custom, generated);
  const selectedKey = selected ? `${selected.id}\n${selected.label}` : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: report only when the choice changes
  useEffect(() => onChange(selected), [selectedKey]);

  const generate = async () => {
    if (!randomChoice) return;
    const avoid = generated.status === "ready" ? [...pastLabels, generated.label] : pastLabels;
    setGenerated({ status: "loading" });
    try {
      const { topic } = await askStructured(
        "generate",
        randomChoice.system,
        randomChoice.prompt(ctx, avoid),
        RandomTopic,
      );
      setGenerated({ status: "ready", label: topic.trim() });
    } catch (e) {
      setGenerated({ status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const pickRandom = () => {
    setPicked(RANDOM_CHOICE);
    if (generated.status !== "ready" && generated.status !== "loading") void generate();
  };

  if (optionCount === 0) return null;
  return (
    <fieldset
      className={optionCount > 5 ? "choice-list scroll" : "choice-list"}
      disabled={disabled}
    >
      <legend className="label">Pick one</legend>
      {randomChoice && (
        <Option name={phase.id} checked={picked === RANDOM_CHOICE} onPick={pickRandom}>
          <span className="choice-label">{randomChoice.label}</span>
          {picked === RANDOM_CHOICE && (
            <span className="choice-detail">
              <GeneratedTopic generated={generated} />
              {generated.status !== "loading" && (
                <button type="button" className="link" onClick={() => void generate()}>
                  {generated.status === "failed" ? "Try again" : "Another one"}
                </button>
              )}
            </span>
          )}
        </Option>
      )}
      {customChoice && (
        <Option
          name={phase.id}
          checked={picked === CUSTOM_CHOICE}
          onPick={() => setPicked(CUSTOM_CHOICE)}
        >
          <span className="choice-label">{customChoice.label}</span>
          {picked === CUSTOM_CHOICE && (
            <input
              type="text"
              className="choice-input"
              // biome-ignore lint/a11y/noAutofocus: the field appears because the user just picked it
              autoFocus
              value={custom}
              placeholder={customChoice.placeholder}
              aria-label={customChoice.label}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
        </Option>
      )}
      {listed.map((c) => (
        <Option key={c.id} name={phase.id} checked={picked === c.id} onPick={() => setPicked(c.id)}>
          <span>{c.label}</span>
        </Option>
      ))}
    </fieldset>
  );
}

function selectedChoice(
  picked: string | null,
  listed: Choice[],
  custom: string,
  generated: Generated,
): Choice | null {
  if (picked === CUSTOM_CHOICE) {
    const label = custom.trim();
    return label ? { id: CUSTOM_CHOICE, label } : null;
  }
  if (picked === RANDOM_CHOICE)
    return generated.status === "ready" ? { id: RANDOM_CHOICE, label: generated.label } : null;
  return listed.find((c) => c.id === picked) ?? null;
}

function GeneratedTopic({ generated }: { generated: Generated }) {
  switch (generated.status) {
    case "loading":
      return <span className="muted">Thinking of a topic…</span>;
    case "ready":
      return <span className="generated-topic">{generated.label}</span>;
    case "failed":
      return (
        <span className="warn-text" role="alert">
          {generated.error}
        </span>
      );
    default:
      return null;
  }
}

function Option({
  name,
  checked,
  onPick,
  children,
}: {
  name: string;
  checked: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className={checked ? "choice active" : "choice"}>
      <input type="radio" name={`choice-${name}`} checked={checked} onChange={onPick} />
      <span className="choice-body">{children}</span>
    </label>
  );
}
