---
name: cap
description: Check, repair safe verification failures, commit exact intended files, and push safely. Use when the user says cap, asks to commit and push, wants one safe check/commit/push flow, asks for cap fast / fast cap for tiny focused changes, cap dry-run for a no-mutation rehearsal, cap verify for checks only, cap watch for post-push deployment watching, or cap release for the full verify/commit/push/deploy-recovery flow.
---

# Cap

## Overview

Use this skill when the user wants a safe finish: verify the current work, stage only the intended files, create a clean Conventional Commit, and push without sweeping unrelated changes into the commit.

The job is not "push whatever is lying around." The job is to push the intended work safely.
The preferred end state is green verification, not a report about why the repo stayed red.

Cap is now a routed workflow. Start by choosing the smallest mode that honestly proves the work.

## Core Rules

- Never skip verification unless the user explicitly accepts an unverified commit.
- Treat all-green verification as the target. If a required check is red and the fix is safe, local, and deterministic, repair it before offering a best-effort commit.
- Never stage unrelated changes just to make the commit convenient.
- Never commit secrets, `.env*`, private keys, tokens, or credential files.
- Never print env values. Report only key names, redacted presence, or public URL origins when safe.
- Never use destructive git commands such as `git reset --hard`, `git checkout --`, or force-push.
- Never use interactive git flows when a non-interactive command will do.
- Respect active repo rules, dirty-worktree constraints, Codex editing rules, and user-requested file boundaries.
- For UI changes, use the Codex in-app browser before calling the work done. If it is unavailable, say so and use the best fallback.
- For non-destructive migrations, run or apply them when they are part of the intended slice and the repo's migration tooling is available.
- For TypeScript/JavaScript repos that have adopted Fallow, include `fallow audit --no-cache` in the structural proof gate. For unadopted JS/TS repos, run Fallow only when structural drift risk is material and report it as one-off evidence, not a mandatory policy failure.

## Mode Selection

Choose one mode before running commands.

- `cap dry-run`: no mutation rehearsal. Inspect scope, choose checks, run safe read-only checks when useful, identify env drift, propose staging, and draft the commit message. Do not stage, commit, push, deploy, create branches, mutate continuity files, run auto-fix commands, or update memory/lesson files.
- `cap fast`, `fast cap`, `/cap fast`: tiny bounded change. Use focused verification plus exact staging, branch-intent gate, commit, freshness guard, and push. Skip branch inventory and long deployment watch unless the change is deployment-critical, env-related, or the user asked for release proof.
- `cap verify`: verification only. Run the repo-appropriate checks and safe read-only diagnostics. Do not stage, commit, push, deploy, or mutate files except safe generated outputs produced by the checks themselves.
- `cap only`: commit only changes made in this session or the explicitly requested file set. If the file set is ambiguous, ask which files to include.
- `cap watch`: post-push deployment/status watch only. Use this after a commit is already pushed or when the user only wants deployment follow-through.
- `cap release`: full-fat path. Verify, repair, resolve branch intent, commit, push, branch snapshot, deployment watch, and bounded automatic deployment recovery.
- plain `cap`: standard path. Verify, repair safe local failures, exact-stage, resolve branch intent, commit, run post-commit memory checklist, push, and do a short post-push deployment status check when the repo is linked. Escalate to `cap release` when the user asked for production proof, the repo memory says release watch is expected, the change touches deployment/env/public runtime behavior, or the latest deployment reports `Error`/`Canceled`.

If a mode discovers broader impact than its contract allows, escalate to the next stronger mode or stop before mutation and explain the missing evidence.

## Reference Loading

Load only the references needed for the chosen mode.

- Scope and project detection: `references/preflight-and-scope.md`
- Check selection, env sync, and repair loops: `references/verification-and-repair.md`
- Staging, commit, memory review, and continuity: `references/commit-and-memory.md`
- Branch intent, freshness guard, push, and optional branch snapshot/cleanup: `references/push-and-branch-safety.md`
- Deployment watch and automatic recovery: `references/deploy-watch-and-recovery.md`
- Repo-specific hooks and special cases: `references/repo-special-cases.md`
- Final response format: `references/output-format.md`

Suggested loading by mode:

- `cap dry-run`: preflight, verification, output.
- `cap fast`: preflight, verification, commit, push, output.
- `cap verify`: preflight, verification, output.
- `cap only`: preflight, verification, commit, push, output.
- `cap watch`: deploy, output.
- `cap release`: all references relevant to the repo.
- plain `cap`: preflight, verification, commit, push, output, plus repo special cases when detected.

## High-Level Workflow

1. Run preflight inspections and detect the project shape.
2. Decide the exact candidate files for staging and the verification scope.
3. Run repo-appropriate checks; repair safe deterministic failures within bounded loops.
4. Stage exact paths only and inspect the staged diff for secrets, generated artifacts, unrelated files, and unnecessary lockfile churn.
5. Resolve branch intent before committing when the mode permits mutation.
6. Commit with a Conventional Commit message when the mode permits mutation.
7. Run post-commit memory review and existing continuity review only when the commit changed something future sessions need to know.
8. Fetch, check freshness, and push safely when the mode permits push.
9. For `cap release` or escalation-worthy changes, watch deployment and run bounded automatic recovery.
10. Finish with final workspace status and concise evidence.

## Fast-Mode Guardrails

Fast mode is appropriate for docs, skills, copy, metadata, narrowly scoped tests, or a one-file change where the affected behavior is obvious and directly checkable.

Fast mode is not appropriate for migrations or schemas, auth, permissions, security boundaries, billing, payment flows, production config, env vars, dependency or lockfile changes, public API contracts, broad refactors, or user-visible runtime behavior without a focused smoke test.

Fast mode still requires:

- preflight
- exact staging
- staged-diff review
- secret review
- a meaningful focused check
- commit
- freshness guard
- safe push

Record every full-suite check intentionally omitted in the final response.

## Stop Conditions

Stop before committing when:

- no relevant changes remain after filtering
- dry-run or verify mode is complete
- staging scope is ambiguous
- the user explicitly asked for no push or local-only packaging
- required verification still fails after bounded repair attempts
- branch intent is ambiguous and the user has not answered the branch-target question
- branch freshness/divergence checks fail
- push is rejected
- deployment recovery hits a hard blocker or repeats the same failure signature

Do not rebase, merge, pull, force-push, disable protections, fabricate env values, or guess at risky production changes unless the user explicitly asks for that exact action.

## Output

Use `references/output-format.md`.

For code or behavior changes, include a behavior preservation confidence score. Separate previous intended behaviors that should remain true, intentional behavior changes, and evidence used.
