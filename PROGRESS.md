# Greenroom — Progress

Personal interview/presentation trainer. Electron + React + TS, OpenAI Realtime for voice,
Claude for text tasks, Supabase for sync. macOS + Linux.

Legend: `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked / needs input

## Decisions

| Topic           | Decision                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Platforms       | macOS + Linux (no Windows)                                                                         |
| Shell           | Electron (Chromium WebRTC + echo cancellation identical on both OSes)                              |
| Voice           | OpenAI Realtime over WebRTC; `gpt-realtime-2.1-mini` for drills, `gpt-realtime-2.1` for mocks      |
| Text LLM        | Claude via API credits included with Max plan (Haiku 5.5 generation, Sonnet 5.5 scoring)           |
| Backend         | Supabase (Postgres + RLS, Storage for recordings, magic-link auth)                                 |
| Keys            | Main process only, encrypted with Electron `safeStorage`, env var fallback                         |
| Settings        | Single versioned JSON (`settings.json` in userData), zod-validated, per-field fallback to defaults |
| Distribution    | GitHub Releases + `install.sh` (curl) + Homebrew tap `daut/tap`; unsigned macOS (ad-hoc)           |
| Package manager | npm                                                                                                |

## Milestones

### M0 — Scaffold, settings, packaging

- [x] electron-vite + React + TS + Vitest + Biome scaffold
- [x] Settings schema (zod) with defaults + per-field fallback, tests
- [x] Settings store (atomic write, survives corrupt file), tests
- [x] Key store (`safeStorage`, env fallback, masked status), tests
- [x] Key test against OpenAI / Anthropic `/v1/models`
- [x] Settings UI: Keys, Interviewer (presets), Models & cost, Audio
- [x] App menu with `Cmd/Ctrl+,` → Settings
- [x] electron-builder config (zip/dmg mac, AppImage/deb linux), ad-hoc signed, mic usage description; packaged mac app boots
- [x] `install.sh` (curl installer, checksum verify, update, `--uninstall`); tested on macOS + simulated Linux, checksum-mismatch path verified
- [x] CI workflow `.github/workflows/ci.yml` (check + build on macOS + Linux, shellcheck) — not yet run on GitHub
- [x] Release workflow `.github/workflows/release.yml` (tag `v*` → build mac+linux, SHA256SUMS, GitHub Release, rendered cask artifact) — not yet run
- [x] Homebrew cask template `packaging/homebrew/greenroom.rb.tmpl` + `scripts/update-cask.sh` (tested locally, shellcheck clean)
- [x] Public repo github.com/daut/greenroom; CI green on macOS + Linux
- [x] Public tap github.com/daut/homebrew-tap with `Casks/greenroom.rb` (strict audit passes; real `brew install` tested)
- [x] v0.1.0 released: mac zip/dmg (arm64, x64), Linux AppImage/deb (x64, arm64), SHA256SUMS; curl installer tested against it
- [x] App icon (`build/icon.png`, rendered with Archivo by `npm run icon`)

### Design (impeccable)
- [x] PRODUCT.md (product truth), direction roll → user chose "Theatre Programme"
- [x] Visual world built: yellow masthead rail, ink on cool white, Archivo (width axis, self-hosted), dot-leader billing, stamps for state, exact-length running-time bars
- [x] Home + Settings (Keys, Interviewer, Models & cost, Audio) rebuilt; responsive to 800x600 min window
- [x] Key readiness shared across rail/Home/Keys (tracks this session's test result)
- [x] Finish review: 2 fix rounds → ship; detector clean
- [x] DESIGN.md + `.impeccable/design.json` written from the built world
- [x] Square corners everywhere (no border-radius except readiness pips)
- [x] All greys tokenized (`--hover`, `--press`, `--ink-hover`, `--placeholder`, `--leader`)
- [x] Finish review of all new surfaces (session, phases, report/replay, history, settings additions): 3 rounds → ship; detector clean; DESIGN.md additions recorded

### M1 — Realtime voice spike

- [x] Main: create call via `POST /v1/realtime/calls` (SDP offer + session, multipart). Changed from ephemeral tokens: the renderer never holds any credential, and CSP no longer allows api.openai.com
- [x] Session config from persona: voice, speed (pace), semantic VAD eagerness (interruptions), `gpt-transcribe` input transcription, truncation `retention_ratio 0.8 / 8000`
- [x] Interviewer instructions from persona (tone, turn-taking, language, no coaching)
- [x] Renderer: WebRTC session (mic track, remote audio, `oai-events` data channel), interviewer speaks first
- [x] Live transcript reducer (you / interviewer, timings, who is speaking), TDD
- [x] Cost from `response.done` usage + transcription duration, per-model rates, TDD
- [x] Monthly spend ledger; new sessions blocked at 100% budget
- [x] Gentle time limit (`src/shared/wrap-up.ts`, TDD): silent system note 1–3 min before the limit, "time is up, close after this answer" note at the limit, goodbye prompted only after 4 s of quiet (never while listen-first), hang-up only after 2–5 min overtime and not mid-sentence (absolute +1 min). Replaces the hard cut at `maxMinutes`
- [!] Gentle time limit untested live (set Drill to 1–2 min in Settings to try it quickly)
- [x] Recording: mic + interviewer mixed via Web Audio → MediaRecorder (Opus/WebM) → `userData/recordings/`
- [x] Sound check screen (nav) in the programme style: running-time bar, cost so far, transcript, recording link
- [x] Verified end-to-end up to OpenAI auth: no key → clear error; fake key → "OpenAI rejected the API key (401)"
- [x] Interviewer ends the session itself (`end_session` tool), hangs up after its goodbye audio finishes (10 s fallback); end reason shown
- [x] Transcript auto-follows only when you're at the bottom; scrolling up stops it
- [x] Double replies: greeting only if nothing started yet; mic muted + turn detection off once the interviewer ends; near-field noise reduction; empty (noise/echo) turns dropped
- [x] Per-session event log saved to `userData/recordings/logs/*.jsonl` for debugging
- [x] Sound check retested by user: no double replies. The mini model said goodbye but never called `end_session`; instructions now insist on the call in the same response
- [!] Confirm the interviewer now hangs up by itself (newest `recordings/logs/*.jsonl` should show a `function_call` in the last `response.done`)
- [x] Voice preview in Interviewer settings (short receive-only Realtime session; OpenAI TTS models shut down Jan 2027)

### M2 — Training engine

- [x] `TrainingDefinition` / phase kinds (form, generate, cards, voice, report) + registry, TDD
- [x] Phase runner: dependencies, completion, redo reopens dependents (work kept), TDD
- [x] Contract tests run against every registered training
- [x] Generic phase screens + session screen (act list with stamps); Home lists trainings + recent sessions
- [x] Local persistence: one JSON per session in `userData/sessions`, deletion tombstones for sync, TDD
- [x] Text-task providers: Anthropic API, OpenAI Responses API, Claude Code CLI (detection + install hint, opt-in), structured output everywhere, TDD

### M3 — Interview training

- [x] Setup form: role, company, JD, CV (PDF/TXT/MD import via unpdf, CJS so it works in the asar), notes
- [x] Question bank (12, structured) — verified live via Claude Code
- [x] Study cards: drafts, written feedback (rendered markdown-lite), confidence — verified live
- [x] Drill (pick a question, mini model) and mock (question bank, full model), time limit in instructions
- [x] Cost + persona shown before starting; runs saved with transcript, cost, recording, end reason
- [!] Live voice drill/mock untested — needs your OpenAI key

### M4 — Feedback

- [x] Rubric scoring (structured, per-criterion 1–5 + comments, summary, strengths, improvements) — verified live via Claude Code on a synthetic run
- [x] Speech metrics: WPM over your speaking time, fillers/min with breakdown, talk share, answer count/avg/longest, TDD

### M5 — Supabase sync

- [x] Migration `supabase/migrations/*_greenroom_sync.sql`: `training_sessions` + private `recordings` bucket, owner-only RLS (select/insert/update/delete, update with check)
- [x] Sync engine: last-writer-wins per session, tombstones both ways, recordings up/down with path relinking, TDD with a fake remote
- [x] Supabase adapter (publishable key, email OTP code sign-in, encrypted token storage), auto-sync on start / 5 min / 10 s after edits
- [x] Settings → Sync & data: project, sign-in, status, sync now, sign out; export all to JSON; delete all
- [x] Sign-in accepts the pasted email link as well as a code (default templates send links; first sign-in uses the Confirm signup template)
- [x] Password sign-in (built-in mailer allows only 2 emails/hour/project)
- [x] Migration applied to the user's `greenroom` project (ref `twzsrnczvevfvgqfkiox`, linked via CLI); RLS on, 4 table + 4 storage owner-only policies, bucket private, anon has no access; advisors: only leaked-password protection warning
- [x] **Sync now** verified end to end: the one local session is the one row in `training_sessions` (no recordings yet to upload)
- [ ] Optional: leaked-password protection (Supabase dashboard → Authentication → Password security; Pro plan only)

### M6 — Progress

- [x] History: score trend per report phase (overall or per criterion, hire-bar line), latest metrics, session list with delete
- [x] Replay: recording with a ruled scrubber; transcript highlights the current line; click a line to jump

### M7 — More trainings (built only via the contract)

- [x] Presentation or demo: listen-first rehearsal (no replies while you present) → "Open the Q&A" hand-over → report
- [x] English conversation: topic picker, conversation partner frame, corrections report

## What's left

Handover notes for the next agent: see README "Development" and "Adding a training". Data folder is shared between `npm run dev` and installed builds (`~/Library/Application Support/Greenroom`). Claude Code text provider is on in dev, off in packaged builds unless `GREENROOM_ENABLE_CLAUDE_CODE=1`.

### Import a document from a link (built)
- [x] "Import from link" next to the file import on every `document` field; inline URL row, error under it, "Imported from <host>"
- [x] `src/main/link-import/load-page.ts`: https only; hidden sandboxed window, in-memory `link-import` partition wiped after each import, no preload, JS on, muted, popups/downloads/permissions denied, Electron token stripped from the UA; polls until text settles (max 6 s), 20 s timeout
- [x] `extract.ts` (TDD): `JobPosting` JSON-LD first (`@graph`, arrays, escaped HTML), else page text minus nav/header/footer/forms; login walls and near-empty pages → "paste the text instead"
- [x] Verified live: Greenhouse, Lever, Ashby (JS-rendered), public LinkedIn job (JSON-LD), 404, DNS failure, http://

### Actionable feedback (built)
- [x] Structured findings (`src/shared/report.ts`, TDD): kind, criterion, severity, habit label, numbered-transcript line, quote → better, why, recurring; `focus`; `habitReview` of known habits. Old reports still render ("Score again" upgrades)
- [x] Report UI: "Work on this first", "Also noticed", "Since last time"; per finding Hear it (cues Replay), Discuss, Drill this
- [x] Discuss (`src/shared/coach.ts`, TDD): text chat with history replayed into each prompt (works with Claude Code); voice call via the drill model in coach mode, not recorded, transcript appended to the chat. Stored in `report.discussion`
- [x] `drills` phase kind ("Practice") in all three trainings: typed reps (5 generated, checked item by item) and ~3-minute spoken reps with on-the-spot correction, then a check. Entries in the phase artifact
- [x] Habits (`src/shared/habits.ts`, TDD): tracked across sessions per training (open / improving / fixed); known habits go to the scorer; English "What to work on" pre-fills; History lists them
- [x] Voice: `coach` and `maxMinutes` on `VoiceCallRequest` (main validates), `record` option
- [x] Verified live via Claude Code on the real English session: scoring, discussion reply and typed reps
- [!] Voice discuss + spoken reps untested live; restart `npm run dev` first (main process changed)

### Release
- [x] v0.1.1 released (sign-in fixes, link import, end_session prompt). Workflow pushed the cask to the tap itself; `brew audit --cask --strict --online` passes; `brew upgrade` to 0.1.1 tested and link import works in the installed app
- [x] Cask now requires macOS Ventura (online audit: Electron's minimum); caveat no longer promises Developer ID signing

### Waiting on the user
- [!] Live voice drill / mock / presentation with an OpenAI key (also confirms the self-hang-up fix)
- [!] Verify audio on Linux (PipeWire + PulseAudio)

### Todo
- [x] Tap update automated: `TAP_DEPLOY_KEY` secret = write deploy key on `daut/homebrew-tap` only
- [ ] macOS packaged-app mic prompt check (TCC) once a key is in
- [x] Min-window Drill: cost + Start moved above the question list under 640px

## Log

- 2026-11-26: Feedback made actionable: structured findings with rules and recording links, coach discussion (text + voice), Practice phase with typed and spoken reps, habits carried across sessions.

- 2026-11-25: v0.1.2 released (gentle time limit). Tap updated by the workflow; strict online audit passes; brew upgrade tested.

- 2026-11-25: Time limit no longer cuts you off: the interviewer is warned, then closes after your answer; hard stop only after overtime.

- 2026-11-25: Link import built and verified live. Sound check log reviewed (no double replies; end_session missed → prompt fix). Supabase sync verified server-side. Tap update automated with a deploy key. Apple signing dropped (won't do). v0.1.1 released via the automated tap push.

- 2026-11-25: Supabase sign-in fixed (pasted link, password), migration applied to the real project. Link import planned, not built. v0.1.1 pending.

- 2026-11-25: Public repos created, v0.1.0 released, cask published. Claude Code text provider off in release builds unless GREENROOM_ENABLE_CLAUDE_CODE=1.

- 2026-11-25: Whole product built: training engine, interview/presentation/English trainings, reports + metrics, history + replay, Supabase sync, text providers incl. opt-in Claude Code, voice preview, icon. 135 tests. Blocked only on live keys/projects and repo go-ahead.

- 2026-11-24: M0 core implemented (scaffold, settings, keys, packaging, install.sh). CI/release/cask still todo. Repo is local only, not pushed.
- 2026-11-25: Sound check fixes from first live try: self-ending session, scroll no longer yanks to bottom.
- 2026-11-25: CI/release/cask written. M1 voice spike built (Sound check screen); blocked on a real OpenAI key for the live test.
- 2026-11-24: UI redesigned with impeccable ("Theatre Programme" world). Skill now installed globally (`~/.agents/skills/impeccable`), not in the repo.
