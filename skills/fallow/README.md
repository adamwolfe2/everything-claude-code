# Fallow

## What This Skill Does

`fallow` runs read-only structural analysis for TypeScript and JavaScript repos.
It captures Fallow evidence for unused code, dependency drift, duplication,
complexity, circular imports, and architecture-boundary drift.

This skill is mandatory inside `code-review`'s `full` and `strict` modes
whenever JS/TS is in scope, and skippable with a stated reason in `quick` and
`one` modes.

## Use It When

- You ask to run Fallow.
- A JS/TS code review needs structural-analysis evidence.
- You want a read-only audit of dead code, dependency drift, duplication, health,
  or changed-code structural risk.

## How It Works

The skill uses a bundled runner that always passes `--no-cache`, writes artifacts
outside the target repo by default, records git status before and after, and
reports whether any `.fallow*` files appeared.

## What You Get

- The exact Fallow command.
- Verdict or top signal.
- Introduced versus inherited findings when audit mode provides attribution.
- Read-only proof from status before/after.
- Residual risk for dynamic imports, runtime entry points, public APIs, and
  generated files.

## Not For

Do not use this as behavioral proof. It complements source review, typecheck,
tests, UI/runtime proof, migrations, and security review.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/fallow
```

Restart Codex after installing new skills.
