import type { SpokenLine } from "./metrics";

/** A stretch of the recording holding one of your turns. Times are on the recording's clock. */
export interface Clip {
  /** Index into the run's lines. */
  line: number;
  startMs: number;
  endMs: number;
}

export interface ClipOptions {
  /** Most audio sent in total. */
  maxTotalMs: number;
  /** Long turns are cut to this, so one monologue doesn't use the whole budget. */
  maxClipMs: number;
  /** Shorter turns are skipped: too little to judge. */
  minClipMs: number;
  /** Turn events arrive after speech starts and ends; pad so words aren't clipped. */
  padStartMs: number;
  padEndMs: number;
}

export const DEFAULT_CLIP_OPTIONS: ClipOptions = {
  maxTotalMs: 5 * 60_000,
  maxClipMs: 45_000,
  minClipMs: 1_500,
  padStartMs: 600,
  padEndMs: 300,
};

export const CLIP_SAMPLE_RATE = 16_000;

/** Your longest turns first, until the budget is spent; returned in the order they were said. */
export function pickClips(
  lines: SpokenLine[],
  recordingOffsetMs: number,
  options: ClipOptions = DEFAULT_CLIP_OPTIONS,
): Clip[] {
  const candidates = lines
    .map((l, line) => ({ l, line }))
    .filter(({ l }) => l.speaker === "you" && l.endMs !== null && l.text.trim())
    .map(({ l, line }) => ({
      line,
      startMs: Math.max(0, l.startMs - recordingOffsetMs - options.padStartMs),
      endMs: (l.endMs as number) - recordingOffsetMs + options.padEndMs,
      spokenMs: (l.endMs as number) - l.startMs,
    }))
    .filter((c) => c.spokenMs >= options.minClipMs)
    .sort((a, b) => b.spokenMs - a.spokenMs);

  const picked: Clip[] = [];
  let total = 0;
  for (const c of candidates) {
    const length = Math.min(c.endMs - c.startMs, options.maxClipMs, options.maxTotalMs - total);
    if (length < options.minClipMs) continue;
    picked.push({ line: c.line, startMs: c.startMs, endMs: c.startMs + length });
    total += length;
  }
  return picked.sort((a, b) => a.startMs - b.startMs);
}

export function sliceClip(samples: Float32Array, sampleRate: number, clip: Clip): Float32Array {
  const at = (ms: number) => Math.min(samples.length, Math.round((ms / 1000) * sampleRate));
  return samples.subarray(at(clip.startMs), at(clip.endMs));
}

/** 16-bit mono PCM WAV, the format the audio models accept. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytes = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + bytes));
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, bytes, true);
  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return view.buffer;
}
