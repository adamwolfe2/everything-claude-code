# ui-ux-pro-max — Integration Guide for `impeccable`

Harvested from `nextlevelbuilder/ui-ux-pro-max-skill`. This directory holds the **raw reference data** (CSVs + a MASTER template). `impeccable/SKILL.md` is unchanged — it can consult these on demand without taking on the Python CLI dependency the upstream skill ships with.

## What's in here

### Root CSVs (consult these by reading + filtering)

| File | Rows | Purpose |
|------|------|---------|
| `styles.csv` | ~67 UI styles | Style name, era, vibe keywords, example brands, CSS keywords, anti-patterns |
| `colors.csv` | ~161 palettes | Industry/product-type → palette (light + dark hexes, tone) |
| `typography.csv` | ~57 pairings | Heading + body font pairings, Google Fonts names, vibe |
| `google-fonts.csv` | full Google Fonts catalog | Lookup for weights/variants when picking a pairing |
| `charts.csv` | ~25 chart types | Trend / comparison / part-of-whole / distribution + library suggestion |
| `ux-guidelines.csv` | ~99 rules | UX best-practices keyed by category (animation, a11y, forms, nav, perf) |
| `ui-reasoning.csv` | ~161 rules | Product-category → which style/color/typography to prefer + anti-patterns |
| `products.csv` | product type recommendations | SaaS / e-commerce / portfolio / healthcare / beauty / service patterns |
| `landing.csv` | landing page structures | Hero variants, social-proof, pricing, testimonial blocks |
| `design.csv` / `draft.csv` | bulk design tokens / drafts | Larger merged knowledge tables |
| `icons.csv` | Phosphor + Heroicons | Recommended icons by semantic role |
| `app-interface.csv` | iOS/Android/RN a11y | accessibilityLabel, touch targets, safe areas, Dynamic Type |
| `react-performance.csv` | React/Next perf | Waterfall, bundle, suspense, memo, rerender, cache patterns |

### `stacks/` (15 tech-stack templates)

`react.csv`, `nextjs.csv`, `react-native.csv`, `vue.csv`, `nuxtjs.csv`, `nuxt-ui.csv`, `svelte.csv`, `astro.csv`, `angular.csv`, `html-tailwind.csv`, `shadcn.csv`, `laravel.csv`, `flutter.csv`, `swiftui.csv`, `jetpack-compose.csv`, `threejs.csv`. Each is implementation-specific guidance (component patterns, perf tips, navigation, lists) for that stack.

### `MASTER-template.md`

Per-project persistent design-token document. Use the **Master + Page Overrides** pattern (see below).

## When to consult these CSVs

The upstream skill exposes this routing table — keep it in mind, then pull the right CSV(s):

| User scenario | CSV(s) to consult |
|---------------|-------------------|
| New product / page brief | `ui-reasoning.csv` → `styles.csv` → `colors.csv` → `typography.csv` → `landing.csv` |
| "Recommend a style/palette/font for {industry}" | `ui-reasoning.csv` (for the rule), then the matching style/color/typography row |
| Picking chart types for a dashboard | `charts.csv` filtered by data shape (trend/comparison/distribution/part-of-whole) |
| UX review / a11y audit | `ux-guidelines.csv` + `app-interface.csv` |
| React / Next perf concerns | `react-performance.csv` |
| Stack-specific implementation | `stacks/{stack}.csv` |
| Dark-mode contrast / theming | `colors.csv` (dark column) + `ux-guidelines.csv` (contrast rules) |
| Icon discipline | `icons.csv` + the Icons & Visual Elements rules in `impeccable/SKILL.md` |

**Workflow inside `impeccable`:**

1. Extract product type, industry, tone keywords, stack from the request.
2. Read `ui-reasoning.csv` and filter rows matching product type + industry.
3. The reasoning rule will name a recommended style, palette family, typography pairing — pull those rows from `styles.csv`, `colors.csv`, `typography.csv`.
4. If the task is a full page/system, also read `landing.csv` and `charts.csv` as needed.
5. If the task is a UX/a11y critique, read `ux-guidelines.csv` + `app-interface.csv`.
6. If the user named a stack, read `stacks/{stack}.csv` for implementation patterns.
7. Synthesize. Do not paste CSV rows raw — translate into tokens + reasoning.

## The MASTER.md + Page Overrides pattern

The upstream skill's strongest idea: every project gets a **persistent design-system document** so future sessions stay consistent.

**Layout** (inside the user's project repo):

```
design-system/
  MASTER.md              ← global tokens, style choice, anti-patterns
  pages/
    landing.md           ← overrides for landing only
    dashboard.md         ← overrides for dashboard only
    checkout.md          ← etc.
```

**Rules:**

- `MASTER.md` is the Global Source of Truth — colors, type scale, spacing, motion, components, a11y floor.
- `pages/{name}.md` lists **only the deltas** from MASTER for that page (e.g. checkout uses a tighter type scale and a reduced palette).
- When building a page, read MASTER **and** check for the page file. Page rules win where they overlap.

**When to create MASTER.md:**

- After the first design-system generation pass on a new project.
- When the user says "lock in the design system" or "make this consistent across pages".
- When the project is large enough that re-deriving tokens each session would cause drift.

Use `MASTER-template.md` as the scaffold. Fill in real values from the CSV lookups, then save it into the user's repo at `design-system/MASTER.md`.

**Per-page retrieval prompt** (paste into a fresh session):

> I am building the **{Page}** page. Read `design-system/MASTER.md`. Also check `design-system/pages/{page}.md`. If the page file exists, prioritize its rules. Otherwise use MASTER exclusively. Now generate the code.

## The 5-parallel-search generation flow

The upstream skill's `--design-system` command runs five lookups in parallel and merges them with `ui-reasoning.csv`. Replicate this manually inside `impeccable` for any "build me a design system" request:

1. **Product pattern** — `products.csv`, match product type + audience.
2. **Style** — `styles.csv`, filter by tone keywords + product type.
3. **Color** — `colors.csv`, filter by industry/product type.
4. **Typography** — `typography.csv`, filter by vibe (playful, professional, editorial, etc.).
5. **Landing/structure** — `landing.csv`, filter by page intent (hero-centric, social-proof-heavy, pricing-led).

Then apply `ui-reasoning.csv` as the **arbiter**: if a reasoning rule prefers a specific style/palette for the product category, that rule wins over a weak keyword match. Emit:

- Recommended pattern, style, palette, typography
- Effects (glass/gradient/noise) + radius scale
- **Anti-patterns to avoid** (always — pull from the reasoning row)

Output format: a structured Markdown block matching `MASTER-template.md`, ready to save.

## Output discipline

- No emoji in code or token files (project rule).
- Always include anti-patterns alongside positive recommendations.
- Always include dark-mode tokens, not just light.
- Always cite which CSV row(s) drove the choice — makes the reasoning auditable.

## What we deliberately did NOT harvest

- `search.py`, `design_system.py`, `core.py` — Python CLI. `impeccable` reads the CSVs directly instead of shelling out.
- `_sync_all.py` — Notion sync, not relevant.
- `cli/` installer, `package.json`, `skill.json`, platform configs (`cursor.json`, `gemini.json`, etc.) — installer plumbing.
- The upstream `SKILL.md` text — `impeccable/SKILL.md` is canonical and stays unchanged.
