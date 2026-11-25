import { useEffect, useState } from "react";

/**
 * Live RMS level (0..1) of the given input device while `deviceId` is non-null.
 * Returns -1 if microphone access is denied.
 */
export function useMicLevel(deviceId: string | null): number {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (deviceId === null) {
      setLevel(0);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    const context = new AudioContext();

    navigator.mediaDevices
      .getUserMedia({ audio: deviceId === "default" ? true : { deviceId: { exact: deviceId } } })
      .then((s) => {
        stream = s;
        if (cancelled) return stopTracks(s);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(s).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);

        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          setLevel(Math.min(1, rms(samples) * 4));
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => setLevel(-1));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (stream) stopTracks(stream);
      context.close();
    };
  }, [deviceId]);

  return level;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}
