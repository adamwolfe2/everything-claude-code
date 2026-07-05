# Universal Setup — Drop-in Kit

Portable convention set for any Adam repo. Built 2026-07-03 from evidence: 23-repo scan, 2,500 commits mined, 11 logged mistakes, 40-session token audit.

## Drop into a repo

1. Copy `CLAUDE.md.template` → repo root as `CLAUDE.md`. Fill the FACTS block (10 min, one time). Delete unused lines.
2. Copy `REVIEW_CHECKLIST.md` → repo `.claude/REVIEW_CHECKLIST.md`.
3. `CODING_STANDARDS.md` stays global (loaded via ~/.claude symlink). Do NOT copy per-repo; reference it.
4. Copy `settings.project.json` → repo `.claude/settings.json` if the repo has none.

## What lives where

| File | Scope | Why |
|---|---|---|
| CLAUDE.md.template | per-repo | facts differ per repo |
| CODING_STANDARDS.md | global | one convention set, zero duplication |
| REVIEW_CHECKLIST.md | global + per-repo copy | done-gate; repo copy allows additions |
| CONFIG.md | global | settings split rationale |
| skills/ | global (~/.claude/skills) | tasks repeat across repos |

## Skill map (failure mode → tool)

| Failure mode (Phase 2 rank) | Tool |
|---|---|
| 1 Auth gaps / sibling routes | `new-api-route` skill (new) + `logic-ripple` (exists) + `safe-feature-slice` (exists) |
| 2 Assumed-shape parsers | `integration-parser` skill (new) |
| 3 Build errors reach Vercel | REVIEW_CHECKLIST order: write-all → tsc → lint → test → build |
| 4 Timezone bugs | CODING_STANDARDS §Dates |
| 5 Unvalidated boundaries | `new-api-route` skill + CODING_STANDARDS §Validation |
| 6 Webhook fragility | `new-api-route` §webhook variant |
| 7 Copy-paste drift | CODING_STANDARDS §Canonical helpers |
| 8 Swallowed errors | REVIEW_CHECKLIST grep gate |
| 9 Migration patch chains | `database-migrations` skill (exists) |
| 10 Env drift on deploy | `env-sync` skill (new) |
