---
description: Commit And Push. Full preflight (lint, types, tests, format, build, env sync, optional CodeRabbit), session memory extraction, conventional commit, push, and status report. Use this instead of raw git commit && git push.
---

# /cap — Commit And Push

The headline ship workflow. Runs every relevant check that could block a deploy, then commits and pushes only if everything is green.

## When to use

Whenever you've finished a unit of work and want it on `main` (or the current feature branch). Replaces `git add . && git commit && git push`.

Arguments (optional):
- `$ARGUMENTS` may include a desired commit message. If absent, generate one from the diff.
- `--no-push` — run all checks and commit but don't push
- `--branch <name>` — create/checkout branch before committing
- `--skip codereview` — skip CodeRabbit (default: run if installed and authenticated)

## Execution order

Do these sequentially. If any **fails**, stop, report the failure, and do NOT commit. If any returns warnings only, surface them but proceed.

### 1. Branch + scope

```bash
git status --porcelain
git rev-parse --abbrev-ref HEAD
```

Decide:
- Direct-to-main vs feature branch (respect `--branch` arg)
- Which files to include — exclude `.env*`, secrets, credential files, large binaries, unrelated `.agents/` or scratch dirs
- If the change is large or risky, suggest splitting before committing

### 2. Detect tooling

Auto-detect from `package.json` (or equivalent):
- Package manager: pnpm | npm | yarn | bun (honor `packageManager` field and lockfile)
- Lint script: `lint`, `lint:check`, fallback to `eslint .`
- Type script: `typecheck`, `tsc`, fallback to `npx tsc --noEmit`
- Test script: `test`, `test:ci`, fallback to skip with warning
- Format: Prettier (`prettier --check` then `prettier --write` if needed)
- Build script: `build` (skip if no script and not Next.js/Vite/etc.)

For non-Node projects, adapt: Python (`ruff`, `mypy`, `pytest`), Rust (`cargo check`, `cargo test`), Go (`go vet`, `go test ./...`).

### 3. Run checks (parallel where independent)

Run in parallel via separate Bash calls:
- **Lint** — block on errors, warn on warnings
- **Types** — block on any error
- **Tests** — block on any failure, report file/test counts
- **Format** — auto-fix with Prettier on staged files, then re-stage

Then sequentially:
- **Build** — block on failure (Next.js / production build)

### 4. Env var sync check

For Vercel-deployed projects:
- Read keys from `.env.local`
- Run `vercel env ls production` (skip if not authenticated, warn)
- Diff: report any local key missing from Vercel, or vice versa
- Do not block; report as "Env Vars: SYNCED / DRIFT (n keys)"

### 5. CodeRabbit (optional)

If `coderabbit` is on PATH and authenticated:

```bash
coderabbit review --agent
```

Read the structured findings. If any are CRITICAL, ask whether to abort. If only suggestions, include them in the commit summary. If not installed or not authed, skip with note "CodeRabbit: skipped".

### 6. Session review

Reflect briefly on the session:
- Lessons learned worth saving — append to `~/.claude/projects/-Users-adamwolfe/memory/MEMORY.md` index or appropriate per-project detail file (keep MEMORY.md index entries <200 chars)
- Memories worth saving — same
- Patterns worth saving as a skill — note in summary
- If nothing notable, write "none"

### 7. Commit

Stage relevant files explicitly (`git add path1 path2`) — never blind `git add .`. Generate a conventional commit:

```
<type>(<scope>): <description under 70 chars>

<optional body explaining WHY>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

If `$ARGUMENTS` provided a message, use it as-is. Otherwise compose from the diff.

Pass via HEREDOC. No `--no-verify`, no `--no-gpg-sign`. No `Co-Authored-By: Claude` line — Adam has attribution disabled globally.

### 8. Push

```bash
git push  # or git push -u origin <branch> if new branch
```

Unless `--no-push` was passed.

### 9. Ship verification (the autopilot upgrade)

After push, confirm the ship landed:

```bash
node /Users/adamwolfe/everything-claude-code/scripts/lib/ship-verify.js
```

Three-stage poll (in `lib/ship-verify.js`):
- **Stage 1: GitHub Actions** — poll `gh run list` until all workflows for the pushed SHA complete. Timeout 5 minutes.
- **Stage 2: Vercel** — `vercel ls --json`, wait for latest deployment to reach `READY`. Timeout 5 minutes.
- **Stage 3: URL** — `curl` the deployment URL until 2xx/3xx response. Timeout 1 minute.

Overall result: `SHIPPED` (all three green or n/a) or `FAILED`.

If FAILED:
- Log `event=ship.fail` with the failing stage
- Auto-spawn `build-error-resolver` agent if CI failed
- Surface the deployment build logs if Vercel failed
- Surface curl response if URL unreachable
- Do NOT revert — just diagnose. The push is already on origin.

### 10. Open branches sweep

```bash
git branch --sort=-committerdate | head -5
```

List recent local branches with last-commit time and subject. Surface ones older than 7 days as candidates for cleanup.

## Output format

```text
/cap Summary

Branch
[Direct to main / Pushed to feature/xyz]

Scope
- Committed: [files]
- Excluded: [files and why]

Code Review
- CodeRabbit: [PASS / N findings / skipped because <reason>]

Checks
- Lint: PASS / FAIL (n errors)
- Types: PASS / FAIL (n errors)
- Tests: PASS / FAIL (x/y passed)
- Format: PASS / autofixed n files
- Build: PASS / FAIL

Env Vars
[SYNCED / DRIFT: <details>]

Commit
<sha> <message>

Session Review
- Lessons added: [list / none]
- Memories added/updated: [list / none]
- Skill candidates: [list / none]

Push
Pushed to <remote>/<branch>

Open Branches
- <branch> | <when> | <last commit subject>

Vercel
[Ready: <url> / Building: <url> / Not a Vercel project]
```

## Hard rules

- **Never** commit `.env*` files or anything containing secrets
- **Never** use `--no-verify` to bypass hooks
- **Never** force-push to main/master
- **Never** commit if any blocking check failed
- **Never** include a `Co-Authored-By` attribution line
- Prefer NEW commits over `--amend` (if a previous commit fully failed pre-commit, the file state may be confused — investigate before amending)

## Failure behavior

If a blocking check fails, output:

```text
/cap BLOCKED

Failed: [check name]
Error: [first 20 lines of error output]
Recommended fix: [delegate to build-error-resolver / fix lint manually / ...]

Nothing committed. Run /cap again after fixing.
```

## Attribution

Concept and design borrowed from James Vanderhaak's "commit and push" skill. Adapted for Adam's setup.
