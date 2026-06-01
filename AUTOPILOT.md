# Autopilot Architecture

The closed-loop self-improving build system that sits on top of the everything-claude-code substrate.

## The five loops

```
                ┌──────────────────────────────────┐
                │                                  │
                ▼                                  │
   PLAN  ───►  EXECUTE  ───►  VERIFY  ───►  LEARN ─┘
   │                            │
   │                            │
   ▼                            ▼
   SAFEGUARD                   PROMOTE
   (scope, types, RLS,         (skill, rule, recipe
    safe-feature-slice)         via /evolve-skills)
```

| Loop | Mechanism | Substrate |
|---|---|---|
| PLAN | `planner` agent → slice specs in `.claude/specs/` | safe-feature-slice skill |
| EXECUTE | `tdd-guide` agent + slash commands | TDD workflow + slice spec |
| SAFEGUARD | `scope-check.js` hook + `safe-feature-slice` skill + `taste-lint.js` Stop hook | Hooks in `~/.claude/settings.json` |
| VERIFY | `/cap` preflight → `ship-verify.js` (CI + Vercel + URL) | `scripts/lib/ship-verify.js` |
| LEARN | `continuous-learning` extraction → `/digest` proposal → `/evolve-skills` measured promotion | `scripts/lib/telemetry.js` + `~/.claude/knowledge/` + `evals/` |

## The autopilot day

### Morning
1. `/morning-briefing` — see what needs attention across all 17 projects
2. `/dashboard` if you just want fast facts
3. `/health` weekly to catch broken MCPs / CLIs

### Starting work in a project
1. `/init` — load global + project CLAUDE.md, read MEMORY.md
2. `/onboard-project --audit` if first time in this project
3. `/decisions search "<topic>"` — recall prior cross-project decisions

### Building a feature
1. `/plan "<feature>"` — planner decomposes into slices
2. Each slice → spec written to `.claude/specs/YYYY-MM-DD-<slug>.md`
3. Tier-1 slices auto-trigger `safe-feature-slice` skill
4. `scope-check` hook warns if edits stray outside declared scope
5. `tdd-guide` writes failing tests first → implements → refactors
6. `code-reviewer` + `security-reviewer` (parallel) immediately after

### QA + ship
1. `/qa` — Codex CLI browser walkthrough
2. `/design-qa` for visual/a11y/perf gate on UI work
3. `/cap` — preflight → commit → push → ship-verify (CI green + Vercel ready + URL 200)
4. `compact-trigger` hook nudges `/compact` after push
5. `taste-lint` Stop hook flags any sloppy patterns at session end

### Adding to the knowledge base
- After a hard-won decision: `/decisions add "<title>"`
- These compound — every future project benefits from cross-project recall

### Weekly self-improvement
1. `/digest --since 7d` — see what worked, what didn't, what to promote/prune
2. Approved candidates land in `~/.claude/research-queue.md`
3. `/evolve-skills` picks the next candidate, mutates on a branch, runs the eval set, promotes on win or git-resets on loss
4. Successful promotions append to the decisions index automatically

## The eval set (the score gate)

Lives at `evals/tasks/`. Currently 4 frozen tasks (target: 14–20). Each is a known scenario with:
- prompt
- expected outcomes (boolean checks)
- scoring weights

`/evolve-skills` baselines main, mutates a candidate on a throwaway branch, re-runs the eval set, computes a composite score, and merges only if score improves by epsilon (default 0.02).

This is the autoresearch pattern: **git is memory, the metric is the judge.** No second agent, no second memory system.

## Telemetry

Everything writes to `~/.claude/telemetry.jsonl` via `scripts/lib/telemetry.js`. Read with `/stats`. Aggregated weekly by `/digest`.

Event types being logged:
- `session.start` / `session.end`
- `command.run` / `command.fail`
- `skill.fire`
- `cap.blocked` / `ship.fail`
- `scope.violation`
- `taste.findings`
- `compact.suggested`
- `evolve.win` / `evolve.loss`
- `briefing.run`

## Knowledge (cross-project)

Local-only at `~/.claude/knowledge/`. Decision files in `decisions/`. Index at `index.json`. Searchable via `/decisions search`.

Why local (not in AM Collective): every project on any machine using these dotfiles inherits this. No network dependency. No portability cost.

## The honest gap

This architecture **describes** the autopilot. The configs are in place. What still requires you (Adam) to wire up:

1. **Authenticate CodeRabbit** — 30 seconds, unblocks /cap's review step
2. **Authenticate Codex** — 30 seconds, unblocks /qa
3. **Run `/onboard-project` on each of the 17 projects** — gives every project the CLAUDE.md / PRODUCT.md / DESIGN.md / .claude/specs/ scaffolding
4. **Add 10+ more eval tasks** to `evals/tasks/` — the score gate needs more representation to be a real judge. Current 4 tasks is a starter set.
5. **Run `/schedule morning-briefing --at "09:00"`** to install the daily cron
6. **Run `/schedule digest --at "monday 10:00"`** to install the weekly digest cron
7. **First `/evolve-skills --dry-run`** to see the loop fire end-to-end before turning on `--apply`

After those steps, the autopilot runs. Without them, it sits idle.

## What this isn't

Not a replacement for thinking. The substrate makes mistakes cheaper, fixes faster, and patterns compound. It doesn't make decisions about what to build — that's still you. It just makes sure that once you decide, the build is fast, safe, scored, and recorded.

Not a Boris-Cherny-level system in week one. The autopilot improves with use. Empty telemetry = no signal. Empty eval set = no gate. Empty decisions index = no recall. The first month is bootstrapping; the compounding starts month two.

Not perfect. Read `/health` weekly. Things break.
