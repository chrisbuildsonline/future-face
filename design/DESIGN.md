# Future Face — design system

Reference board: 8 Dribbble skincare shots in `design/refs/` (reference only, never shipped).
What we take from them, and what we leave:

| Ref | Take | Leave |
|---|---|---|
| 01 Skiny (Korsa) | soft grey canvas, chip row with a black selected pill, product cards | yellow accent, dark header block |
| 04 SkinLab | warm cream canvas, before/after split with a round `‹ ›` handle, ring progress | heavy photo-over-text banners |
| 05 Daily Routine (BN Digital) | serif display with an *italic* accent word, one huge serif number ("78"), lots of air | full-bleed purple gradient |
| 06 / 08 (Sheikh Raihan, Naiem Islam) | huge sans numbers in white cards, white "row" button with a black round arrow, tinted ring charts | three accent colours on one screen |
| 07 AlgoGlow | editorial landing: one big centered headline, one line, one action, one strong visual, then calm sections | stock photography |
| 02 / 03 | tinted status chips | medical framing, glassy blue |

Direction in one line: **warm editorial skincare.** A cream-grey canvas, white cards that float, a serif
display face for titles and numbers, a quiet sans for everything else, near-black pills for the one
action, and a single sun-clay accent that only ever means "selected, linked, or the SPF future".

---

## 1. Tokens

All tokens live as CSS variables in `app/globals.css`. Never hard-code a colour or radius in a component.

### Colour

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#F1EEEA` | page background (the house `#eef0f4`, tuned warmer for skin) |
| `--canvas-deep` | `#E8E3DD` | wells inside the canvas (hero glow edge, footer rule) |
| `--surface` | `#FFFFFF` | every card; floats on the canvas, never on another white card |
| `--surface-sunk` | `#F7F5F2` | insets *inside* a card (track of a slider, chip on white) |
| `--ink` | `#17140F` | titles, numbers, the primary pill |
| `--ink-2` | `#6B655E` | secondary text, captions (5.8:1 on white) |
| `--ink-3` | `#A49D95` | decoration only: axis ticks, the "as you live now" bar series (2.6:1, never for text) |
| `--hairline` | `rgba(23,20,15,.08)` | the only line colour; dividers inside a card |
| `--accent` | `#BF4F28` | **the one accent ("sun clay")**: links, selection, focus ring, the "with daily SPF" series, active horizon (4.8:1 on white) |
| `--accent-soft` | `#F6E2D8` | tint behind accent text (selected chip, API pill) |
| `--accent-glow` | `#F4D3BF` | the sun glow in visuals only |

Status pills use tints, not new accents:

| Pill | Background | Text | Example |
|---|---|---|---|
| neutral | `#ECE7E1` | `--ink-2` | "Demo face", "+20 yrs" |
| accent | `--accent-soft` | `--accent` | "AI Skin Simulation", "Selected" |
| good | `#E2EEE4` | `#2E6A43` | "Low UV" |
| watch | `#F7EBCF` | `#87590F` | "High UV" |

Charts: two series only. "As you live now" bars = `--ink-3`, "With daily SPF" bars = `--accent`. No third
colour. Numbers for the two series are `--ink` and `--accent` (text never uses `--ink-3`).

### Type

- **Display: Instrument Serif** (400, regular + italic) via `@fontsource/instrument-serif`. Titles,
  section heads, and every large number. The italic is used for exactly one accent word per title
  ("Meet yourself in 30 years. *Twice.*").
- **UI/body: Manrope Variable** (`@fontsource-variable/manrope`, 400–700). Everything else.
- Numbers in Manrope use `font-variant-numeric: tabular-nums`.

| Token | Desktop | Phone | Font / weight / tracking |
|---|---|---|---|
| `--t-display` | 104px / 0.95 | 56px / 0.98 | serif 400, -0.02em |
| `--t-h2` | 60px / 1.0 | 40px / 1.04 | serif 400, -0.015em |
| `--t-number-xl` | 120px / 0.9 | 72px | serif 400 (the measured line: "58 vs 71") |
| `--t-number` | 56px / 1 | 44px | serif 400 (stats, UV value) |
| `--t-h3` | 21px / 1.3 | 19px | sans 650, -0.01em |
| `--t-lead` | 20px / 1.55 | 17px / 1.55 | sans 450, `--ink-2` |
| `--t-body` | 16px / 1.6 | 16px | sans 450 |
| `--t-small` | 14px / 1.5 | 14px | sans 500 |
| `--t-micro` | 12px / 1.3 | 12px | sans 600, +0.02em (pills, axis labels) |

