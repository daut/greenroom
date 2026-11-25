import { describePersona } from "@shared/billing";
import {
  activePersona,
  COMPANY_STYLE_SUGGESTIONS,
  INTERRUPTION_LEVELS,
  INTERVIEWER_STYLES,
  newPersona,
  type Persona,
  REALTIME_VOICES,
  SENIORITY_LEVELS,
  type Settings,
  SPEAKING_PACES,
} from "@shared/settings";
import { useState } from "react";
import { Field, Segmented, SuggestInput } from "../components/fields";
import { capitalize, errorMessage } from "../text";
import { previewVoice } from "../voice/previewVoice";
import type { UpdateSettings } from "./SettingsPage";

const FOLLOW_UP_DEPTHS = ["0", "1", "2", "3"] as const;
const LANGUAGE_SUGGESTIONS = ["English", "German", "French", "Spanish", "Bosnian"];

export function InterviewerTab({
  settings,
  update,
}: {
  settings: Settings;
  update: UpdateSettings;
}) {
  const { presets } = settings.interviewer;
  const persona = activePersona(settings);

  const select = (id: string) =>
    update((s) => ({ ...s, interviewer: { ...s.interviewer, activePresetId: id } }));

  const edit = (patch: Partial<Persona>) =>
    update((s) => ({
      ...s,
      interviewer: {
        ...s.interviewer,
        presets: s.interviewer.presets.map((p) => (p.id === persona.id ? { ...p, ...patch } : p)),
      },
    }));

  const duplicate = () => {
    const copy = newPersona(persona);
    update((s) => ({
      ...s,
      interviewer: { activePresetId: copy.id, presets: [...s.interviewer.presets, copy] },
    }));
  };

  const remove = () =>
    update((s) => {
      const remaining = s.interviewer.presets.filter((p) => p.id !== persona.id);
      return {
        ...s,
        interviewer: { activePresetId: remaining[0]?.id ?? "", presets: remaining },
      };
    });

  return (
    <div className="split">
      <aside className="cast" aria-label="Interviewer presets">
        <h2>Cast</h2>
        <ul>
          {presets.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="cast-item"
                aria-pressed={p.id === persona.id}
                onClick={() => select(p.id)}
              >
                <span className="cast-name">{p.name}</span>
                <span className="leader" aria-hidden="true" />
                <span className="cast-voice">{capitalize(p.voice)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="cast-actions">
          <button type="button" className="btn" onClick={duplicate}>
            Duplicate
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={presets.length < 2}
            onClick={remove}
          >
            Delete
          </button>
        </div>
        <p className="hint">The selected preset interviews you in mock sessions.</p>
      </aside>

      <div className="stack" key={persona.id}>
        <figure className="billing">
          <figcaption className="billing-head">
            <span className="billing-role">{persona.name}</span>
            <span className="leader" aria-hidden="true" />
            <span className="billing-voice">voiced by {capitalize(persona.voice)}</span>
          </figcaption>
          <p className="billing-line" key={describePersona(persona)} aria-live="polite">
            {describePersona(persona)}
          </p>
        </figure>
        <Field label="Preset name">
          {(id) => (
            <input
              id={id}
              value={persona.name}
              onChange={(e) => edit({ name: e.target.value || "Untitled" })}
            />
          )}
        </Field>
        <div className="controls-grid">
          <Segmented
            label="Tone"
            options={INTERVIEWER_STYLES}
            value={persona.style}
            onChange={(style) => edit({ style })}
          />
          <Segmented
            label="Interruptions"
            options={INTERRUPTION_LEVELS}
            value={persona.interruptions}
            onChange={(interruptions) => edit({ interruptions })}
          />
          <Segmented
            label="Follow-up depth"
            options={FOLLOW_UP_DEPTHS}
            value={String(persona.followUpDepth) as (typeof FOLLOW_UP_DEPTHS)[number]}
            onChange={(depth) => edit({ followUpDepth: Number(depth) })}
          />
          <Segmented
            label="Speaking pace"
            options={SPEAKING_PACES}
            value={persona.pace}
            onChange={(pace) => edit({ pace })}
          />
        </div>
        <Segmented
          label="Target seniority"
          options={SENIORITY_LEVELS}
          value={persona.seniority}
          onChange={(seniority) => edit({ seniority })}
        />
        <Field
          label="Company style"
          hint="Pick one or describe it, e.g. 'fintech, very process-heavy'"
        >
          {(id) => (
            <SuggestInput
              id={id}
              value={persona.companyStyle}
              suggestions={COMPANY_STYLE_SUGGESTIONS}
              onChange={(companyStyle) => edit({ companyStyle })}
            />
          )}
        </Field>
        <div className="grid-2">
          <Field label="Voice">
            {(id) => (
              <select
                id={id}
                value={persona.voice}
                onChange={(e) => edit({ voice: e.target.value })}
              >
                {REALTIME_VOICES.map((v) => (
                  <option key={v} value={v}>
                    {capitalize(v)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <VoicePreview voice={persona.voice} />
          <Field label="Language">
            {(id) => (
              <SuggestInput
                id={id}
                value={persona.language}
                suggestions={LANGUAGE_SUGGESTIONS}
                onChange={(language) => edit({ language })}
              />
            )}
          </Field>
        </div>
      </div>
    </div>
  );
}

function VoicePreview({ voice }: { voice: string }) {
  const [state, setState] = useState<"idle" | "playing" | string>("idle");

  const play = async () => {
    setState("playing");
    try {
      await previewVoice(voice, `Hi, I'm ${capitalize(voice)}. Thanks for coming in today.`);
      setState("idle");
    } catch (e) {
      setState(errorMessage(e));
    }
  };

  return (
    <div className="field preview">
      <span className="label">Hear it</span>
      <button type="button" className="btn" disabled={state === "playing"} onClick={play}>
        {state === "playing" ? "Playing" : `Play ${capitalize(voice)}`}
      </button>
      {state !== "idle" && state !== "playing" && <span className="warn-text">{state}</span>}
      <span className="hint">A few seconds of the drill model, under a cent.</span>
    </div>
  );
}
