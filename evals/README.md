# Frozen eval set — the judge for harness evolution

`harness-evals.jsonl` is the metric that gates `/evolve-skills` and the `harness-evolve` workflow.

**The human writes the eval criteria. The metric is the judge. The agent doesn't ask permission to mutate — only to merge.**

## Format

One JSON object per line:

```json
{"id":"short-id","prompt":"what the user says","grader":"model|code","assert":"what a correct response must do"}
```

- `grader: model` — a model judges the response against `assert` (0/1).
- `grader: code` — `assert` is a shell snippet that exits 0 on pass (use for deterministic checks).

## Rules

1. **Evals are frozen during a mutation run.** A mutation that edits the eval file is rejected — that's gaming the metric.
2. **Add an eval whenever you log a mistake.** A new mistake class → a new regression eval so the harness can't relapse.
3. **Keep them fast.** Slow evals don't get run.
4. Composite score = % of evals passed. A mutation promotes only if it beats main with no regression.

## Growing the set

- After `/log-mistake`, add a regression eval for that bug class here.
- After `/digest` finds a recurring miss, add a capability eval.
- Target: 20–30 evals covering the routing table, hard stops, output discipline, and advanced-capability surfacing.
