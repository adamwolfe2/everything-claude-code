# Handoff

## What This Skill Does

`handoff` creates or refreshes a concise project handoff so the next session can resume without rediscovering everything.

## Use It When

- The user asks for a handoff, wrap-up, session summary, or continuation note.
- Work is paused and needs clear next steps.
- A future agent needs repo status, recent changes, checks, blockers, and risks.
- You are resuming from an existing `HANDOFF.md`.

## How It Works

The skill gathers current repo status, relevant changed files, commands run, verification evidence, blockers, and the next recommended action. It follows repo conventions and avoids overwriting existing handoff structure without reason.

## What You Get

- Concise summary of what changed.
- Current git and verification state.
- Known blockers and residual risks.
- Next actions.
- A handoff artifact when the repo uses one.

## Not For

Use `cap` when the work should be verified, committed, and pushed. Use `feature-proof` when a feature needs final requirement-level proof before handoff.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/handoff
```

Restart Codex after installing new skills.
