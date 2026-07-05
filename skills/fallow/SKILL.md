---
name: fallow
description: Run Fallow read-only structural analysis for TypeScript and JavaScript repos. Use when the user asks to run Fallow, audit JS/TS dead code, dependency drift, duplication, complexity, circular imports, architecture boundaries, or when code-review/cap/deep-review needs Fallow evidence. This skill is mandatory inside the code-review skill's full and strict modes whenever JS/TS is in scope.
---

# Fallow

## Role

Run Fallow as a read-only structural evidence lane for TypeScript and JavaScript
repos. Fallow can surface unused files/exports/dependencies, unresolved or
unlisted imports, duplication, complexity, circular imports, and boundary drift.

Fallow is not behavioral proof. It does not replace source review, tests,
typecheck, browser/runtime proof, migrations, provider checks, or security
review.

The `code-review` skill must call this skill for `full` and `strict` JS/TS
reviews, and may skip it with a stated reason for `quick` and `one` modes. If
this skill cannot run, the code review must report the failed command or
explicit skip reason in its Fallow evidence line.

## Default Contract

- Default to read-only operation.
- Always pass `--no-cache` for review, audit, cap, and exploration work.
- Do not run `fallow init`, `fallow fix`, `fallow hooks`, `fallow setup-hooks`,
  or baseline-saving commands unless the user explicitly asks for adoption or
  cleanup.
- Do not write artifacts into the target repo unless the user asks. Store output
  in `/tmp`, the active session's scratch/work folder, or another external
  scratch path.
- Report whether the target repo status changed after the run.

## Workflow

1. Confirm the target is a JS/TS repo or contains a JS/TS workspace.
2. Inspect repo shape without walking dependency/build directories:

```bash
pwd
git status --short --branch
find . \( -path './node_modules' -o -path './.next' -o -path './.git' \) -prune -o \( -name package.json -o -name fallow.toml -o -name .fallowrc.json -o -name .fallowrc.jsonc \) -print
```

3. Decide mode:
   - `audit`: changed-code or PR review; default for `code-review`.
   - `full`: broad repo structural review.
   - `dead-code`: dead files/exports/dependencies/imports only.
   - `dupes`: duplicate logic only.
   - `health`: complexity/maintainability health.
4. Prefer the bundled runner, `scripts/run_fallow_readonly.py` inside this
   skill's installed folder. Resolve `<skills-root>` to the environment's
   installed skills directory (e.g. `~/.claude/skills` or `~/.codex/skills`):

```bash
python3 <skills-root>/fallow/scripts/run_fallow_readonly.py --mode audit --base origin/main /path/to/repo
```

Use `--mode full`, `--mode dead-code`, `--mode dupes`, or `--mode health` for
broader audits. Add `--production` when dev/test/story files would distort the
signal. Add `--workspace <name>` for a monorepo package when Fallow supports the
workspace selector.

5. If the runner is unavailable, use manual read-only commands:

```bash
fallow audit --no-cache --format json --quiet --explain --base origin/main
fallow --no-cache --format json --quiet
fallow dead-code --no-cache --format json --quiet
fallow dupes --no-cache --format json --quiet
fallow health --no-cache --format json --quiet
```

## Review Interpretation

Treat Fallow output as a map for inspection, not as the final finding.

Classify each signal:

- `confirmed finding`: source review proves the issue is real and relevant.
- `policy/config issue`: Fallow needs better entry points, generated-file
  ignores, public API modeling, dependency ignores, or boundary config.
- `inherited backlog`: the issue predates the current diff.
- `false positive / needs human context`: dynamic imports, reflection,
  framework-discovered files, manifests, generated code, runtime-only
  dependencies, or public package exports need manual modeling.

Only put confirmed findings in the main review finding list. Put inherited
backlog, policy/config, and uncertainty in residual risk or adoption notes unless
the user asked for full cleanup.

## Required Output

When reporting Fallow evidence, include:

- command run
- Fallow version when available
- verdict or top signal
- introduced vs inherited counts when audit mode provides attribution
- runtime/config errors, if any
- read-only proof: repo status before/after and whether `.fallow*` files appeared
- residual risk around dynamic imports, runtime entry points, public APIs, and
  generated files

For `code-review`, include this line exactly:

```text
Fallow / structural-analysis evidence: <command> -> <pass|warn|fail|skipped>, <top signal or reason skipped>
```

If Fallow fails to run, say so and continue with normal source review. Do not
treat a Fallow runtime/config failure as a product bug.
