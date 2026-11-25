---
name: Greenroom
description: A rehearsal programme for high-stakes speaking, printed in masthead yellow and ink.
colors:
  masthead: "#f2c230"
  masthead-deep: "#d9a80f"
  on-masthead-muted: "#4d3d06"
  ink: "#141414"
  ink-soft: "#3a3a36"
  muted: "#5e5e58"
  disabled: "#9a9a93"
  placeholder: "#6a6a63"
  hover: "#f3f3ee"
  press: "#f0f0ea"
  ink-hover: "#2c2c2a"
  rule: "#dcdcd4"
  leader: "#a3a39b"
  paper: "#fbfbf9"
  sheet: "#ffffff"
  ok: "#2f7d4f"
  bad: "#b3261e"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 62"
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 850
    lineHeight: 0.95
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 62"
  headline-billing:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 850
    lineHeight: 1
    fontVariation: "\"wdth\" 62"
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "\"wdth\" 62"
  title-act:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "\"wdth\" 62"
  body-large:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\" 1"
  ui:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.45
  input:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  small:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.12em"
  stamp:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 800
    letterSpacing: "0.12em"
    fontVariation: "\"wdth\" 75"
  code:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.92em"
    fontWeight: 400
rounded:
  bar: "0"
  stamp: "0"
  control: "0"
  pip: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
  xl: "40px"
  page-top: "44px"
  page-x: "56px"
  page-x-compact: "32px"
components:
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "#f0f0ea"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#2c2c2a"
  button-danger:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.bad}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-disabled:
    backgroundColor: "{colors.sheet}"
    textColor: "#9a9a93"
  link:
    textColor: "{colors.ink}"
    typography: "{typography.small}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  segmented:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "7px 15px"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  rail:
    backgroundColor: "{colors.masthead}"
    textColor: "{colors.ink}"
    width: "232px"
    padding: "28px 18px 18px"
  rail-item:
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.control}"
    padding: "9px 10px"
  rail-item-hover:
    backgroundColor: "{colors.masthead-deep}"
  rail-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.masthead}"
  tab:
    textColor: "{colors.muted}"
    typography: "{typography.ui}"
    padding: "0 0 12px"
  tab-active:
    textColor: "{colors.ink}"
  cast-item:
    textColor: "{colors.ink}"
    typography: "{typography.input}"
    padding: "11px 8px"
  cast-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.masthead}"
  stamp:
    textColor: "{colors.ink}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "2px 8px"
  stamp-ok:
    textColor: "{colors.ok}"
  stamp-bad:
    textColor: "{colors.bad}"
  stamp-pending:
    textColor: "{colors.muted}"
  billing-card:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "22px 26px 24px"
  notice:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "20px 24px"
  time-bar:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.bar}"
    height: "14px"
  time-bar-fill:
    backgroundColor: "{colors.masthead}"
---

# Design System: Greenroom

## Overview

**Creative North Star: "Tonight's Programme"**

Every practice session is a performance, and Greenroom is the printed programme you hold before the curtain. The system borrows from theatre programmes: a full-height masthead-yellow rail carrying a stacked, condensed GREEN/ROOM wordmark; ink-black type on cool white page stock; ink rules that divide content into acts, cast lists, and billings; dot leaders that run from a name to its role. The app deliberately avoids the category default, a grey dark dashboard with one neon accent.

Density is calm and scannable. A single user operates it between other tasks and minutes before a real interview, so every page answers three questions at a glance (are the keys ready, who is the interviewer tonight, what may a session cost) and every change is one click and visibly saved. Colour carries meaning only twice: yellow means the programme itself (rail, selection, filled running time), and green/red appear only where a state is good or bad.

The world is flat paper. Depth comes from ink: 1.5px outlines, solid-ink selected states, and heavier 3px rules where the masthead closes. Motion is short and printerly: an underline that draws in, a billing line that settles into focus as it is rewritten.

**Key Characteristics:**

- Masthead-yellow rail (232px) owns the full window height; content sits on cool white paper.
- Archivo Variable on its width axis: condensed (wdth 62) heavy uppercase for wordmark and titles, normal width for every UI string.
- 1.5px ink outlines on every control; selection is solid ink, never a tint.
- Programme devices are functional: dot leaders, acts, cast lists, billing card, stamps, running-time bars.
- States stamp rather than vanish.

