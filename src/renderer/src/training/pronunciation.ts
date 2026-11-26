import { CLIP_SAMPLE_RATE, type Clip, encodeWav, pickClips, sliceClip } from "@shared/clips";
import {
  type AudioReview,
  clipLabel,
  estimateReviewCostUsd,
  PRONUNCIATION_SYSTEM,
  pronunciationPrompt,
  pronunciationSchema,
} from "@shared/pronunciation";
import type { VoiceRun } from "@shared/training";
import { z } from "zod";
import { errorMessage } from "../text";

/** Cuts your turns out of the recording and has the audio model rate how clear they are. */
export async function reviewPronunciation(run: VoiceRun, context: string): Promise<AudioReview> {
  const path = recordingFor(run);
  if (!path) return skipped("No recording for this run (recording is off in Settings → Audio).");
  const clips = clipsFor(run);
  if (clips.length === 0) return skipped("Your turns were too short to judge.");
  try {
    const data = await window.greenroom.voice.readRecording(path);
    if (!data) return skipped("The recording file is gone.");
    const samples = await decodeMono(data);
    const { $schema: _drop, ...schema } = z.toJSONSchema(pronunciationSchema) as Record<
      string,
      unknown
    >;
    const { reply, costUsd } = await window.greenroom.voice.reviewPronunciation({
      system: PRONUNCIATION_SYSTEM,
      prompt: pronunciationPrompt(run.lines, clips, context),
      schema,
      clips: clips.map((c) => ({
        label: clipLabel(c),
        wav: encodeWav(sliceClip(samples, CLIP_SAMPLE_RATE, c), CLIP_SAMPLE_RATE),
      })),
    });
    const parsed = pronunciationSchema.safeParse(reply);
    if (!parsed.success) return skipped("The audio review came back in an unexpected shape.");
    return { ok: true, reply: parsed.data, costUsd };
  } catch (e) {
    return skipped(errorMessage(e));
  }
}

/** Expected cost of reviewing this run, or null when there's nothing to send or no price data. */
export function pronunciationEstimateUsd(run: VoiceRun, model: string): number | null {
  if (!recordingFor(run)) return null;
  const clips = clipsFor(run);
  if (clips.length === 0) return null;
  return estimateReviewCostUsd(
    model,
    clips.reduce((ms, c) => ms + c.endMs - c.startMs, 0),
  );
}

/** The mic-only copy has no interviewer in it; older runs only have the mix. */
function recordingFor(run: VoiceRun): string | null {
  return run.micRecordingPath ?? run.recordingPath;
}

function clipsFor(run: VoiceRun): Clip[] {
  return pickClips(run.lines, run.recordingOffsetMs ?? 0);
}

/** Decoding into a 16 kHz context resamples; channels are averaged to mono. */
async function decodeMono(data: ArrayBuffer): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, 1, CLIP_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(data);
  const mono = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const channel = buffer.getChannelData(ch);
    for (let i = 0; i < mono.length; i++)
      mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0) / buffer.numberOfChannels;
  }
  return mono;
}

function skipped(reason: string): AudioReview {
  return { ok: false, reason };
}
