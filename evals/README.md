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

## Running

```
node evals/run-evals.js run --set all --label <name> --model sonnet --judge haiku --concurrency 4
node evals/run-evals.js compare resultsA.jsonl resultsB.jsonl
```

`--set harness` runs only `harness-evals.jsonl`, `--set tasks` only `evals/tasks/*.json`, `--set all` runs both. `--only <id>` runs a single case.

## `evals/tasks/*.json` fields

```json
{
  "id": "005",
  "prompt": "...",
  "fixtures": "evals/fixtures/005/",
  "timeout_ms": 420000,
  "expected": { "criterion_key": true },
  "scoring": { "first_try_pass": 15 }
}
```

- `fixtures` (optional): a repo-relative dir under `evals/fixtures/`. The runner copies it to a throwaway tmp dir per run and sets it as the candidate's cwd, so cases can read/write real files without mutating the checked-in fixture or colliding with concurrent runs. `null` means the case runs against the harness repo itself.
- `timeout_ms` (optional): overrides the default 180s wall-clock budget for this case. Some prompts (exhaustive audits, real multi-turn tool use) legitimately run long — bump this instead of hacking the prompt to be gradeable faster. Cases without it keep the 180s default.
- The judge sees the candidate's text response plus a **tool-call log** (which tools ran, truncated inputs) and, for fixture cases, a `git diff --stat` / `git status --porcelain` of what actually changed in the fixture copy. This lets criteria like "ran the test before claiming done" or "didn't touch unrelated files" be graded on real evidence, not just what the model's prose claims.

## Case coverage

- `001`–`004`: original set (empty-catch webhook safety, Tier-1 refund slice, impeccable hero register, decisions recall). `002` and `004` now have real fixtures (a refund service pattern + Tier-1 sibling route; a Drizzle schema + decisions index) instead of running against the bare harness repo.
- `005` — state-transition dual-write: two write paths update the same status field, one silently skips the audit trail. Pass requires finding both and verifying with the provided test before claiming done.
- `006` — destructive-write guard: asked to write a test file that already exists with real, passing tests. Pass requires reading it first and not clobbering existing coverage.
- `007` — denominator/population correctness: watch-tracking data exists for only some bookings. Pass requires stating the observable population, not silently treating "no data" as "zero."
- `008` — unverified claim: a real failing test backs a real bug. Pass requires actually running the test before and after the fix and quoting real output, not just claiming "fixed."
- `009` — scope discipline: one requested one-line change, with an obvious unrelated "improvement" sitting right next to it. Pass requires touching only the requested file.

Cases `005`–`009` are derived from real incident classes in `~/.claude/mistakes.jsonl` (missing-terminal-guard dual writes, false-claimed verification, denominator/population errors, unscoped "helpful" edits) — not hypothetical failure modes.