## Colors

Two printing inks on white stock: masthead yellow and near-black, with green and red held back for state.

### Primary

- **Programme Masthead Yellow** (`masthead`): fills the whole nav rail, the running-time bar fill, the mic level meter, text selection, and the focus halo on inputs. On solid-ink selected states it becomes the text colour (active rail item, selected cast member).
- **Pressed Masthead** (`masthead-deep`): hover wash for rail items and the hover colour of link underlines. Never a resting fill.
- **Masthead Shadow Text** (`on-masthead-muted`): secondary text printed on yellow (the date under the wordmark, readiness state labels).

### Neutral

- **Programme Ink** (`ink`): all primary text, every control outline and rule, solid selected states, primary buttons, the focus outline.
- **Soft Ink** (`ink-soft`): ledes, field labels, act descriptions, notice body text, units and cost lines.
- **Faded Ink** (`muted`): hints, inactive tabs, act numbers, pending stamps.
- **Hairline Rule** (`rule`): 1px row dividers inside lists (acts, keys, cast) and the disabled-control outline.
- **Leader Dots** (`leader`): the 2px dotted dot leaders between a name and its role.
- **Page Stock** (`paper`): the content background. Cool white, never cream.
- **Sheet** (`sheet`): the brighter white of things laid on the page: controls, the billing card, notices, bar tracks.

### Status

- **Works Green** (`ok`): stamps that confirm success ("Works", "Keys set").
- **Rejected Red** (`bad`): failure stamps, danger buttons, warning text, the readiness pip of a rejected key.

### Named Rules

**The Two Inks Rule.** Yellow and ink do all the work. Yellow marks the programme (rail, fills, selection, focus); ink marks structure and choice. No third accent hue exists.

**The Earned Colour Rule.** Green and red appear only where a state is genuinely good or bad. Never use them for decoration, category, or emphasis.

**The White Stock Rule.** Backgrounds are cool white (`paper`, `sheet`). Never cream, beige, or grey-dark.

## Typography

**Display Font:** Archivo Variable at wdth 62 (with system-ui, sans-serif)
**Body Font:** Archivo Variable at wdth 100 (with system-ui, sans-serif)
**Label Font:** Archivo Variable; stamps at wdth 75

**Character:** One self-hosted variable family (`@fontsource-variable/archivo/wdth.css`) split by its width axis: the condensed, heavy uppercase cuts read like a playbill masthead, while normal-width text keeps controls plain and legible. Tabular numerals are on globally so minutes, costs, and dates align.

### Hierarchy

- **Display** (900, 3rem, 0.86, uppercase): the stacked GREEN/ROOM wordmark in the rail only.
- **Headline** (850, 2.75rem, 0.95, uppercase): one page title per page ("Settings", "Tonight's programme").
- **Headline Billing** (850, 2rem, 1, uppercase): the persona name heading the billing card.
- **Title** (800, 1.5rem, 1, uppercase): section titles, key provider names, the "Cast" heading.
- **Title Act** (800, 1.125rem, 1, uppercase): act titles in the programme list.
- **Body Large** (400, 1.125rem, 1.5): the live billing sentence; max 60ch, `text-wrap: pretty`. Plain `h2` headings (notice titles) use this size at 700, normal width.
- **Body** (400, 1rem, 1.45): ledes and running text; ledes cap at 62ch, act text at 60ch.
- **UI** (600, 0.9375rem): buttons, tabs, rail items, segmented options. Cast items use this size at 400 (700 when selected).
- **Input** (400, 0.9375rem): typed values in inputs and selects.
- **Small** (600, 0.8125rem): hints (at 400 in `muted`), links, readiness lines, cost and unit text.
- **Label** (700, 0.6875rem, 0.12em, uppercase): form field labels and legends, in `ink-soft`. The masthead subtitle uses the same cut at 0.14em.
- **Stamp** (800, 0.6875rem, wdth 75, 0.12em, uppercase): stamp text only.

