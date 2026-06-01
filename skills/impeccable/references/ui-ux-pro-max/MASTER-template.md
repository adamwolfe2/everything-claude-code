# {Project Name} — Design System MASTER

> Persistent design tokens for `{Project Name}`. This is the Global Source of Truth.
> Per-page overrides live in `design-system/pages/{page-name}.md` and take precedence.
> Re-derive (don't memorize) by re-running the design-system search if context drifts.

## 1. Product Context

- **Product type**: {Entertainment / Tool / Productivity / SaaS / E-commerce / Service / Healthcare / Fintech / Beauty}
- **Industry**: {industry}
- **Target audience**: {C-end / B-end + age / context}
- **Tone keywords**: {playful, vibrant, minimal, dark, content-first, immersive, professional, ...}
- **Stack**: {react / next / react-native / vue / svelte / astro / flutter / swiftui / ...}
- **Density**: {airy / balanced / dense}

## 2. Visual Style

- **Primary style**: {minimalism / glassmorphism / neumorphism / brutalism / skeuomorphism / claymorphism / aurora / editorial / ...}
- **Secondary accents**: {bento-grid, gradient-mesh, noise-overlay, ...}
- **Anti-patterns to avoid**: {list from ui-reasoning.csv}

## 3. Color Tokens

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `--bg` | `#______` | `#______` | Primary surface |
| `--bg-elevated` | `#______` | `#______` | Cards, modals |
| `--fg` | `#______` | `#______` | Primary text (>=4.5:1) |
| `--fg-muted` | `#______` | `#______` | Secondary text (>=3:1) |
| `--border` | `#______` | `#______` | Dividers (visible in both modes) |
| `--accent` | `#______` | `#______` | Primary brand/CTA |
| `--accent-fg` | `#______` | `#______` | Text on accent |
| `--success` | `#______` | `#______` | |
| `--warning` | `#______` | `#______` | |
| `--danger` | `#______` | `#______` | |

Source palette: `colors.csv` row(s): {ids}

## 4. Typography

- **Heading family**: {font + weights} — Google Fonts: {url}
- **Body family**: {font + weights}
- **Mono family**: {font, if used}
- **Type scale** (rem): 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25 / 3 / 3.75
- **Line height**: tight 1.1 / normal 1.5 / relaxed 1.625
- **Tracking**: display -0.02em / body 0 / caps +0.05em
- Source pairing: `typography.csv` row(s): {ids}

## 5. Spacing & Layout

- **Spacing rhythm**: 4/8 base — 4, 8, 12, 16, 24, 32, 48, 64, 96
- **Section spacing tiers**: 16 / 24 / 32 / 48
- **Radius scale**: 0 / 4 / 8 / 12 / 16 / 9999 (pill)
- **Container max-widths**: sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536
- **Gutters by breakpoint**: mobile 16 / tablet 24 / desktop 32+

## 6. Elevation & Effects

- **Shadow scale**: sm / md / lg / xl — {token values}
- **Blur**: backdrop-blur-{value} for glass surfaces
- **Borders**: 1px solid `--border` default; 2px for emphasized states

## 7. Motion

- **Easing**: standard `cubic-bezier(0.4, 0, 0.2, 1)`; emphasized `cubic-bezier(0.2, 0, 0, 1)`
- **Durations**: micro 150ms / standard 200-300ms / large 400-500ms
- **Exit faster than enter**: yes
- **Respect `prefers-reduced-motion`**: required

## 8. Iconography

- **Library**: Phosphor (`@phosphor-icons/react`) primary; Heroicons fallback
- **Size tokens**: icon-sm 16 / icon-md 20 / icon-lg 24 / icon-xl 32
- **Stroke**: 1.5px consistent within layer
- **Style discipline**: outline OR filled per hierarchy level — never mix at same level
- **No emoji as structural icons**

## 9. Components (high-level)

- **Buttons**: variants {primary / secondary / ghost / danger}; sizes {sm / md / lg}; minimum tap target 44×44
- **Forms**: labels above, inline validation, error text below, focus ring required
- **Cards**: `--bg-elevated` + `--border` or shadow-md; rounded-lg
- **Navigation**: {top / side / bottom-tab} — max 5 items in bottom nav

## 10. Accessibility Floor

- Body text contrast >=4.5:1 (both themes)
- Secondary text >=3:1
- Color is never the only indicator
- Reduced-motion + Dynamic Type sizes pass without layout break
- All interactive controls labeled; focus order matches visual order

## 11. Page Overrides (links)

- `design-system/pages/landing.md`
- `design-system/pages/dashboard.md`
- `design-system/pages/settings.md`
- (Add as created — page files override these tokens.)

---

## Hierarchical Retrieval Prompt (copy when building a page)

> I am building the **{Page Name}** page. Read `design-system/MASTER.md`.
> Also check `design-system/pages/{page-name}.md`.
> If the page file exists, prioritize its rules. Otherwise use MASTER exclusively.
> Now generate the code.
