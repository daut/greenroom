import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  IPC,
  type MonthSpend,
  type PronunciationRequest,
  type PronunciationResult,
  type VoiceCall,
  type VoiceCallRequest,
} from "@shared/api";
import { interviewerInstructions } from "@shared/interviewer";
import { reviewCostUsd } from "@shared/pronunciation";
import { buildRealtimeSession } from "@shared/realtime";
import { activePersona, withPersonaOverride } from "@shared/settings";
import { ipcMain, shell, systemPreferences } from "electron";
import type { KeyStore } from "./key-store";
import { createRealtimeCall } from "./realtime-call";
import { createRecordingTrash } from "./recording-trash";
import type { SettingsStore } from "./settings-store";
import type { SpendLedger } from "./spend-ledger";
import { reviewAudioWithOpenAI } from "./text/openai-audio";

interface Deps {
  settingsStore: SettingsStore;
  keyStore: KeyStore;
  ledger: SpendLedger;
  recordingsDir: string;
}

export function registerVoiceIpc({ settingsStore, keyStore, ledger, recordingsDir }: Deps) {
  const trash = createRecordingTrash(recordingsDir);
  const monthSpend = (): MonthSpend => ({
    spentUsd: ledger.monthTotal(),
    budgetUsd: settingsStore.load().limits.monthlyBudgetUsd,
  });

  ipcMain.handle(IPC.voiceConnect, async (_e, request: VoiceCallRequest): Promise<VoiceCall> => {
    assertWithinBudget(monthSpend());
    const apiKey = keyStore.get("openai");
    if (!apiKey) throw new Error("No OpenAI key set. Add one in Settings → Keys.");
    await ensureMicrophoneAccess();

    const settings = settingsStore.load();
    const voicedBy = request.model === "drill" || request.model === "mock" ? request.model : null;
    const model = settings.models[voicedBy ?? request.kind];
    const preset = withPersonaOverride(activePersona(settings), request.persona);
    const persona = request.voice ? { ...preset, voice: request.voice } : preset;
    const limit =
      request.kind === "mock" ? settings.limits.mockMaxMinutes : settings.limits.drillMaxMinutes;
    const requested = Number(request.maxMinutes);
    const maxMinutes =
      Number.isFinite(requested) && requested > 0 ? Math.min(requested, limit) : limit;
    const task = `${request.task}\nPlanned length: about ${maxMinutes} minutes. You can't see a clock; the app will send you a note when time is nearly up and when it is up. Until then, keep going. Never cut the user off mid-answer.`;
    const session = buildRealtimeSession({
      model,
      persona,
      instructions: interviewerInstructions(persona, task, request.frame, {
        coach: request.coach === true,
      }),
    });
    const sdp = await createRealtimeCall({
      sdp: request.sdp,
      session,
      apiKey,
    });
    return { sdp, model, maxMinutes };
  });

  ipcMain.handle(IPC.voiceRecordSpend, (_e, usd: unknown) => {
    if (typeof usd === "number") ledger.record(usd);
    return monthSpend();
  });

  ipcMain.handle(IPC.voiceMonthSpend, () => monthSpend());

  ipcMain.handle(IPC.voiceSaveRecording, (_e, audio: ArrayBuffer, variant: unknown) =>
    saveSessionFile(recordingsDir, variant === "mic" ? "mic.webm" : "webm", Buffer.from(audio)),
  );

  ipcMain.handle(
    IPC.voiceReviewPronunciation,
    async (_e, request: PronunciationRequest): Promise<PronunciationResult> => {
      assertWithinBudget(monthSpend());
      const apiKey = keyStore.get("openai");
      if (!apiKey) throw new Error("No OpenAI key set. Add one in Settings → Keys.");
      const model = settingsStore.load().models.pronunciation;
      const { reply, usage } = await reviewAudioWithOpenAI({
        model,
        apiKey,
        system: String(request.system),
        prompt: String(request.prompt),
        schema: request.schema,
        clips: validClips(request.clips),
      });
      const costUsd = reviewCostUsd(model, usage);
      ledger.record(costUsd);
      return { reply, costUsd };
    },
  );

  ipcMain.handle(IPC.voiceSaveEventLog, (_e, jsonl: unknown) =>
    saveSessionFile(join(recordingsDir, "logs"), "jsonl", String(jsonl)),
  );

  ipcMain.handle(IPC.voiceReadRecording, (_e, path: unknown) => {
    if (typeof path !== "string" || !path.startsWith(recordingsDir) || !existsSync(path))
      return null;
    const data = readFileSync(path);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  });

  ipcMain.handle(IPC.voiceRevealRecording, (_e, path: unknown) => {
    if (typeof path === "string" && path.startsWith(recordingsDir)) shell.showItemInFolder(path);
  });

  ipcMain.handle(IPC.voiceDeleteRecordings, (_e, paths: unknown) => {
    if (!Array.isArray(paths)) return;
    trash.remove(paths.filter((p): p is string => typeof p === "string"));
  });
}

function saveSessionFile(dir: string, extension: string, content: Buffer | string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`);
  writeFileSync(path, content);
  return path;
}

function validClips(clips: unknown): { label: string; wav: Uint8Array }[] {
  if (!Array.isArray(clips) || clips.length === 0) throw new Error("No audio clips to review.");
  return clips.map((c: { label?: unknown; wav?: unknown }) => {
    const { label, wav } = c ?? {};
    if (typeof label !== "string") throw new Error("Invalid audio clip.");
    if (wav instanceof ArrayBuffer) return { label, wav: new Uint8Array(wav) };
    if (ArrayBuffer.isView(wav))
      return { label, wav: new Uint8Array(wav.buffer, wav.byteOffset, wav.byteLength) };
    throw new Error("Invalid audio clip.");
  });
}

function assertWithinBudget({ spentUsd, budgetUsd }: MonthSpend) {
  if (budgetUsd > 0 && spentUsd >= budgetUsd) {
    throw new Error(
      `Monthly voice budget reached ($${spentUsd.toFixed(2)} of $${budgetUsd}). Raise it in Settings → Models & cost.`,
    );
  }
}

async function ensureMicrophoneAccess() {
  if (process.platform !== "darwin") return;
  if (systemPreferences.getMediaAccessStatus("microphone") === "granted") return;
  const granted = await systemPreferences.askForMediaAccess("microphone");
  if (!granted) {
    throw new Error(
      "Microphone access is off. Allow Greenroom in System Settings → Privacy & Security → Microphone.",
    );
  }
}
