---
name: fleet
description: Spend spare usage on product work. Triage the top 1-2 highest-ROI items per project, then dispatch one isolated worktree agent per repo that ships a draft PR. Never merges, never pushes main. Use for "fleet", "use my usage", "spin up agents on my projects".
---

# /fleet [repos...] [opus] [nightly]

Default repos: campus-gtm, sendmore, cursive-app, am-collective-os. Args narrow the list. `opus` runs executors on Opus instead of Sonnet (spare-subscription runs).

Multiple accounts (`claude`, `cma`, `caims`) can run fleets at once. They coordinate via `~/.fleet/CLAIMS` (one line: `<repo> <account> <ISO time>`).

## 1. Preflight (per repo)
- Skip any repo claimed in `~/.fleet/CLAIMS` in the last 6h. Then append your claims before triage.
- Skip items already open as PRs: `gh pr list --search "head:fleet/"` per repo, plus any existing `~/.fleet/<repo>-*` worktree.
- `git fetch`; skip the repo if its last commit is < 2h old (another session is likely live) unless Adam named it.
- Never touch the main checkout. Uncommitted files there are Adam's.
- `df -h /System/Volumes/Data`: each JS worktree costs 0.6-3.5 GB with deps + build. Under ~15 GB free, run agents in sequence, not in parallel.
- GitHub Actions has been failing at startup on all repos since 09-29 and Adam can't change billing. Local checks are the only gate.

## 2. Triage (parallel, read-only, Sonnet Explore agents, one per repo)
Inputs: memory `~/.claude/projects/-Users-adamwolfe/memory/<project>.md` + topic files, latest `.claude/specs/*` and HANDOFF, AGENTS.md, `gh pr list`, latest CI run.
Output: top 3 candidates, each with: title, why it matters (user/revenue impact), effort (S/M), files, checks to run, Tier-1? (money/auth/RLS/webhooks/migrations/destructive).
Rank: unblocks revenue or users > broken in prod > finishes a half-done slice > hardening. Drop anything needing Adam's decision, credentials, or a message sent as Adam.

## 3. Approve
Show one table: repo, item, effort, Tier-1. Adam says go / steer. (Skip for `nightly`.)

## 4. Execute (parallel, background, one Sonnet general-purpose agent per repo)
- `isolation: "worktree"` only isolates the CURRENT repo, so each agent runs `git -C ~/<repo> worktree add ~/.fleet/<repo>-<slug> -b fleet/<YYYY-MM-DD>-<slug> origin/<default>` (VendHub: `staging`). One worktree per item.
- Pass the triage gotchas (shared DB stacks, destructive scripts, test-pinned files) into the agent prompt verbatim.
- Tier-1 items: plan only, written to `.claude/specs/`, no code. Exception: small (S) hardening that Adam approves at step 3 ships as a draft PR, with the invariants stated in the PR body and a mandatory Opus review.
- Run the repo's own checks (AGENTS.md); paste real output, read exit codes.
- Push the branch, `gh pr create --draft` with test plan. Never merge, never push main/staging.
- After push: `rm -rf node_modules .next` in the worktree (rebuildable, frees disk).

## 5. Review + report
Opus code-reviewer per PR, started as soon as that repo's agent finishes. Send findings back to the same execution agent (SendMessage) so it fixes them with its context intact. Final report: PR link, checks result, review verdict, what needs Adam. Append learnings to the project memory file.

## nightly
Register via `/schedule` with the approval step skipped; Tier-1 stays plan-only.
