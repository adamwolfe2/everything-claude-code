---
name: overnight
description: Semi-autonomous, HARNESS-ONLY overnight run. Pulls one item from the research-queue, evolves the harness on a branch, eval-gates it, opens a PR-equivalent for morning review. Never auto-merges. Never touches product repos.
---

# /overnight — semi-autonomous harness improvement

Scope is **fixed**: `~/.claude` (skills, rules, agents, commands, workflows) only. Never product repos. Never auto-merge. Every change lands on a branch + writes a morning report.

## Safety contract (do not violate)

- **Harness-only.** Refuse any task that would edit a product repo. If the queue item names a product repo, skip it and log why.
- **Branch, never main.** All work on `evolve/<slug>` in the harness git repo `/Users/adamwolfe/everything-claude-code` (`~/.claude/{commands,skills,agents,rules,workflows,evals}` symlink into it). Never commit to `main`. If the repo is dirty, stash first and report.
- **Eval-gated.** A change is only kept if it beats baseline on `~/.claude/evals/harness-evals.jsonl`. Losers are reset.
- **No auto-merge.** Leave the branch + a one-screen report at `~/.claude/overnight/<date>.md`. Adam merges in the morning.
- **Hard stops still apply.** Secrets, weakened tests/evals, swallowed errors → abort that item, log, continue to next.
- **Bounded.** Max 3 queue items per run. Stop at the budget. Log what was skipped (no silent truncation).

## Flow

1. Read `~/.claude/research-queue.md`, `~/.claude/telemetry.jsonl`, `~/.claude/mistakes.jsonl`. Pick up to 3 harness-only items, highest leverage first.
2. For each: run the `harness-evolve` workflow (propose → apply on branch in worktree → eval → gate).
3. Collect winners (promote) and losers (reject).
4. Write `~/.claude/overnight/<YYYY-MM-DD>.md`:
   - Items attempted / skipped (+ reason)
   - Branches created with eval delta
   - Recommended merges (ranked)
   - Anything that needs Adam's judgment
5. Append a one-line summary to `~/.claude/telemetry.jsonl`.
6. If a morning-briefing routine exists, the report is surfaced there.

## Invocation

Run on demand: `/overnight`
Or schedule it (see CLAUDE.md → Advanced Autopilot → Routines). Because it is semi-autonomous, the morning review is mandatory — nothing ships without Adam merging the branch.
