import type { VoiceSessionKind } from "@shared/api";
import { estimateSessionCostUsd } from "@shared/billing";
import { activePersona, type Settings } from "@shared/settings";
import { capitalize, formatUsd } from "../text";

/** Who you'll face and what the session can cost, before you start. */
export function SessionBilling({
  settings,
  kind,
  maxMinutes,
}: {
  settings: Settings;
  kind: VoiceSessionKind;
  /** A shorter cap than Settings, as passed to the session. */
  maxMinutes?: number;
}) {
  const persona = activePersona(settings);
  const limit = kind === "mock" ? settings.limits.mockMaxMinutes : settings.limits.drillMaxMinutes;
  const minutes = maxMinutes ? Math.min(maxMinutes, limit) : limit;
  const cost = estimateSessionCostUsd(settings.models[kind], minutes);
  return (
    <div className="stack tight">
      <div className="cast-line">
        <span>Opposite you</span>
        <span className="leader" aria-hidden="true" />
        <span>
          {persona.name}, voiced by {capitalize(persona.voice)}
        </span>
      </div>
      <div className="cast-line">
        <span>Running time</span>
        <span className="leader" aria-hidden="true" />
        <span>
          about {minutes} min, then a natural close
          {cost === null ? "" : `, about ${formatUsd(cost)}`}
        </span>
      </div>
    </div>
  );
}
