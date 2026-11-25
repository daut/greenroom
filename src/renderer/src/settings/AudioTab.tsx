import type { Settings } from "@shared/settings";
import { useCallback, useEffect, useState } from "react";
import { Field, Toggle } from "../components/fields";
import type { UpdateSettings } from "./SettingsPage";
import { useMicLevel } from "./useMicLevel";

export function AudioTab({ settings, update }: { settings: Settings; update: UpdateSettings }) {
  const { inputs, outputs, labelsHidden, refresh } = useAudioDevices();
  const [testing, setTesting] = useState(false);
  const level = useMicLevel(testing ? settings.audio.inputDeviceId : null);

  const setAudio = (patch: Partial<Settings["audio"]>) =>
    update((s) => ({ ...s, audio: { ...s.audio, ...patch } }));

  const startTest = () => {
    setTesting(true);
    refresh();
  };

  return (
    <div className="stack wide">
      <div className="grid-2">
        <Field label="Microphone">
          {(id) => (
            <DeviceSelect
              id={id}
              devices={inputs}
              value={settings.audio.inputDeviceId}
              onChange={(inputDeviceId) => setAudio({ inputDeviceId })}
            />
          )}
        </Field>
        <Field label="Speaker">
          {(id) => (
            <DeviceSelect
              id={id}
              devices={outputs}
              value={settings.audio.outputDeviceId}
              onChange={(outputDeviceId) => setAudio({ outputDeviceId })}
            />
          )}
        </Field>
      </div>
      {labelsHidden && (
        <p className="hint">Device names appear after microphone access is granted.</p>
      )}

      <div className="mic-test">
        <button
          type="button"
          className={testing ? "btn primary" : "btn"}
          onClick={testing ? () => setTesting(false) : startTest}
        >
          {testing ? "Stop test" : "Test microphone"}
        </button>
        <meter
          className="level"
          aria-label="Microphone level"
          min={0}
          max={1}
          value={Math.max(0, level)}
        />
      </div>
      {level === -1 && (
        <p className="warn-text">
          Microphone access was denied. Allow it in your system privacy settings, then try again.
        </p>
      )}

      <Toggle
        label="Record voice sessions for playback"
        checked={settings.audio.recordSessions}
        onChange={(recordSessions) => setAudio({ recordSessions })}
      />
    </div>
  );
}

function DeviceSelect({
  id,
  devices,
  value,
  onChange,
}: {
  id: string;
  devices: MediaDeviceInfo[];
  value: string;
  onChange: (deviceId: string) => void;
}) {
  const known = devices.some((d) => d.deviceId === value);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="default">System default</option>
      {devices
        .filter((d) => d.deviceId !== "default")
        .map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Device ${i + 1}`}
          </option>
        ))}
      {!known && value !== "default" && <option value={value}>Unavailable device</option>}
    </select>
  );
}

function useAudioDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then(setDevices);
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refresh);
  }, [refresh]);

  return {
    inputs: devices.filter((d) => d.kind === "audioinput"),
    outputs: devices.filter((d) => d.kind === "audiooutput"),
    labelsHidden: devices.length > 0 && devices.every((d) => !d.label),
    refresh,
  };
}
