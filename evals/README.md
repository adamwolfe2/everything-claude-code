# Evals

Frozen eval set for `/evolve-skills`. Each task in `tasks/` is a known scenario with known-good outcome. Results land in `results/` as JSONL per run.

## Adding a task

1. Pick a representative slice of work (Tier-1 safety, design polish, build-fix, etc.)
2. Capture: prompt, fixtures, expected outcomes, scoring weights
3. Manually verify the baseline passes on `main`
4. Commit task + fixtures together

## Why these tasks

The eval set is the score gate. If a task is easy and arbitrary, the gate is noise. If it's hard and representative, the gate is gold.

Aim for:
- 4 Tier-1 safety tasks (money, auth, RLS, webhook)
- 3 design tasks (impeccable register: brand + product)
- 3 build-error tasks (TS + Next.js + dependency)
- 2 taste tasks (catches things hooks should warn about)
- 2 cross-project decisions tasks (decisions index recall)

That's 14 total. Aim to grow to 20 over time.

## Scoring weights (default)

```
composite = 0.35 * first_try_pass
          + 0.20 * (1 / token_spend_normalized)
          + 0.20 * ship_verification_pass
          + 0.15 * taste_lint_clean
          + 0.10 * coverage_delta
```

Tweak per-task in `scoring:` if a metric dominates inappropriately.
