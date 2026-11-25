/**
 * Records the candidate's mic and the interviewer's voice mixed into one Opus/WebM track.
 * The interviewer stream arrives asynchronously, so it joins the mix when it lands.
 */
export function startRecorder(mic: MediaStream, interviewer: Promise<MediaStream>) {
  const context = new AudioContext();
  const mix = context.createMediaStreamDestination();
  context.createMediaStreamSource(mic).connect(mix);
  interviewer.then((stream) => {
    if (context.state !== "closed") context.createMediaStreamSource(stream).connect(mix);
  });

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(mix.stream, { mimeType: "audio/webm;codecs=opus" });
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
      await context.close();
      if (chunks.length === 0) return null;
      return new Blob(chunks, { type: "audio/webm" }).arrayBuffer();
    },
  };
}
