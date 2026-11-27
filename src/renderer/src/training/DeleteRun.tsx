import { removeRun, type TrainingDefinition, type VoiceRun } from "@shared/training";
import { useState } from "react";
import type { UpdateSession } from "./useTrainingSession";

/** Delete with an inline confirm; takes the run's reports and recordings with it. */
export function DeleteRun({
  def,
  voicePhaseId,
  run,
  update,
  disabled = false,
  onDeleted,
}: {
  def: TrainingDefinition;
  voicePhaseId: string;
  run: VoiceRun;
  update: UpdateSession;
  disabled?: boolean;
  onDeleted?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const remove = () => {
    update((s) => removeRun(def, s, voicePhaseId, run.at));
    void window.greenroom.voice.deleteRecordings(recordingsOf(run));
    onDeleted?.();
  };

  if (!confirming)
    return (
      <button
        type="button"
        className="link"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  return (
    <span className="confirm">
      <button type="button" className="btn danger" onClick={remove}>
        Delete run
      </button>
      <button type="button" className="btn" onClick={() => setConfirming(false)}>
        Keep
      </button>
    </span>
  );
}

function recordingsOf(run: VoiceRun): string[] {
  return [run.recordingPath, run.micRecordingPath].filter((p): p is string => Boolean(p));
}
