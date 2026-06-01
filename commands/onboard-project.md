---
description: Audit the current project against Adam's canonical Claude Code template, then scaffold any missing pieces (CLAUDE.md, PRODUCT.md, DESIGN.md, .claude/specs/). Use at the start of work in any project that doesn't already conform.
---

# /onboard-project — Bring this project up to baseline

The global `~/.claude/CLAUDE.md` ships every project with agents, skills, commands, rules, and hooks. But each project needs a few local files so that project-aware skills (impeccable, safe-feature-slice, planner with slice decomposition, marketing skills) have what they need.

This command audits what's present, scaffolds what's missing, and reports.

## Arguments

`$ARGUMENTS` optional:
- `--full` — write CLAUDE.md, PRODUCT.md, DESIGN.md, and .claude/specs/README.md
- `--minimal` — write only CLAUDE.md
- `--audit` — report only; do not write
- (default = audit + ask before scaffolding any missing piece)

## Step 1 — Read project

In parallel:
- `package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` — stack + scripts
- `README.md` — project description
- `CLAUDE.md` — current config (if any)
- `.env.example` — required env vars
- `next.config.js` / `vite.config.ts` / etc.
- `tailwind.config.*` — color tokens
- `prisma/schema.prisma` / `drizzle/schema.ts` — data model

Skim 2–3 representative components / routes to infer conventions.

## Step 2 — Audit against the canonical template

For each of these, classify as **PRESENT / MISSING / STALE**:

| Artifact | Purpose |
|---|---|
| `CLAUDE.md` | Project context, conventions, scripts, env vars, references to PRODUCT/DESIGN |
| `PRODUCT.md` | Used by `impeccable`, `cro`, `launch`, `product-marketing` — users, brand, tone, ICP |
| `DESIGN.md` | Used by `impeccable` — colors, type, components |
| `.claude/specs/` | Slice and decision logs (gsd-style) |
| `.claude/specs/README.md` | Conventions for spec files |
| `AGENTS.md` | Optional agent overrides for this project |
| `.env.example` | Required env vars listed |

STALE = present but doesn't reference the global setup, or refers to deprecated agents/commands.

## Step 3 — Report

```text
/onboard-project Audit

Project: <name>
Stack: <inferred>
Branch: <git>
Last commit: <sha + subject>

Status:
- CLAUDE.md:        PRESENT / MISSING / STALE [reason]
- PRODUCT.md:       PRESENT / MISSING / N/A (non-customer-facing)
- DESIGN.md:        PRESENT / MISSING / N/A
- .claude/specs/:   PRESENT / MISSING
- .env.example:     PRESENT / MISSING / OUT OF SYNC

Recommendations:
- [scaffold this]
- [update this]
- [delete this — refers to nonexistent agent]

Run with --full to scaffold all missing artifacts, or --minimal for just CLAUDE.md.
```

## Step 4 — Scaffold (if confirmed)

Use these templates as starting points. Read the project deeply first — these are NOT generic; they should be tailored.

### CLAUDE.md template

```markdown
# <Project Name>

<one-line description>

## Stack
- <framework>, <language>, <DB>, <auth>, <payments>, <key 3rd-party>

## Scripts
- `<pm> dev` — local dev
- `<pm> test` — tests
- `<pm> build` — production build
- `<pm> typecheck` — type check
- `<pm> lint` — lint

## Conventions
<extracted from existing code — file structure, naming, error patterns>

## Environment
See `.env.example`. Required:
- VAR_NAME — purpose

## Domain Rules (Tier-1 invariants)
<money, permissions, ownership, state transitions — fill in or remove>

## References
- See global config: `~/.claude/CLAUDE.md`
- Design: `./DESIGN.md`
- Product: `./PRODUCT.md`
- Specs: `./.claude/specs/`

## Project-specific Overrides
<anything that diverges from global defaults>
```

### PRODUCT.md template (impeccable expects this)

```markdown
# <Product Name>

## What it does
<1-2 sentences>

## Who uses it
<persona, scale, expectation>

## Brand voice
<tone, formality, register: brand or product>

## Strategic principles
- <how this product wins>

## Anti-references
<things to NOT look or sound like>
```

### DESIGN.md template

```markdown
# <Product Name> Design

## Colors
<token list — primary, accent, surface, text, semantic>

## Typography
<heading font, body font, mono — sizes, weights>

## Spacing & layout
<scale, grid, breakpoints>

## Components
<key shadcn components used, custom patterns>

## Motion
<duration, easing, anti-patterns>

## Do / Don't
<bullets>
```

### .claude/specs/README.md

```markdown
# Specs

Per-slice decision logs. Each file = one slice. Naming: `YYYY-MM-DD-<slug>.md`.

## Sections in each spec
- Feature
- Primary actor
- Core invariant
- Unsafe outcomes
- Assumptions
- Tier (1/2/3)
- Tests required
- Status (proposed / building / shipped)
```

## Step 5 — Reference index

After scaffolding, write a 1-paragraph status update to `~/.claude/projects/-Users-adamwolfe/memory/MEMORY.md` or the project's detail file (whichever exists). Keep MEMORY.md index entries under 200 chars.

## Hard rules

- **Never** overwrite existing CLAUDE.md / PRODUCT.md / DESIGN.md without explicit confirmation
- **Never** write generic boilerplate — tailor every section to what the project actually is
- **Never** scaffold .agents/ or .gsd/ inside the project (we use .claude/specs/)
- If the project is one of Adam's known projects (TaskSpace, AIMS, TBGC, Cursive, Trackr, Wholesail, AIMS, Hook, CampusGTM, VendCFO, MyVSL, AMC, CreditOS, LeaseStack, MySLP), cross-reference the existing detail file at `~/.claude/projects/-Users-adamwolfe/memory/<project>.md` first — that file is the canonical source of truth

## Output

Print the audit + a numbered list of artifacts scaffolded + the next step (typically `/init` to re-load context).
