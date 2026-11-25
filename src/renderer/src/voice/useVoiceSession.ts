import type { VoiceSessionKind } from "@shared/api";
import type { Settings } from "@shared/settings";
import { emptyTranscript, reduceEvent, type TranscriptState } from "@shared/transcript";
import { nextWrapUpStep, type WrapUpDone, type WrapUpStep, wrapUpNote } from "@shared/wrap-up";
import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../text";
import { startRecorder } from "./recorder";

export type VoiceStatus = "idle" | "connecting" | "live" | "ending" | "ended" | "failed";
export type EndReason = "you" | "interviewer" | "time";

export interface VoiceSessionState {
  status: VoiceStatus;
  transcript: TranscriptState;
  elapsedMs: number;
  maxMinutes: number | null;
  recordingPath: string | null;
  error: string | null;
  endedBy: EndReason | null;
  /** When the recording started, on the transcript's clock. */
  recordingOffsetMs: number;
}

/** After the interviewer's goodbye finishes playing, pause briefly before hanging up. */
const HANG_UP_DELAY_MS = 600;
/** Hang up anyway if the audio-finished signal never arrives. */
const HANG_UP_FALLBACK_MS = 10_000;

/** Lets a reply triggered by early speech claim the first turn before we prompt a greeting. */
const GREETING_DELAY_MS = 400;

const INITIAL: VoiceSessionState = {
  status: "idle",
  transcript: emptyTranscript(),
  elapsedMs: 0,
  maxMinutes: null,
  recordingPath: null,
  error: null,
  endedBy: null,
  recordingOffsetMs: 0,
};

/**
 * One realtime voice session: mic → WebRTC → OpenAI, interviewer audio → speaker,
 * transcript from data-channel events, optional mixed recording saved on stop.
 */
export function useVoiceSession(audio: Settings["audio"] | null) {
  const [state, setState] = useState<VoiceSessionState>(INITIAL);
  const live = useRef<LiveSession | null>(null);

  const stop = useCallback(async (reason: EndReason = "you") => {
    const session = live.current;
    if (!session) return;
    live.current = null;
    setState((s) => ({ ...s, status: "ending", endedBy: reason }));
    const recordingPath = await session.close();
    setState((s) => ({ ...s, status: s.error ? "failed" : "ended", recordingPath }));
  }, []);

  const start = useCallback(
    async (kind: VoiceSessionKind, task: string, options: StartOptions = {}) => {
      if (live.current || !audio) return;
      setState({ ...INITIAL, status: "connecting" });
      try {
        live.current = await openSession({
          kind,
          task,
          ...options,
          audio,
          onState: (update) => setState((s) => ({ ...s, ...update(s) })),
          onFinish: (reason) => void stop(reason),
        });
        setState((s) => ({ ...s, status: "live", maxMinutes: live.current?.maxMinutes ?? null }));
      } catch (error) {
        live.current = null;
        setState((s) => ({ ...s, status: "failed", error: errorMessage(error) }));
      }
    },
    [audio, stop],
  );

  useEffect(() => () => void live.current?.close(), []);

  /** Ends a listen-first stretch: the voice replies normally again and responds to `message`. */
  const handOff = useCallback((message: string) => live.current?.handOff(message), []);

  return { ...state, start, stop, handOff };
}

export interface StartOptions {
  frame?: string;
  listenFirst?: boolean;
  coach?: boolean;
  maxMinutes?: number;
  /** Defaults to the Settings → Audio choice; coaching calls aren't kept. */
  record?: boolean;
}

interface LiveSession {
  maxMinutes: number;
  close(): Promise<string | null>;
  handOff(message: string): void;
}

interface OpenOptions extends StartOptions {
  kind: VoiceSessionKind;
  task: string;
  audio: Settings["audio"];
  onState: (update: (s: VoiceSessionState) => Partial<VoiceSessionState>) => void;
  onFinish: (reason: EndReason) => void;
}

