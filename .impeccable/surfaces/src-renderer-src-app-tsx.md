---

version: 1
slug: "src-renderer-src-app-tsx"
primary_target: "src/renderer/src/App.tsx"
related_targets: ["src/renderer/src/settings/SettingsPage.tsx","src/renderer/src/Home.tsx"]
---

# App shell + Settings (Operate)

Scope: the whole Electron app shell (nav rail, Home) and Settings (Keys, Interviewer, Models & cost, Audio). Visitor mode: Operate. Single user preparing for interviews; jobs: set keys, tune interviewer persona, set cost limits, check mic. Must stay calm, scannable, fast. Constraints: keys never shown in full; settings tolerate hand-edited values.

## Direction contract

THESIS: Each practice session is tonight's performance and Greenroom is its programme. Refuses the category default of a grey dark dashboard with a single neon accent.

OWN-WORLD: Programme masthead yellow (#F2C230-ish) owns the full-height nav rail; ink near-black type and 1.5px ink rules; cool white page stock, never cream. Archivo: condensed heavy uppercase for masthead and page titles, normal width for UI text. Square corners everywhere, ink-outlined controls, solid-ink selected states. Status green/red only where meaningful.

STORY: The user sees at a glance whether keys are ready, who the interviewer is tonight, and what a session may cost; changes any of it in one click; trusts that it saved.

FIRST VIEWPORT: Left: 248px yellow rail with GREEN/ROOM masthead stacked, nav items, key readiness at the foot. Right: condensed uppercase page title, ink-ruled tabs, then on Interviewer a cast list of presets with dot leaders to the voice name, and a framed billing card whose sentence rewrites live from the persona controls; segmented ink controls below.

FORM: Theatre Programme, position 7 of the grounded list. seed:b0c623b56f3e7db0. Raises: session limits as exact-length time bars; completed states stamp rather than vanish; persona controls rewrite the billing line live.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
