import { estimateSessionCostUsd } from "@shared/billing";
import { REALTIME_MODEL_SUGGESTIONS, type Settings } from "@shared/settings";
import { TEXT_PROVIDER_INFO } from "@shared/text";
import { Field, NumberInput, SuggestInput, Toggle } from "../components/fields";
import { formatUsd } from "../text";
import type { UpdateSettings } from "./SettingsPage";
import { TextProviderPicker } from "./TextProviderPicker";

type ModelKey = keyof Settings["models"];
type LimitKey = keyof Settings["limits"];

/** The longest session the bars can show; matches the mock limit's maximum. */
const BAR_SCALE_MINUTES = 180;

const MODEL_FIELDS: { key: ModelKey; label: string; hint: string; voice: boolean }[] = [
  { key: "drill", label: "Drill voice model", hint: "Single-question practice", voice: true },
  { key: "mock", label: "Mock voice model", hint: "Full interview", voice: true },
  {
    key: "generate",
    label: "Generation model",
    hint: "Question banks and card feedback",
    voice: false,
  },
  { key: "score", label: "Scoring model", hint: "The report after a session", voice: false },
];

export function ModelsTab({ settings, update }: { settings: Settings; update: UpdateSettings }) {
  const setModel = (key: ModelKey, value: string) =>
    update((s) => ({ ...s, models: { ...s.models, [key]: value } }));
  const setLimit = (key: LimitKey, value: number | boolean) =>
    update((s) => ({ ...s, limits: { ...s.limits, [key]: value } }));

  return (
    <div className="stack wide">
      <section className="stack">
        <h2 className="section-title">Running time</h2>
        <p className="lede">Voice sessions end on their own at these limits.</p>
        <div className="limits">
          <SessionLimit
            label="Drill"
            minutes={settings.limits.drillMaxMinutes}
            max={120}
            model={settings.models.drill}
            onChange={(v) => setLimit("drillMaxMinutes", v)}
          />
          <SessionLimit
            label="Mock interview"
            minutes={settings.limits.mockMaxMinutes}
            max={180}
            model={settings.models.mock}
            onChange={(v) => setLimit("mockMaxMinutes", v)}
          />
        </div>
        <div className="grid-2">
          <Field label="Monthly budget, USD" hint="Warns at 80%, stops new voice sessions at 100%">
            {(id) => (
              <NumberInput
                id={id}
                min={0}
                max={10_000}
                value={settings.limits.monthlyBudgetUsd}
                onChange={(v) => setLimit("monthlyBudgetUsd", v)}
              />
            )}
          </Field>
        </div>
        <Toggle
          label="Show the running cost during voice sessions"
          checked={settings.limits.showCostMeter}
          onChange={(v) => setLimit("showCostMeter", v)}
        />
      </section>

      <TextProviderPicker settings={settings} update={update} />

      <section className="stack">
        <h2 className="section-title">Models</h2>
        <div className="grid-2">
          {MODEL_FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {(id) => (
                <SuggestInput
                  id={id}
                  value={settings.models[f.key]}
                  suggestions={
                    f.voice
                      ? REALTIME_MODEL_SUGGESTIONS
                      : TEXT_PROVIDER_INFO[settings.text.provider].suggestions
                  }
                  onChange={(v) => setModel(f.key, v)}
                />
              )}
            </Field>
          ))}
        </div>
      </section>
    </div>
  );
}

function SessionLimit({
  label,
  minutes,
  max,
  model,
  onChange,
}: {
  label: string;
  minutes: number;
  max: number;
  model: string;
  onChange: (minutes: number) => void;
}) {
  const cost = estimateSessionCostUsd(model, minutes);
  const inputId = `limit-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="limit">
      <label htmlFor={inputId} className="limit-label">
        {label}
      </label>
      <div className="limit-bar" aria-hidden="true">
        <span
          style={{ width: `${(Math.min(minutes, BAR_SCALE_MINUTES) / BAR_SCALE_MINUTES) * 100}%` }}
        />
      </div>
      <div className="limit-input">
        <NumberInput id={inputId} min={1} max={max} value={minutes} onChange={onChange} />
        <span className="unit">min</span>
      </div>
      <span className="limit-cost">
        {cost === null ? "No price data" : `about ${formatUsd(cost)} max`}
      </span>
    </div>
  );
}
