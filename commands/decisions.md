---
name: decisions
description: Search, add, or browse the cross-project decisions index. Local at ~/.claude/knowledge/decisions/. Use to ask "how have we solved X in any project?" before re-inventing.
---

# /decisions — Cross-project knowledge index

Persistent decisions log usable from any project. Lives at `~/.claude/knowledge/decisions/`. Searchable. Backed by `scripts/lib/knowledge.js`.

## Subcommands

### Search

```
/decisions search "drizzle migration"
/decisions search "stripe webhook idempotency" --project trackr
/decisions search "RLS policy" --tags neon,supabase
```

Runs:
```bash
node /Users/adamwolfe/everything-claude-code/scripts/lib/knowledge.js search "<query>"
```

Returns ranked decisions with slug, title, project, summary. Print the top 5, then offer to open the full file.

### Add

```
/decisions add "Use Drizzle staging branch before main migration"
```

Prompts (or accepts via flags) for:
- Title (≤80 chars, the search target)
- Project (or "global")
- Tags (comma-separated)
- Stack (e.g. ["nextjs", "drizzle", "neon"])
- Body (the actual decision, the rationale, the alternative considered, the trade-off)

Writes to `~/.claude/knowledge/decisions/YYYY-MM-DD-<slug>.md` with frontmatter and rebuilds the index.

### List

```
/decisions list
/decisions list --project cursive
/decisions list --tags stripe
```

Shows the index (`~/.claude/knowledge/index.json`).

### Rebuild

```
/decisions rebuild
```

Re-scans `~/.claude/knowledge/decisions/` and rebuilds the index. Run after manual edits.

## Decision file format

```markdown
---
title: Use Drizzle staging branch before main migration
project: trackr
date: 2026-04-15
tags: [drizzle, neon, migration, safety]
stack: [nextjs, drizzle, neon]
---

# Use Drizzle staging branch before main migration

## Context
Direct migrations on main broke prod twice. Both involved column type changes
that locked the table during a multi-second backfill.

## Decision
Always run migrations against a Neon branch first. Promote only after
a 30-minute soak. Use `neonctl branches create --parent main staging-mig-<sha>`.

## Trade-off
Adds 30 minutes to migration time. Worth it.

## Alternative considered
Migration-on-read with feature flags. Rejected: complexity outweighs benefit for our scale.

## Reference
- Migration that caused the incident: trackr/drizzle/2026-02-03-add-org-id-not-null.sql
- Neon docs: ...
```

## When to use

- Before starting a non-trivial slice — `/decisions search "<topic>"` first.
- After a hard-won decision — `/decisions add ...` so the next project benefits.
- During `/init` — search for project-relevant decisions to pre-load context.
- During `/onboard-project` — surface relevant decisions from sibling projects.

## Hard rules

- Decisions are immutable. To revise, add a new decision that references the old one ("Supersedes 2026-04-15-X").
- Title must be search-friendly (verbs, nouns the future you would search).
- Body must include: Context, Decision, Trade-off, Alternative considered. No exceptions.
- Never commit `.claude/knowledge/` into a project repo — it's user-level.