Max line length 60ch for body, 22ch for display.

### Radius, shadow, spacing

- Radius: `--r-card: 20px` (all floating cards), `--r-inner: 14px` (images and insets inside a card),
  `--r-pill: 999px` (buttons, chips, pills).
- Shadow: one family, warm-tinted, soft.
  - `--shadow-card: 0 1px 2px rgba(40,28,16,.04), 0 18px 40px -18px rgba(40,28,16,.16)`
  - `--shadow-float: 0 2px 4px rgba(40,28,16,.05), 0 30px 60px -24px rgba(40,28,16,.28)` (chips that
    overlap a card edge, the slider handle, the bag sheet)
  - No borders on cards. A card is separated from the canvas by colour and shadow only.
- Spacing scale (4px base): `4 8 12 16 24 32 48 64 96 128`. Section gap `--s-section: 128px` desktop,
  `88px` phone. Card padding 32px desktop, 24px phone. Page gutter 48px desktop, 20px phone.
  Content max width 1200px.

### Buttons and controls

- **Primary pill** (one per screen): `--ink` background, white text, 56px tall (60px on phone),
  padding 8px 8px 8px 28px, label in sans 600 16px, and a 40px white circle on the right holding an
  arrow in `--ink`. Hover: arrow nudges 3px right, background lifts to `#2A2620`. Phone: full width.
- **Secondary**: text link in `--ink` with a 1px underline offset 4px; or a white pill with
  `--shadow-card` when it sits on the canvas.
- **Segmented control** (horizon `+20 / +30 yrs`): `--surface-sunk` track, `--r-pill`, selected
  segment is a white pill with `--shadow-card` and `--ink` text; unselected `--ink-2`.
- **Focus**: `:focus-visible` = 3px `--accent` ring at 3px offset on every interactive element.
- Touch targets ≥ 44px.

### Motion

- Ease: `--ease: cubic-bezier(.2,.7,.2,1)`. Durations: 160ms (hover), 320ms (state), 700ms (entrance).
- Entrance: hero copy and visual fade up 16px, staggered 80ms. Nothing else animates on load.
- The slider handle eases to the dragged position; on first view it does one 1.2s demo sweep
  (60% → 40% → 50%) to teach the gesture.
- Anchor scroll is CSS `scroll-behavior: smooth`.
- `prefers-reduced-motion: reduce` turns all of this off (no sweep, no fade, instant scroll).

---

## 2. Components

- **Card**: white, `--r-card`, `--shadow-card`, padding 32/24. Cards sit on the canvas in a grid with
  24px gaps. Never a card inside a card; inner groups use `--surface-sunk` insets with `--r-inner`.
- **Pill / chip**: 28px tall, 12px side padding, `--t-micro`, tinted per the status table. Optional 6px dot.
- **Floating chip**: white pill with `--shadow-float` that overlaps a card edge by ~24px; used sparingly
  (max two per visual) to give depth, as in refs 06 and 08.
- **Stat**: big serif number (`--t-number` or `--t-number-xl`) over a `--t-small` `--ink-2` label.
- **Citation popover**: a small "ⓘ Source" chip next to each intensity; opens a white card
  (`--shadow-float`, 320px) with the paper, the effect size used, and a "Read the trial" accent link.
  Closes on outside click and Esc; focus returns to the chip.
- **UV card**: white card with a semicircle arc gauge (0–11+), track `--surface-sunk`, filled part in
  `--accent`, a sun dot at the value, the value in `--t-number`, a tinted status pill (good/watch) and
  the city name.
- **Before/after slider**: one image frame with `--r-inner`; the "as you live now" render under, the
  "with daily SPF" render clipped on top; a 2px white divider and a 48px white round handle with `‹ ›`
  and `--shadow-float`. Corner tags as neutral pills: left "As you live now", right "With daily SPF".
  Keyboard: the handle is a `role="slider"` with arrow keys (5% steps) and Home/End.

---

## 3. Screens

### (a) Landing / upload

**Desktop (1440×900).**
- Nav row (72px): wordmark "Future Face" in serif 28px with a half-filled sun mark; right side
  "How it works" link and an accent tinted pill "YouCam Skin AI".