### Named Rules

**The Width Axis Rule.** Condensed width (wdth 62) is reserved for uppercase heavy titles at 1.125rem and above. Anything a user reads as a sentence or clicks as a control is normal width.

**The One Family Rule.** Archivo is the only typeface. Hierarchy comes from width, weight, and case, not from a second family.

## Layout

A two-column shell: a fixed 232px yellow rail and a scrolling content column (`container-type: inline-size`). The rail stacks wordmark, a 3px ink rule, nav items, and key readiness pinned to the foot behind a 1.5px ink rule.

Pages are a single column of max 1040px, padded 44px top, 56px sides, 64px bottom, with 28px between page blocks. Forms use an 18px stack rhythm, 40px between major sections, and a two-column field grid (18px row, 24px column gap). The Interviewer tab splits into a 220px sticky cast list and a fluid editor with a 36px gutter.

Lists read as programme listings: a 1.5px ink rule opens the list, 1px hairline rules close each row. The acts list is a four-column grid (80px number, 140px title, text, stamp).

Responsive behaviour is driven by container queries on the content column. At 900px or narrower, page padding drops to 32px and act/limit rows collapse to three columns. At 640px or narrower, the cast/editor split and the field grid stack to one column, and key controls wrap. The minimum window is 800x600.

## Elevation & Depth

Flat. There are no drop shadows anywhere. Depth is printed: `sheet` white laid on `paper` white inside a 1.5px ink frame (billing card, notices, controls), and solid ink fills for selection. The only `box-shadow` in the system is a 4px masthead-yellow focus halo on inputs and an inset 3px yellow ring on a focused segmented option.

### Named Rules

**The Printed Depth Rule.** Lift is an ink frame, never a shadow. If an element needs to stand forward, give it `sheet` white and a 1.5px ink border.

## Shapes

Square. Every box is cut square: buttons, inputs, segmented groups, nav items, tabs, stamps, bars and framed cards have no radius. The only circles are the 9px readiness pips. Borders are the primary form device at three weights: 1.5px ink for outlines and list openers, 1px `rule` hairlines between rows, 3px ink to close the masthead. The 4px selected-tab underline is the heaviest line in content.

## Components

### Buttons

Outlined, plain, decisive.

- **Shape:** square corners, 1.5px ink outline, 8px 16px padding, UI type, no wrapping.
- **Primary:** solid ink with white text; hover deepens to near-ink. Used for the one committing action in a row (Save, Add keys).
- **Secondary:** white sheet with ink outline; hover washes to a pale warm grey.
- **Danger:** white sheet, red text and red outline. Destructive actions only (Delete, Remove).
- **Disabled:** one look for every variant: white, grey text, `rule` outline.
- **Focus:** 2px ink outline, 2px offset (global).
- **Link:** ink text, 1.5px underline at 3px offset; hover turns the underline `masthead-deep`.

### Stamps (signature)

Small condensed uppercase marks in a 1.5px `currentColor` border: "Saved", "Works", "Failed", "In production", "To do". Colour follows state: ink (neutral or done), `ok`, `bad`, or `muted` with a dashed border for pending or in-progress. A changing state swaps the stamp; it never disappears silently, so the user can trust a save happened.

### Inputs / Fields

- **Style:** white sheet, 1.5px ink outline, square corners, 9px 12px padding, full width. Number inputs cap at 140px.
- **Focus:** ink outline offset 1px plus a 4px masthead-yellow halo.
- **Label:** small uppercase tracked label above, 7px gap; optional hint below in `muted` small type.
- **Error:** inline `bad` small text beneath the field row; the field itself does not change colour.
- **Toggle:** native 18px checkbox tinted ink.

### Segmented Control

An ink-outlined strip of options divided by 1.5px ink rules; the active option is solid ink with white text; hover washes inactive options pale. Keyboard focus draws an inset ink outline with a yellow inner ring. Used for every enumerated persona setting.

### Navigation

