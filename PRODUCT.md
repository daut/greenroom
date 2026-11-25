# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single user: the author, a senior software engineer preparing for job interviews, presentations, and demos. Practices alone at a desk with headphones, in evening practice blocks of 20-60 minutes, during daylight work hours between other tasks, and in short warm-ups minutes before a real interview, when nerves are high.

## Product Purpose

A personal trainer for high-stakes speaking. Each training runs a prep phase (inputs, generated questions, study cards, drafted answers) then a spoken rehearsal phase against a realtime AI voice, then a feedback phase (scored report, speech metrics, recording playback, progress over time). Success: the user walks into the real interview calm and ready, because they have already said the answers out loud.

## Positioning

Rehearsal out loud, not reading: a configurable interviewer persona (tone, interruptions, follow-up depth, seniority, company style, voice, language, pace) that talks back in real time, grounded in the user's own job description, CV, and company notes. Trainings are pluggable, so interview prep, presentation prep and demo, and English drills share one prep → rehearse → review loop.

## Operating Context

- Desktop app (Electron) on macOS and Linux; renders in Chromium.
- Audio: microphone + headphones; WebRTC to OpenAI Realtime; sessions recorded locally.
- Text tasks (question generation, feedback, scoring) via a provider the user picks: Anthropic API key, OpenAI API key, or, as an opt-in personal setup, the user's own installed Claude Code login.
- Optional sync of sessions and recordings to the user's own Supabase project; local-first without it.
- The user pays per voice minute, so cost visibility and hard session limits matter.

## Capabilities and Constraints

- Built: three trainings on one engine (job interview; presentation or demo with listen-first rehearsal and Q&A; English conversation), each prep → spoken rehearsal → scored report with speech metrics and synced replay; History with score trends; Sound check; Settings (keys, interviewer presets with voice preview, models and cost limits, text-task provider, audio, Supabase sync and data export/delete).
- API keys live only in the main process; the UI sees status and last-4 hints.
- Settings are a hand-editable JSON file; UI must tolerate any valid value.
- Terminology: training, phase, preset/persona, drill, mock, report.

## Brand Commitments

Name: Greenroom (the room performers wait in before going on stage). No other binding visual commitments; the existing dark-green look is disposable.

## Evidence on Hand

No real sessions, scores, or recordings exist yet. Do not fabricate usage history or results; demonstration data must be labeled synthetic.

## Product Principles

1. Calm before performance: the app lowers nerves, never adds pressure or noise.
2. Speaking is the point: every flow leads toward saying it out loud.
3. Honest feedback, kindly delivered: specific and actionable, never gamified.
4. Cost is visible: the user always knows what a voice session will cost and when it stops.
5. Personal tool: one user, no onboarding theatre, settings are fast to reach and change.
