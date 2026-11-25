# Greenroom

A personal rehearsal room for high-stakes speaking. Prep, rehearse out loud against a realtime AI
voice, then read a scored report and replay the recording. Desktop app for macOS and Linux.

Trainings:

- **Job interview:** job description + CV → question bank → study cards with feedback → voice
  drills → full mock interview → scored report.
- **Presentation or demo:** the audience listens while you present, then you open the Q&A.
- **English conversation:** topic-based conversations with corrections afterwards.

Every report scores you against a rubric and measures pace, filler words, talk share and answer
length. History charts your scores over time.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/daut/greenroom/main/install.sh | sh
```

Re-run to update; `sh -s -- --uninstall` removes it (your data stays). Builds are unsigned, so the
script clears the macOS quarantine flag. Linux AppImages need `libfuse2`; a `.deb` is also on the
releases page. A Homebrew cask is rendered for every release (`packaging/homebrew`).

## Setup

Open **Settings** (`Cmd/Ctrl + ,`).

1. **Keys → OpenAI.** Needed for the voice. Pay-as-you-go API credit; a 30-minute mock costs
   about $2.40 on `gpt-realtime-2.1` (~$1 on the mini model). Set a monthly budget under
   **Models & cost**; new voice sessions stop when you reach it.
2. **Models & cost → Text tasks.** Question generation, feedback and scoring run on one of:
   - **Anthropic API key** (Claude Max plans include monthly API credits: claude.ai → Settings →
     Billing → API credits, then create a key at platform.claude.com).
   - **OpenAI API key** (the same key as the voice).
   - **Claude Code on this Mac**: a personal setup that runs your own installed `claude` CLI
     with your own login and plan limits. It's off in release builds; start Greenroom with
     `GREENROOM_ENABLE_CLAUDE_CODE=1` to turn it on (always on in `npm run dev`). Greenroom
     doesn't bundle Claude Code; install it with `brew install --cask claude-code` and run
     `claude` once to log in.
3. **Sound check** in the sidebar: a two-minute warm-up to check mic, headphones and voice.

Keys live in the main process only, encrypted with the OS keychain (`OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` env vars work too). Settings are a hand-editable `settings.json`
(**Show settings file**).

## Sync across machines (optional)

Sessions and recordings can sync to your own [Supabase](https://supabase.com) project.

1. Create a project.
2. Apply the schema: `supabase link --project-ref <ref>` then `supabase db push`
   (or paste `supabase/migrations/*_greenroom_sync.sql` into the SQL editor). It creates the
   `training_sessions` table and a private `recordings` bucket, both owner-only via RLS.
3. **Authentication → Email templates → Magic link:** include `{{ .Token }}` so the email
   contains a 6-digit code (the desktop app signs in with a code, not a link).
4. In Greenroom, **Settings → Sync & data**: paste the project URL and the **publishable** key
   (`sb_publishable_…`, never the secret key), then sign in with the emailed code.

Sync runs on start, every 5 minutes and shortly after changes. The newest copy of a session wins;
deletions propagate. **Sync & data** also exports everything to JSON or deletes it.

## Development

```sh
npm install
npm run dev        # app with hot reload
npm run check      # typecheck + lint + tests
npm run dist:mac   # or dist:linux
npm run icon       # re-render build/icon.png
```

Releases: bump `version` in `package.json`, tag `vX.Y.Z`, push the tag. CI builds macOS and Linux
artifacts, writes `SHA256SUMS`, creates the GitHub Release and renders the Homebrew cask.

### Adding a training

A training is data, not new screens. Write a `TrainingDefinition` in `src/shared/trainings/` and
add it to `TRAININGS` in `src/shared/trainings/index.ts`. Phases:

| Kind | What it does |
|---|---|
| `form` | Fields (text, long text, or documents importable from PDF/TXT/Markdown) |
| `generate` | Structured text output (zod schema) from earlier artifacts, listed on screen |
| `cards` | Study cards with drafts, written feedback and confidence |
| `voice` | A realtime voice session; optional `choices`, `frame` (who the voice plays) and `listenFirst` (listen until handed over) |
| `report` | Scores a voice phase's runs against a rubric and adds speech metrics |

Phases unlock after the previous one (or the ones in `after`) and read each other's output through
`ctx.artifact(id)`. The contract tests in `trainings.test.ts` check every registered training.

Design system: `DESIGN.md` · product notes: `PRODUCT.md` · roadmap and status: `PROGRESS.md`.
