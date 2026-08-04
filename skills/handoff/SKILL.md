---
name: handoff
description: End-of-session handoff that gathers repo status, checks build health, and writes/overwrites HANDOFF.md for next-session continuity. Use when the user asks for a handoff, wrap up, session summary, or what they need for next session.
---

# Session Handoff

## Overview

Write a concise HANDOFF.md in the project root with the minimum context needed to resume work next session.

## Workflow

1) Gather context
- Run `git diff --stat HEAD` and `git status` to capture uncommitted changes.
- Run `git log --oneline -1` to capture the last commit.
- Find any `STATUS-*.md` or `PLAN-*.md` files.
- Detect project type from config files, then run the most appropriate build check:
  - If TypeScript (e.g., `tsconfig.json` exists), run `npx tsc --noEmit`.
  - Otherwise run the closest equivalent for the detected stack, or note that no build check was run.

2) Write HANDOFF.md
Write a single `HANDOFF.md` file with this exact structure:

```markdown
# Handoff - {DATE}

## Last task
{One sentence: what was being worked on}

## Status
{clean build | N errors to fix | uncommitted changes}

## Key files
- {5-10 files most relevant to resuming work, with 1-line descriptions}

## Next steps
- {What to do next, derived from STATUS/PLAN files or conversation}

## Active plans
- {STATUS-*.md or PLAN-*.md files that are in progress, if any}
```

3) Handle uncommitted changes
If there are uncommitted changes, ask:
"You have uncommitted changes. Want me to commit before ending?"

4) Confirm
Tell the user: "Wrote HANDOFF.md - paste `HANDOFF.md continue` in your next session to pick up."

## Rules

- Always write to `HANDOFF.md` in the project root (overwrite if it exists).
- Keep the file under 30 lines; brevity is the point.
- Only list files relevant to resuming, not every file touched.
- One HANDOFF.md per project; always overwritten.
- Add `HANDOFF.md` to `.gitignore` if not already there.
- Never assume project type; detect from config files.

## Lessons And Memory Routing

Do not create or append `LESSONS.md` beside this installed skill. Use the active environment's global lessons and memory system instead. Lessons are for mistakes, corrections, and reusable failure-prevention rules; memories are for durable user, project, or workflow context when the active instructions allow memory updates. Keep entries concise and redact secrets, tokens, customer data, and private details.
