# Greenroom

A personal rehearsal room for high-stakes speaking. Prep, rehearse out loud against a realtime AI
voice, then read a scored report and replay the recording. Desktop app for macOS and Linux.

Trainings:

- **Job interview:** job description + CV → question bank → study cards with feedback → voice
  drills → full mock interview → scored report. Or tick the rounds of a loop (recruiter screen,
  coding, system design, behavioral, hiring manager) and sit them in order, each with its own
  interviewer and rubric, then get a hire / no-hire debrief. Coding and design rounds have a
  scratchpad you share with the interviewer.
- **Presentation or demo:** the audience listens while you present, then you open the Q&A.
- **English conversation:** topic-based conversations with corrections afterwards.

Every report scores you against a rubric and measures pace, filler words, talk share and answer
length. Each finding quotes what you said, gives the better version and the rule, and links to that
moment in the recording. Discuss the report with the coach by text or on a short call, then
practise each finding with typed reps and spoken reps. Habits the reports keep finding carry over
into your next session. History charts your scores and habits over time.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/daut/greenroom/main/install.sh | sh
```

Re-run to update; `sh -s -- --uninstall` removes it (your data stays). Builds are unsigned, so the
script clears the macOS quarantine flag. Linux AppImages need `libfuse2`; a `.deb` is also on the
[releases page](https://github.com/daut/greenroom/releases).

Or with Homebrew (macOS):

```sh
brew tap daut/tap && brew trust daut/tap
brew install --cask greenroom
```

Homebrew prints an `xattr` command to run once before the first launch (the app is ad-hoc signed,
not notarized by Apple).

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
3. **Audio → Run full sound check** (also offered on Home before your first session): a
   two-minute warm-up to check mic, headphones and voice.

Keys live in the main process only, encrypted with the OS keychain (`OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` env vars work too). Settings are a hand-editable `settings.json`
(**Show settings file**).

## Sync across machines (optional)

Sessions and recordings can sync to your own [Supabase](https://supabase.com) project.

1. Create a project.
2. Apply the schema: `supabase link --project-ref <ref>` then `supabase db push`
   (or paste `supabase/migrations/*_greenroom_sync.sql` into the SQL editor). It creates the
   `training_sessions` table and a private `recordings` bucket, both owner-only via RLS.
3. **Authentication → Users → Add user → Create new user**: your email, a password, and
   *Auto Confirm User* on. (Password sign-in avoids Supabase's built-in mailer, which sends at most
   2 emails an hour per project.)
4. In Greenroom, **Settings → Sync & data**: paste the project URL and the **publishable** key
   (`sb_publishable_…`, never the secret key), then sign in with that email and password.

Prefer email sign-in? Request a sign-in email and paste either the 6-digit code or the whole link.
   With Supabase's default templates you get a link; clicking it opens a broken `localhost` page,
   so copy the link (or the address of that page) and paste it instead. To get codes, add
   `{{ .Token }}` to both the **Confirm signup** (first sign-in) and **Magic link** templates under
   Authentication → Email templates.

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
artifacts, writes `SHA256SUMS`, creates the GitHub Release, renders the Homebrew cask and pushes
it to `Casks/greenroom.rb` in [daut/homebrew-tap](https://github.com/daut/homebrew-tap) (via the
`TAP_DEPLOY_KEY` secret, a write deploy key on the tap).

### Adding a training

A training is data, not new screens. Write a `TrainingDefinition` in `src/shared/trainings/` and
add it to `TRAININGS` in `src/shared/trainings/index.ts`. Phases:

| Kind | What it does |
|---|---|
| `form` | Fields (text, long text, documents importable from PDF/TXT/Markdown or a web link, or `pick`: tick any of `options`) |
| `generate` | Structured text output (zod schema) from earlier artifacts, listed on screen |
| `cards` | Study cards with drafts, written feedback and confidence |
| `voice` | A realtime voice session; optional `choices`, `frame` (who the voice plays), `listenFirst` (listen until handed over), `persona` (style, interruptions, follow-up depth over the preset), `maxMinutes` and `scratchpad` (a text pad shared on demand and scored) |
| `report` | Scores a voice phase's runs against a rubric: findings with rules and line links, focus, habit review, speech metrics, and a coach discussion. Give it `background` (session context) and `guidance` (what to look for) |
| `drills` | Typed and spoken reps on the report findings and on habits still open from earlier sessions; coached by the first report's scorer |

Phases unlock after the previous one (or the ones in `after`) and read each other's output through
`ctx.artifact(id)`. When the phases depend on the setup (the interview's rounds), add
`phasesFor(ctx)`; `phases` stays the fresh-session list shown on Home, and code reads a session's
phases through `phasesOf(def, session)`. The contract tests in `trainings.test.ts` check every
registered training, fresh and with every `pick` option ticked.

Design system: `DESIGN.md` · product notes: `PRODUCT.md` · roadmap and status: `PROGRESS.md`.