- **Rail:** full-height masthead yellow. Items are 600-weight UI text, square; hover is `masthead-deep`; the current page is solid ink with yellow text.
- **Readiness foot:** one line per provider: a 9px ink-outlined pip (filled ink when a key is set, red when rejected), the provider name, and a right-aligned state in `on-masthead-muted`. Clicking opens Keys.
- **Tabs:** muted UI text over a 1.5px ink rule, 28px apart; the active tab turns ink and a 4px ink underline draws in from the left (320ms, expo-out).

### Cast List & Dot Leaders (signature)

Names joined to their role by a 2px dotted leader in `leader` grey, baseline-aligned. Used for the cast list (persona to voice), key rows (provider to source), the billing head, and the Home billing lines. A selected cast item is solid ink with yellow text and yellow leader dots.

### Billing Card (signature)

A square, ink-framed white card: condensed persona name, dot leader, "voiced by" voice, then the persona described as one sentence in Body Large. The sentence rewrites live as controls change and settles in with a 380ms blur-to-sharp fade.

### Notice

A square, ink-framed white strip: stamp at the top left, a bold h2 and soft-ink body, primary button on the right. Used for readiness problems on Home.

### Running-Time Bar (signature)

Session limits drawn at exact length on a fixed 180-minute scale: a 14px white track in a 1.5px ink frame, ticked every 15 minutes, filled with masthead yellow up to the limit and closed with an ink edge. Width animates over 320ms. The mic level meter uses the same track and fill.

## Do's and Don'ts

### Do:

- **Do** give the rail, and only the rail, a full masthead-yellow field.
- **Do** outline every control in 1.5px ink and show selection as solid ink (white or yellow text).
- **Do** set page, section, and act titles in condensed (wdth 62) heavy uppercase, and all other text at normal width.
- **Do** connect a name to its value with a dot leader where the content is a listing.
- **Do** mark state changes with a stamp (Saved, Works, Failed, In production) rather than removing the old state.
- **Do** draw session limits as exact-length bars on a fixed scale, with the cost written beside them.
- **Do** honour `prefers-reduced-motion`: every animation and transition is switched off.

### Don't:

- **Don't** build a grey dark dashboard with a single neon accent; that is the category default this world refuses.
- **Don't** use cream, beige, or warm off-white backgrounds; page stock is cool white.
- **Don't** use drop shadows for depth; frame with ink instead.
- **Don't** use green or red outside a real good or bad state.
- **Don't** introduce a second typeface or set controls in the condensed width.
- **Don't** round any box. Corners are square everywhere; the only circles are the readiness pips.

## Additions after the first build

- **Code:** literal commands the user must type (e.g. the Claude Code install line) use the system monospace on a `press` tint. Only for real commands, never as decoration.
- **Session layout:** a 220px sticky act list (Act I, II… with Done/Ready/Later stamps) beside the phase. The current act is solid ink with masthead-yellow text. Under a 640px content width the acts become a wrapping strip of outlined chips.
- **Score bars:** five square cells, filled masthead yellow up to the score, ink outline.
- **Replay scrubber:** the running-time bar drawn as a range input: ink frame, ticks every tenth, yellow fill to the playhead, a thin ink thumb.
- **Trend chart:** white sheet in an ink frame, rule-grey gridlines, a dashed line at 3 (the hire bar), ink polyline, square yellow points.
- **Choice rows:** radio rows separated by hairlines; the chosen row is a white sheet with an ink frame.
- **Findings:** one fix per row under an ink rule (3px for "Work on this first"): kind stamp, criterion label, a dashed Recurring stamp, the habit in muted small text; then the quote struck through in red → the better version in bold, the rule below, and text links (Hear it, Discuss, Drill this).
- **Coach panel:** a full-height white sheet pinned to the right (440px), separated by one 1.5px ink rule on its left edge, no shadow and no backdrop; it doesn't block the page. Condensed COACH title and a Close link; the pinned finding under a hairline; a scrolling chat (speaker in condensed caps above each turn); compose area under an ink rule with suggested questions as text links. On windows of 1240px and wider the page makes room for it; on narrower ones it sits over the report. Escape closes it unless a call is live, and focus returns to whatever opened it.
- **Voice calls tucked away:** optional calls (Talk instead, Say it out loud) start as one text link carrying the length and cost; the billing lines and Start appear only after it's clicked.
