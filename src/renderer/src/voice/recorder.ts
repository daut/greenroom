export interface Recordings {
  /** Your mic and the interviewer, for playback. */
  mixed: ArrayBuffer;
  /** Your mic only, for the pronunciation review (no interviewer bleed). */
  mic: ArrayBuffer | null;
}

/**
 * Records the candidate's mic and the interviewer's voice mixed into one Opus/WebM track,
 * plus the mic alone. The interviewer stream arrives asynchronously, so it joins the mix
 * when it lands.
 */
export function startRecorder(mic: MediaStream, interviewer: Promise<MediaStream>) {
  const context = new AudioContext();
  const mix = context.createMediaStreamDestination();
  context.createMediaStreamSource(mic).connect(mix);
  interviewer.then((stream) => {
    if (context.state !== "closed") context.createMediaStreamSource(stream).connect(mix);
  });

  const mixed = record(mix.stream);
  const micOnly = record(mic);

  return {
    async stop(): Promise<Recordings | null> {
      const [mixedAudio, micAudio] = await Promise.all([mixed.stop(), micOnly.stop()]);
      await context.close();
      return mixedAudio ? { mixed: mixedAudio, mic: micAudio } : null;
    },
  };
}

function record(stream: MediaStream) {
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });
  recorder.start(1000);

  return {
    async stop(): Promise<ArrayBuffer | null> {
      if (recorder.state !== "inactive") {
        const stopped = new Promise((resolve) =>
          recorder.addEventListener("stop", resolve, { once: true }),
        );
        recorder.stop();
        await stopped;
      }
      if (chunks.length === 0) return null;
      return new Blob(chunks, { type: "audio/webm" }).arrayBuffer();
    },
  };
}
