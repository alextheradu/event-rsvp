---
name: RSVP
description: Dark, flat control panel for running Hack Club YSWS events.
colors:
  primary: "#ec3750"
  primary-dark: "#d12d41"
  surface-base: "#09090b"
  surface-raised: "#18181b"
  border: "#27272a"
  border-strong: "#3f3f46"
  text-strong: "#ffffff"
  text-body: "#a1a1aa"
  text-muted: "#71717a"
  text-faint: "#52525b"
  success: "#34d399"
  warning: "#fbbf24"
  danger: "#f87171"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.14em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
---

# Design System: RSVP

## 1. Overview

Plain dashboard, not a showcase. This is a control panel a host opens between other tabs to check
a number, flip a setting, or fire off a Slack message — every visit is task-driven and short.
Structure comes from spacing, dividers, and type weight, not from stacking things in boxes. It
explicitly rejects the generic-AI-dashboard look: no card-soup, no identical icon+heading+text
tiles repeated down the page, no purple gradients, no nested cards.

**Key Characteristics:**
- Flat at rest. Dividers and whitespace do the separating; cards are reserved for genuinely
  distinct objects (an attendee row, a stat tile, a clickable tool tile) — never for grouping
  form fields or settings.
- One accent color, used rarely: Hack Club red, for primary actions and the active nav state only.
- Dense text, small type. This is read by someone who already knows the domain; no hand-holding
  copy, no restated headings.

## 2. Colors

Near-monochrome zinc scale with a single red accent inherited from Hack Club's brand mark.

### Primary
- **Flamingo Red** (`#ec3750`): primary buttons, active tab underline, focus rings, links a host is meant to act on. Nothing else uses it — its rarity is the point.
- **Flamingo Red, Deep** (`#d12d41`): hover/active state for the above.

### Neutral
- **Void** (`#09090b`, zinc-950): page background.
- **Panel** (`#18181b`, zinc-900): the rare surfaces that are genuinely raised (stat tiles, attendee rows, the danger-zone block).
- **Hairline** (`#27272a`, zinc-800): dividers, input borders, the one structural line style used everywhere.
- **Hairline Strong** (`#3f3f46`, zinc-700): hover state of a hairline border, disabled control borders.
- **Ink** (`#ffffff`): headings only.
- **Body** (`#a1a1aa`, zinc-400): default body text.
- **Muted** (`#71717a`, zinc-600): secondary text, eyebrow labels, timestamps.
- **Faint** (`#52525b`, zinc-700/600 boundary): placeholder text, disabled labels.

### Named Rules
**The One Voice Rule.** Red appears on at most one element per screen at rest (the primary submit button or the active tab). Status is read through zinc-scale contrast and shape, not color-coding.

## 3. Typography

**Body Font:** Plus Jakarta Sans (system-ui fallback) — the only family in the system.

**Character:** A single grotesque doing all the work: weight and size carry hierarchy, not a second typeface.

### Hierarchy
- **Headline** (600, 1.875rem/1.2, -0.02em): event title at the top of a manage page. One per page.
- **Title** (600, 1.25rem): section headings ("Event settings", "Delivery history").
- **Body** (400, 0.875rem/1.6): all form fields, descriptions, list content. Caps at ~70ch where it wraps.
- **Label** (600, 0.6875rem, 0.14em tracking, uppercase): section eyebrows ("Configuration", "Run the event") and status chips. Always zinc-600, never colored.

### Named Rules
**The No-Restating Rule.** A Title is never followed by a sentence that just repeats it in prose. If a subtitle doesn't add new information, cut it.

## 4. Elevation

Flat by default. No box-shadows anywhere in the system — depth is conveyed by a single background
step (zinc-950 → zinc-900) and hairline borders, never by blur or shadow. Cards exist only for
things that are actually discrete objects a user scans as a list (an attendee, a stat, a linked
tool); settings, forms, and grouped preferences are laid out as plain sections separated by a
`border-t` divider and an eyebrow label, never boxed.

### Named Rules
**The Flat-By-Default Rule.** If you're about to wrap a group of form fields in a rounded panel, stop — use a divider and a label instead. Reserve the panel treatment for rows in a list.

## 5. Components

### Buttons
- **Shape:** 6px radius (`rounded-md` in Tailwind terms), never larger — buttons are controls, not hero CTAs.
- **Primary:** `background: #ec3750`, white text, `padding: 12px 20px`, 600 weight. Hover → `#d12d41`. No shadow.
- **Secondary/Ghost:** transparent or zinc-900 background, zinc-700 border, zinc-300 text; hover fills zinc-800 and text goes white.
- **Destructive:** red-400 text on transparent, hover tints red-500/10 background. Reserved for the danger zone only.

### Toggle rows (replaces "toggle cards")
- **Style:** a plain row — checkbox, then a two-line label (bold title + muted description) — separated from the row above/below by a hairline top border, not a background tile. Used for every on/off preference (RSVP open, public, verification, notification opt-in).

### Cards / Lists
- **Corner Style:** 12px radius (`rounded-xl`) where used at all.
- **Background:** zinc-900, no ring/border needed once a distinct background step exists — a ring is only added when the card sits directly on another zinc-900 surface and needs separation.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 16–20px.
- **Where used:** attendee rows, the 4-up stat strip, the three clickable tool tiles, the danger-zone block (it's a warning region, treated as one object).
- **Where NOT used:** wrapping a settings form, wrapping a group of toggle rows, wrapping the sidebar's "recent RSVPs" list container.

### Inputs / Fields
- **Style:** zinc-950/70 background, zinc-800 border, 8px radius.
- **Focus:** border shifts to zinc-600, 2px red ring at 20% opacity. No glow, no scale.

### Navigation
- **Style:** flat text tabs, zinc-500 default / white active, a 2px red underline on the active tab. No pill backgrounds, no icons.

## 6. Do's and Don'ts

### Do:
- **Do** separate settings groups with an eyebrow label + `border-t` divider, never a rounded panel.
- **Do** keep red to one element per screen: the primary action or the active tab.
- **Do** use plain toggle rows (checkbox + two-line label) for every preference, with no per-row background tile.
- **Do** reserve card/tile treatment for things that are actually a list of distinct objects (attendees, stats, tool links).

### Don't:
- **Don't** nest a card inside a card. If a "Configuration" panel wraps a form that itself has bordered toggle tiles, that's two levels too many — flatten to one.
- **Don't** repeat the same icon+heading+text tile pattern down a page — the generic-AI-dashboard tell.
- **Don't** use gradients, glassmorphism, or gradient text anywhere.
- **Don't** add a box-shadow. Depth is a background-tone step, never a shadow.
- **Don't** restate a section's heading as a sentence underneath it.