async function openSession({
  kind,
  task,
  audio,
  onState,
  onFinish,
  frame,
  listenFirst,
  coach,
  maxMinutes,
  record = audio.recordSessions,
}: OpenOptions): Promise<LiveSession> {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(audio.inputDeviceId === "default" ? {} : { deviceId: { exact: audio.inputDeviceId } }),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const pc = new RTCPeerConnection();
  const speaker = new Audio();
  speaker.autoplay = true;
  if (audio.outputDeviceId !== "default")
    await speaker.setSinkId(audio.outputDeviceId).catch(() => {});

  const remote = new Promise<MediaStream>((resolve) => {
    pc.addEventListener("track", (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      speaker.srcObject = stream;
      resolve(stream);
    });
  });
  for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);

  const events = pc.createDataChannel("oai-events");
  const startedAt = performance.now();
  let model = "";
  let transcript = emptyTranscript();
  const eventLog: string[] = [];
  events.addEventListener("message", ({ data }) => {
    const at = performance.now() - startedAt;
    const event = safeParse(data);
    eventLog.push(JSON.stringify({ at: Math.round(at), event: redactAudio(event) }));
    const wasEnding = transcript.endRequested;
    transcript = reduceEvent(transcript, event, { at, model });
    onState(() => ({ transcript }));
    if (transcript.endRequested && !wasEnding) stopListening();
    if (transcript.endRequested) hangUpAfterGoodbye();
  });

  /** After the goodbye, nothing the mic picks up may start another reply. */
  function stopListening() {
    for (const track of mic.getAudioTracks()) track.enabled = false;
    send({
      type: "session.update",
      session: { type: "realtime", audio: { input: { turn_detection: null } } },
    });
  }

  function send(event: object) {
    if (events.readyState === "open") events.send(JSON.stringify(event));
  }

  let hangUp: ReturnType<typeof setTimeout> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  function hangUpAfterGoodbye() {
    fallback ??= setTimeout(() => onFinish("interviewer"), HANG_UP_FALLBACK_MS);
    clearTimeout(hangUp);
    if (!transcript.interviewerAudio) {
      hangUp = setTimeout(() => onFinish("interviewer"), HANG_UP_DELAY_MS);
    }
  }
  events.addEventListener("open", () => {
    // The interviewer opens, unless your speech already triggered a reply.
    setTimeout(() => {
      if (!transcript.responded && transcript.speaking !== "you") send({ type: "response.create" });
    }, GREETING_DELAY_MS);
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  let call: Awaited<ReturnType<typeof window.greenroom.voice.connect>>;
  try {
    call = await window.greenroom.voice.connect({
      kind,
      sdp: offer.sdp ?? "",
      task,
      frame,
      listenFirst,
      coach,
      maxMinutes,
    });
  } catch (error) {
    stopTracks(mic);
    pc.close();
    throw error;
  }
  model = call.model;
  await pc.setRemoteDescription({ type: "answer", sdp: call.sdp });

  const recorder = record ? startRecorder(mic, remote) : null;
  const recordingOffsetMs = performance.now() - startedAt;
  onState(() => ({ recordingOffsetMs }));
  const limitMs = call.maxMinutes * 60_000;
  const wrapUp: WrapUpDone = { warned: false, timeUp: false, prompted: false };
  let listening = listenFirst === true;
  let quietSince = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    const elapsedMs = now - startedAt;
    onState(() => ({ elapsedMs }));
    if (transcript.endRequested) return;
    if (isBusy(transcript)) quietSince = now;
    const step = nextWrapUpStep({
      elapsedMs,
      limitMs,
      youSpeaking: transcript.speaking === "you",
      quietMs: now - quietSince,
      canPrompt: !listening,
      done: wrapUp,
    });
    applyWrapUp(step);
  }, 250);

  function applyWrapUp(step: WrapUpStep) {
    switch (step) {
      case "warn":
      case "time-up":
        wrapUp.warned = true;
        wrapUp.timeUp = step === "time-up";
        sendNote(wrapUpNote(step, limitMs));
        return;
      case "prompt-goodbye":
        wrapUp.prompted = true;
        send({ type: "response.create" });
        return;
      case "hang-up":
        onFinish("time");
        return;
    }
  }

  /** A system message the interviewer reads on its next turn; it doesn't start one. */
  function sendNote(text: string) {
    send({
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text }] },
    });
  }

  let closed: Promise<string | null> | null = null;
  return {
    maxMinutes: call.maxMinutes,
    handOff(message: string) {
      listening = false;
      send({
        type: "session.update",
        session: {
          type: "realtime",
          audio: {
            input: {
              turn_detection: {
                type: "semantic_vad",
                create_response: true,
                interrupt_response: true,
              },
            },
          },
        },
      });
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: message }] },
      });
      send({ type: "response.create" });
    },
    close() {
      closed ??= (async () => {
        clearInterval(ticker);
        clearTimeout(hangUp);
        clearTimeout(fallback);
        const recording = await recorder?.stop();
        events.close();
        pc.close();
        stopTracks(mic);
        speaker.srcObject = null;
        await window.greenroom.voice.recordSpend(transcript.costUsd);
        await window.greenroom.voice.saveEventLog(eventLog.join("\n"));
        return recording ? window.greenroom.voice.saveRecording(recording) : null;
      })();
      return closed;
    },
  };
}

/** Keeps the event log small: audio payloads are not needed to debug turn-taking. */
function redactAudio(event: unknown): unknown {
  if (!event || typeof event !== "object") return event;
  const { audio, delta, ...rest } = event as Record<string, unknown>;
  const isAudio = (event as { type?: string }).type === "response.output_audio.delta";
  return {
    ...rest,
    ...(audio ? { audio: "…" } : {}),
    ...(delta ? { delta: isAudio ? "…" : delta } : {}),
  };
}

function isBusy(t: TranscriptState): boolean {
  return t.speaking !== null || t.responding || t.interviewerAudio;
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function safeParse(data: unknown): unknown {
  try {
    return JSON.parse(String(data));
  } catch {
    return null;
  }
}
