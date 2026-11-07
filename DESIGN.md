# Global Kids School Design System

## Typography
- Headers: 'Manrope', sans-serif (heavy, tight tracking, rounded feel)
- Body: 'DM Sans', sans-serif (high legibility, warm)

## Colors
- Deep Ink Teal: `#1A3B36`
- Forest Teal: `#2F6F68`
- Mint Soft: `#EBF5F2`
- Warm Coral / Saffron: `#E28743`
- Soft Saffron: `#FBD38D`
- Sky Blue: `#EBF2FA`
- Warm Background: `#FBFBFA`
- Dark Surface: `#162E2A`

## Design Directives
- **Anti-AI-Slop Measures**:
  - Avoid generic stock-photo grid cards.
  - Use deliberate editorial layouts: asymmetrical grids, clear typography hierarchies, rich textural backgrounds, bespoke badges.
  - Add micro-interactions: smooth pill tabs, sticky announcement header, custom-designed SVGs and illustrated markers instead of generic Lucide icon spam in plain square boxes.
  - Editorial spacing: generous breathing room (py-24, py-32), subtle border lines with low opacity.
  - Distinct school character: actual local context (Tumakuru, Karnataka, specific campus timings, real admissions steps).

## ERP dashboard — canonical direction (Step 0)

- **Light-first.** The ERP is being redesigned as a warm, light workspace
  ("Banyan"). Dark mode is deferred until the token layer can express both
  themes; a `.dark` class that has no tokens is not a theme.
- **No UI zoom.** The 1.1 `html` zoom is gone. Breakpoints are plain CSS pixels
  (1100 / 860 / 560); do not reintroduce `--ui-zoom` or pre-scaled thresholds.
- **Token names are the API.** Keep `--bg-*`, `--text-*`, `--border*`,
  `--brand*` stable: inline `var()` references in components must reskin from
  the token file alone, without touching screens.
- **No raw colour in components.** Hex and rgba values belong in the token
  layer, never in a screen or a dialog.
