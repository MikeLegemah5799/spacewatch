# UI Context

## Theme

Dark only. No light mode. The design language is a "mission control"
dashboard — deep navy surfaces, hairline borders, monospace telemetry, and a
single neon-blue accent reserved for live/active states (next launch,
countdown, "GO" indicators) so it reads as a signal rather than decoration.

## Colors

All components must use these tokens — no hardcoded hex values. Defined as
CSS custom properties in `globals.css` (Tailwind v4 `@theme`); see
`spacewatch-tailwind-theme.css` for the full ramp and Tailwind v3 equivalent.

| Role                    | CSS Variable       | Value     |
| ----------------------- | ------------------ | --------- |
| Page background         | `--bg-base`        | `#06080f` |
| App surface             | `--bg-surface`     | `#0a0e1a` |
| Panel surface (raised)  | `--bg-surface-alt` | `#0e1424` |
| Table / list surface    | `--bg-surface-deep`| `#0d1322` |
| Primary text            | `--text-primary`   | `#eaf0fa` |
| Secondary text          | `--text-secondary` | `#8a96ad` |
| Muted text              | `--text-muted`     | `#5c6884` |
| Primary accent (neon)   | `--accent-primary` | `#3b9eff` |
| Accent, bright variant  | `--accent-bright`  | `#5bb0ff` |
| Border (default)        | `--border-default` | `#1b2740` |
| Border (soft/card)      | `--border-soft`     | `#18233c` |
| Border (accent/hero)    | `--border-accent`  | `#234779` |
| Success / "GO"          | `--state-success`  | `#34d399` |
| Warning / "TBD"         | `--state-warning`  | `#fbbf24` |

Additional effects used in the mockup — not colors, but part of the same
token set:

| Role                        | CSS Variable    | Value                                  |
| --------------------------- | --------------- | --------------------------------------- |
| Hero card glow              | `--shadow-glow` | `0 0 24px -8px rgba(59,158,255,0.35)`   |
| Outer card ring             | `--shadow-ring` | `0 0 0 1px rgba(59,158,255,0.08)`       |
| Countdown text glow         | `--glow-text`   | `0 0 18px rgba(59,158,255,0.55)`        |

## Typography

| Role       | Font              | Variable         |
| ---------- | ----------------- | ---------------- |
| Display    | Orbitron          | `--font-display` |
| UI / body  | Barlow            | `--font-sans`    |
| Code/mono  | JetBrains Mono    | `--font-mono`    |

Three-typeface system, each with a distinct job:

- **Display (Orbitron)** — wordmark, the "NEXT LAUNCH · T-MINUS" label, the
  countdown timer, section headers (e.g. "UPCOMING LAUNCHES"), and stat-card
  numbers. Reserved for moments that should read as telemetry/HUD, not prose.
  Orbitron has no true lowercase design, so it is never used for
  paragraph-length text or anything a user needs to read comfortably.
- **UI / body (Barlow)** — everything else: nav labels, mission names, table
  cells, descriptions, provider tags. Barlow's condensed, technical
  proportions pair with Orbitron's geometric angularity better than a
  neutral humanist sans (e.g. Inter) does, while staying legible at small
  sizes.
- **Mono (JetBrains Mono)** — dated/tabular values specifically: dates in
  table rows (NET column). Reserved for values that are literal data, not
  headline numbers (those use Orbitron) or prose (those use Barlow).

## Border Radius

| Context                          | Class          |
| --------------------------------- | -------------- |
| Badges / status pills             | `rounded-md`  (~5px) |
| Inline chips (provider tag)       | `rounded-md`  (~5px) |
| Cards / panels (stat cards, hero) | `rounded-xl`  (~10–12px) |
| Outer app frame                   | `rounded-2xl` (~14px) |
| Avatar (user initials)            | `rounded-full` |

## Component Library

Custom Tailwind components — no external UI kit. Shared primitives (status
pill, stat card, table row) live in `components/`. Use the existing
`spacewatch-tailwind-theme.css` tokens rather than introducing new colors
when adding components.

## Layout Patterns

- Top bar: fixed nav row with logo/wordmark, primary nav links, and
  search/notification/avatar icons on the right, separated by a bottom
  border (`--border-soft`).
- Dashboard: next-launch hero card (gradient background, accent border,
  glow shadow) at the top, followed by a 4-column stat-card grid, followed
  by a table-style list of upcoming launches.
- Tables/lists: header row in muted, letter-spaced small caps; body rows
  separated by `--border-soft` hairlines; status rendered as a pill, right
  aligned.
- Browser-chrome framing: dashboard screens are presented inside a simulated
  browser window (traffic-light dots + address bar) for mockups and
  marketing use — not part of the live app shell itself.

## Icons

Tabler Icons (outline only, `ti ti-*` classes) — e.g. `ti-rocket` for the
wordmark mark, `ti-search`, `ti-bell`, `ti-map-pin`, `ti-arrow-right`.
Stroke-based, no filled variants. Sizes: ~14–17px inline in nav/metadata,
~20–24px max for standalone decorative use.
