import { errorMessage } from "../text";

const LIMIT_MS = 15_000;

/**
 * Plays one spoken line in `voice` through a short receive-only Realtime session.
 * (OpenAI's text-to-speech models shut down in January 2027, so this uses Realtime.)
 */
export async function previewVoice(voice: string, line: string): Promise<void> {
  const pc = new RTCPeerConnection();
  pc.addTransceiver("audio", { direction: "recvonly" });
  const speaker = new Audio();
  speaker.autoplay = true;
  pc.addEventListener("track", (e) => {
    speaker.srcObject = e.streams[0] ?? new MediaStream([e.track]);
  });
  const events = pc.createDataChannel("oai-events");
  const done = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, LIMIT_MS);
    events.addEventListener("message", ({ data }) => {
      const type = (JSON.parse(String(data)) as { type?: string }).type;
      if (type === "output_audio_buffer.stopped") {
        clearTimeout(timer);
        setTimeout(resolve, 300);
      }
    });
  });
  events.addEventListener("open", () => {
    events.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: `Say exactly this, nothing else: "${line}"` }],
        },
      }),
    );
    events.send(JSON.stringify({ type: "response.create" }));
  });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const call = await window.greenroom.voice.connect({
      kind: "drill",
      sdp: offer.sdp ?? "",
      task: "Voice preview: speak the requested line once.",
      listenFirst: true,
      voice,
    });
    await pc.setRemoteDescription({ type: "answer", sdp: call.sdp });
    await done;
  } catch (error) {
    throw new Error(errorMessage(error));
  } finally {
    events.close();
    pc.close();
    speaker.srcObject = null;
  }
}
