# Preflight and Scope

Run read-only inspections in parallel when possible.

## Git State

```bash
git status --short --branch
git diff --stat
git diff --cached --stat
git log --oneline -5
git rev-parse --abbrev-ref HEAD
git rev-parse --show-toplevel
```

If the directory is not a git repo, stop before commit/push and report that cap can only verify the project locally.

## Project Detection

Detect from the repo root unless a monorepo package root is clearly the right scope.

- `package.json` -> Node / JS / TS
- `pyproject.toml`, `requirements.txt` -> Python
- `Cargo.toml` -> Rust
- `go.mod` -> Go
- `Gemfile` -> Ruby

For Node repos, detect package manager from the lockfile or `packageManager` field:

- `pnpm-lock.yaml` -> `pnpm`
- `yarn.lock` -> `yarn`
- `bun.lockb` or `bun.lock` -> `bun`
- otherwise use `npm`

In monorepos, run checks from the narrowest package root that contains the changed files unless the repo clearly requires root-level verification.

## Scope Decision

After inspection:

- Decide the exact candidate files for staging.
- Prefer exact paths with `git add -- <path>...`.
- Do not use `git add -A`.
- If the worktree is already dirty, leave unrelated changes alone.
- If `cap only` is active, include only the session/requested file set.
- If no relevant changes remain after filtering, stop and say so.

## Dry Run

In dry-run mode, stop after the proposed scope, checks, env warnings, and draft commit message. Do not mutate git, remotes, continuity files, memory files, or generated repair output.
