---
name: evolve-skills
description: The autoresearch-pattern keystone. Metric-gated git-backed mutation loop for skills, rules, and agents. Picks a candidate mutation, runs it against the frozen eval set, keeps the branch if composite score beats main, otherwise resets. This is how the setup compounds.
---

# /evolve-skills — Self-improving mutation loop

Inspired by Karpathy's autoresearch pattern: **git is the memory, the metric is the judge, the human writes the eval criteria, and the agent doesn't ask permission.**

This is the keystone that closes the LEARN loop. Without it, /digest, /learn, /prune, /evolve all produce suggestions that go nowhere. With it, suggestions become measured experiments that auto-promote on win.

## Pipeline (autoresearch pattern)

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
candidate ──► mutate (branch) ──► run eval set ──► gate
                                                    │
                                              composite score
                                                    │
                                    ┌───────────────┴───────────────┐
                                    │                               │
                              beats main?                       loses?
                                    │                               │
                                merge to                       git reset
                              ~/.claude/                       discard
```

## Arguments

`$ARGUMENTS`:
- `--from queue` (default) — read the next candidate from `~/.claude/research-queue.md` (populated by /digest, /learn, /prune)
- `--from "<description>"` — propose a specific mutation
- `--budget 10min` — max wall-clock per iteration
- `--iterations 1` (default), or `5` to chain
- `--dry-run` — produce the mutation but don't run the eval set
- `--verbose` — show full eval transcripts

## Eval set

Lives at `everything-claude-code/evals/tasks/`. Each task is a frozen scenario with known-good outcome. Structure:

```
evals/
  tasks/
    001-typescript-import-error.json    # build-error-resolver task
    002-clerk-protect-route.json        # security/auth task
    003-tier1-stripe-refund-slice.json  # safe-feature-slice task
    004-impeccable-hero-section.json    # design task
    005-empty-catch-block.json          # taste task
    ...
  results/                              # appended JSONL per run
    YYYY-MM-DD-evolve-<sha>.jsonl
```

Each task:
```json
{
  "id": "003",
  "title": "Tier-1 Stripe refund slice",
  "prompt": "Implement a /api/refunds POST endpoint that processes a refund...",
  "fixtures": "evals/fixtures/003/",
  "expected": {
    "tests_pass": true,
    "no_emoji": true,
    "no_console_log": true,
    "no_as_any": true,
    "uses_idempotency_key": true,
    "validates_amount_server_side": true,
    "audit_log_created": true
  },
  "scoring": {
    "first_try_pass": 10,
    "token_efficiency": 5,
    "test_coverage": 5
  }
}
```

## The composite score

```
composite = w1 * first_try_pass_rate
          + w2 * (1 / token_spend_normalized)
          + w3 * ship_verification_pass
          + w4 * taste_lint_clean_rate
          + w5 * coverage_delta
```

Default weights: w1=0.35, w2=0.20, w3=0.20, w4=0.15, w5=0.10.

## Execution

### Step 1: Pick candidate
Read next pending item from `~/.claude/research-queue.md`:

```
- [ ] Promote pattern "Drizzle staging branch before main" → new skill
- [ ] Rewrite clerk skill description (3 missed triggers)
- [ ] Tighten taste-lint rule: empty catch in webhook handlers (4 instances)
- [ ] Archive multi-execute command (0 uses, 30 days)
```

### Step 2: Baseline (run main on eval set)
- Checkout main (or current branch)
- Run all evals in `evals/tasks/`, save baseline scores to `evals/results/<date>-baseline.jsonl`

### Step 3: Mutate (on throwaway branch)
- `git checkout -b evolve/<slug>`
- Apply the mutation:
  - New skill: scaffold `skills/<name>/SKILL.md` from the pattern
  - Rewrite: edit the skill description / triggers
  - Tighten hook: edit `scripts/hooks/*.js`
  - Archive: `mv` to `archive/`

### Step 4: Run eval set on the mutated branch
- Same evals, capture new scores in `evals/results/<date>-evolve-<slug>.jsonl`

### Step 5: Gate
- Compute composite for baseline vs mutated
- If `composite_mutated > composite_baseline + epsilon`:
  - Merge branch into main: `git checkout main && git merge --no-ff evolve/<slug>`
  - Log to telemetry: `event=evolve.win`
  - Append to `~/.claude/knowledge/decisions/` with the rationale + numbers
- Else:
  - `git checkout main && git branch -D evolve/<slug>`
  - Log to telemetry: `event=evolve.loss`
  - Move candidate to `~/.claude/research-queue-failed.md` with score delta

### Step 6: Report
```
/evolve-skills Iteration <n>

Candidate: <title>
Branch: evolve/<slug>
Eval set: <n> tasks

Baseline composite: 0.682
Mutated composite:  0.741  (+0.059)

Winners:
  ✓ first_try_pass: 0.85 → 0.90
  ✓ taste_lint:    0.78 → 0.92
  ✗ token_spend:   1.2x baseline (small regression)

Decision: PROMOTE (merged to main)
Knowledge logged: 2026-06-01-drizzle-staging-promoted.md
```

## Hard rules

- **Eval set is frozen.** Tasks added to `evals/tasks/` MUST be reviewed manually. No auto-adding from sessions.
- **No mutation runs without `--apply` in human mode.** Cron mode (via `/schedule`) implies `--apply`.
- **Composite score MUST beat baseline + epsilon (default 0.02).** Ties go to baseline. Bias toward stability.
- **Each iteration logs a decision file** even on loss, so failed experiments are searchable later.
- **Iterations chain only if previous won.** First loss stops the chain.
- **Token budget per task: 50k.** Hard cap to prevent runaway.

## Tie-in to other commands

- `/digest --apply` queues PROMOTE candidates into `research-queue.md` → `/evolve-skills` runs them
- `/learn` extracts patterns → recurring ones (3+ sessions) get queued
- `/prune` flags 0-trigger skills → they go through `/evolve-skills` as ARCHIVE candidates (eval gate confirms removal doesn't hurt scores)
- `/health` reports if eval set is stale (no run in 7 days)

## What this replaces

This is what `/evolve` from ecc gestures at but doesn't ship. ecc's version is description-only. This one actually runs the eval, scores, and commits.

## Attribution

Pattern lifted from karpathy/autoresearch (single-file mutation, metric gate, git commit/reset). Adapted to skills/rules/hooks instead of training scripts. Eval criteria + scoring are project-specific.
