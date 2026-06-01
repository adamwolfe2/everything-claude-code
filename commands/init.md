---
name: init
description: Open a session in autopilot mode. Read project context + global setup + recent decisions + slice spec, then greet with current state and wait for direction. Use at the start of any session in any project.
---

# /init — Autopilot session open

Read the global CLAUDE.md for the full autopilot contract. This command is the literal first-action sequence.

## Step 1: Read in parallel

Single message, multiple tool calls:
- Project root `CLAUDE.md` (if present)
- `PRODUCT.md`, `DESIGN.md` (if present)
- Latest `.claude/specs/*.md` (most recent mtime — that's the current slice)
- `git status` + `git log -3 --oneline`
- Known-projects detail file at `~/.claude/projects/-Users-adamwolfe/memory/<project>.md` (if recognized)
- `~/.claude/knowledge/index.json` (count + recent decisions)
- `~/.claude/research-queue.md` (any pending /evolve-skills candidates?)

## Step 2: Auth/dependency lightning-check

Cheap (<2s, parallel):
- `coderabbit auth status` — `OK` or `NEEDS LOGIN`
- Existence of `~/.codex/auth.json`
- `vercel whoami` (if `.vercel/project.json` in this project)
- `gh auth status` (if a GitHub repo)

If any are missing, list them in the greeting under `Auth needed:`.

## Step 3: Greet (≤120 words, no emojis, no preamble)

```
Project: <name>
Stack: <inferred from package.json>
Branch: <current> · last commit: <subject> (<when>)

Current slice: <spec slug, or "none">
Open items: <PRs, dirty files, ≤3 lines>
Decisions: <n> indexed · Queue: <n> pending

Auth needed: <list if any, else omit>

Likely next:
  - <best guess at the next move based on slice status + recent commits>

Or tell me what we're doing.
```

## Step 4: Wait

Don't propose work until Adam states intent. Greeting + readiness only.

## Hard rules

- Run everything in step 1 + step 2 in **parallel**. Total time: ≤6s.
- Read files, don't list them.
- No emoji in greeting.
- "Likely next" should be SPECIFIC — not "build a feature" but "finish slice X" or "respond to PR #142" or "fix CI on testing branch".
- If this is a brand-new project (no `CLAUDE.md`, no `package.json`), surface `/onboard-project` as the likely first move.
- If MEMORY.md lists this project, use its summary as the project description rather than re-deriving.
- Do NOT recite agents, skills, or commands. The user knows.

## Failure modes

- If reads time out, skip them with a one-line note and continue.
- If a tool isn't installed, skip its check.
- If the project isn't in MEMORY.md, that's fine — infer from package.json.