- Hero: 12-col grid, copy in cols 1–6, visual in cols 7–12, vertically centred in the first viewport.
  - Eyebrow neutral pill, then the display title on 3 lines with one italic accent word.
  - Lead (one supporting line, `--t-lead`, 46ch).
  - Primary pill "See your two futures" + one muted line under it.
  - Visual: a white card (aspect ~5:6) holding the **two-future mark** (`app/components/TwoFutureMark.tsx`):
    a sun arc (UV gauge, sun dot at ~72%) concentric with a skin-tone orb split by the slider handle;
    left half carries spots and grain ("as you live now"), right half is clean with a sheen ("with daily
    SPF"). An honest SVG illustration, not a render. Corner tags at the top (as in ref 04), the
    `+20 / +30 yrs` segmented control at the bottom centre. Two floating chips overlap its edges:
    the UV scale chip (bottom-left) and the citation chip (upper right). A soft `--accent-glow`
    radial behind the card.
- After the action (later feature): the upload step replaces the hero visual in place: a white card with
  a dashed `--r-inner` drop zone ("Drop a selfie" + "Use the demo face" secondary), a city combobox with
  type-ahead, and the primary pill "Show my two futures" disabled until both are set.
- `#how`: section head (eyebrow pill, h2 serif, lead), three step cards in a row (big serif step number
  in `--ink-3`, accent API pill, h3, body), then the evidence card spanning the row: title left, three
  big serif stats right, the full citation and a "Read the trial" link.
- Footer: one muted line with the disclaimer, fictional-product note, license.

**Phone (390×844).** One job: start.
- Nav 56px: wordmark + "How it works" text link.
- Title 56px on 2 lines ("Meet yourself in 30 years. / *Twice.*"), lead 17px, then the visual card full
  width (aspect 1:1, the SVG crops top and bottom; the two floating chips are dropped, the tags and
  horizon control stay inside the frame), then the primary pill full width, 64px tall. At 390×844 the
  pill lands at the bottom of the first viewport (thumb zone). It is also `position: sticky;
  bottom: 16px` inside the hero, so on shorter phones it stays pinned to the bottom until the user
  scrolls past the hero. The muted note under the pill is hidden on phone.
- Upload step (later): full screen; drop zone becomes "Take a selfie / Choose photo" (two large rows),
  city picker as a bottom sheet with search, primary pill pinned to the bottom.
- `#how`: section head stacks (desktop puts the lead in a right column), cards stack with a 16px gap;
  evidence stats become rows (44px serif number left, label right, hairline between rows).

### (b) Two-face result (the hero screen)

**Desktop.**
- Top bar: back link, the city + UV pill ("Lisbon · UV 8 · watch"), the horizon segmented control
  `+20 yrs | +30 yrs` centred, "Share" secondary on the right.
- Main grid 7/5:
  - Left (7 cols): the before/after slider card, image ~640px tall, corner tags, handle centred.
    Caption under it in `--ink-2`: "Illustrative projection, not a prognosis."
  - Right (5 cols), stacked cards:
    1. **The measured line** card: eyebrow "Read by AI Skin Analysis", then for spots, wrinkles,
       texture one row each: label, the two numbers in `--t-number-xl` serif ("71" in `--ink`,
       "vs", "58" in `--accent`), a two-series bar, and the "ⓘ Source" chip opening the citation popover
       with the intensity used. Footnote: "The model's reading of each render, 0–100."
    2. **UV card** for the city (gauge, value, status pill, "Peak 13:00–15:00").
  - Primary pill at the bottom of the right column: "Build my SPF routine".

**Phone.** One job: compare.
- Slider fills the width (aspect 4:5), horizon control floating on the image top, tags at the bottom.
- Under it, the measured line as a horizontal scroller of three stat cards (one concern each, numbers
  56px), then the UV card. Primary pill pinned to the bottom: "Build my SPF routine".

### (c) SPF routine + bag

**Desktop.**
- Title "Your routine for UV 8" with the city pill; lead explains the SPF level and reapply cadence.
- Three step cards in a row (Morning, Midday reapply, Evening), each with a product tile on
  `--surface-sunk` (fictional product, rendered bottle illustration, no brand logos), name, size,
  price, "why this step" line tied to the UV value, and an accent "Add" chip (selected = accent tint
  with a check).
- Right rail: the **bag** card (sticky): items, subtotal, primary pill "Checkout".

**Phone.** One job: add.
- Steps as a vertical list of full-width cards; each card's "Add" is a 44px round button.
- The bag is a bottom bar ("2 items · €46" + primary pill "View bag") that expands into a bottom sheet
  with `--shadow-float` and `--r-card` top corners.

---

## 4. Copy rules

Non-medical. Never: damage, risk, cancer, diagnosis/diagnose, prognosis, cure, treat/treatment,
disease. The only sanctioned exception is the disclaimer phrase "not a prognosis". Renders are an
"illustrative projection". Product names are fictional, no brand logos. All landing copy lives in
`lib/copy.ts` and is checked by `lib/copy.test.ts`.
