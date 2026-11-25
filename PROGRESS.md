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
- [x] `maxMinutes` hard stop; monthly spend ledger; new sessions blocked at 100% budget
- [x] Recording: mic + interviewer mixed via Web Audio → MediaRecorder (Opus/WebM) → `userData/recordings/`
- [x] Sound check screen (nav) in the programme style: running-time bar, cost so far, transcript, recording link
- [x] Verified end-to-end up to OpenAI auth: no key → clear error; fake key → "OpenAI rejected the API key (401)"
- [x] Interviewer ends the session itself (`end_session` tool), hangs up after its goodbye audio finishes (10 s fallback); end reason shown
- [x] Transcript auto-follows only when you're at the bottom; scrolling up stops it
- [x] Double replies: greeting only if nothing started yet; mic muted + turn detection off once the interviewer ends; near-field noise reduction; empty (noise/echo) turns dropped
- [x] Per-session event log saved to `userData/recordings/logs/*.jsonl` for debugging
- [~] Real conversation tested once by user (worked, but double replies — fixed above, needs retest)
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
- [!] Confirm **Sync now** succeeds end to end (user signed in; first sync attempt failed only because the table was missing, now fixed)
- [!] Turn on leaked-password protection (Supabase dashboard → Authentication → Password security)

### M6 — Progress

- [x] History: score trend per report phase (overall or per criterion, hire-bar line), latest metrics, session list with delete
- [x] Replay: recording with a ruled scrubber; transcript highlights the current line; click a line to jump

### M7 — More trainings (built only via the contract)

- [x] Presentation or demo: listen-first rehearsal (no replies while you present) → "Open the Q&A" hand-over → report
- [x] English conversation: topic picker, conversation partner frame, corrections report

## What's left

Handover notes for the next agent: see README "Development" and "Adding a training". Data folder is shared between `npm run dev` and installed builds (`~/Library/Application Support/Greenroom`). Claude Code text provider is on in dev, off in packaged builds unless `GREENROOM_ENABLE_CLAUDE_CODE=1`.

### Next feature: import a document from a link (decided, not built)
- [ ] "Import from link" next to "Import PDF, TXT or Markdown" on every `document` form field (JD, CV, presentation outline)
- [ ] Main-process `files.importUrl(url)`: https only; load in a hidden sandboxed `BrowserWindow` (no preload, separate partition), wait for load, 20 s timeout, close
- [ ] Extraction as a pure tested function: prefer `JobPosting` JSON-LD (title, hiringOrganization, description HTML → text); fallback to main/article text with nav/header/footer stripped; empty or login wall → "Couldn't read a job description from that page. Paste the text instead." (LinkedIn will usually hit this)
- [ ] Show "Imported from <host>" under the field, like file imports

### Release
- [ ] Cut v0.1.1 (main has sign-in fixes not in v0.1.0): bump `package.json` version, tag `v0.1.1`, wait for Release workflow, copy rendered cask artifact to `daut/homebrew-tap/Casks/greenroom.rb`, `brew audit --cask --strict`

### Waiting on the user
- [!] Retest Sound check after the double-reply fix (send newest `recordings/logs/*.jsonl` if it misbehaves)
- [!] Live voice drill / mock / presentation with an OpenAI key
- [!] Confirm Supabase **Sync now** works; enable leaked-password protection

### Todo
- [ ] Automate the tap update in the release workflow (needs a token secret with write access to the tap)
- [ ] Apple Developer ID signing + notarization (removes the quarantine step; enables auto-update on macOS)
- [ ] macOS packaged-app mic prompt check (TCC) once a key is in
- [ ] Verify audio on Linux (PipeWire + PulseAudio)
- [x] Min-window Drill: cost + Start moved above the question list under 640px

## Log

- 2026-11-25: Supabase sign-in fixed (pasted link, password), migration applied to the real project. Link import planned, not built. v0.1.1 pending.

- 2026-11-25: Public repos created, v0.1.0 released, cask published. Claude Code text provider off in release builds unless GREENROOM_ENABLE_CLAUDE_CODE=1.

- 2026-11-25: Whole product built: training engine, interview/presentation/English trainings, reports + metrics, history + replay, Supabase sync, text providers incl. opt-in Claude Code, voice preview, icon. 135 tests. Blocked only on live keys/projects and repo go-ahead.

- 2026-11-24: M0 core implemented (scaffold, settings, keys, packaging, install.sh). CI/release/cask still todo. Repo is local only, not pushed.
- 2026-11-25: Sound check fixes from first live try: self-ending session, scroll no longer yanks to bottom.
- 2026-11-25: CI/release/cask written. M1 voice spike built (Sound check screen); blocked on a real OpenAI key for the live test.
- 2026-11-24: UI redesigned with impeccable ("Theatre Programme" world). Skill now installed globally (`~/.agents/skills/impeccable`), not in the repo.
