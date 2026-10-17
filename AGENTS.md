# AGENTS.md — everything-claude-code

Canonical rules file for this repo. `CLAUDE.md` symlinks here, so Claude Code,
Codex, Cursor and any AGENTS.md-aware runtime obey the same rules.
Keep this under ~300 lines. Global rules live in `~/.claude/CLAUDE.md` — do not repeat them here.

## Project

- **What it is:** Shared Claude/Codex harness: skills, prompts, rules and tooling.
- **Stack:** Markdown instructions plus JavaScript/Python/shell tooling.
- **Live branch:** harness/red-tier-autonomy. This checkout can contain other sessions' work.

## Working agreement

1. **Challenge my mistakes.** If a request is wrong, unclear, or based on a bad
   premise, say so before writing code. Do not agree to be agreeable.
2. **Minimal necessary change.** Smallest diff that solves the actual problem.
   No speculative abstraction, no refactor-while-you-are-in-there.
3. **Do not touch unrelated code.** No drive-by renames, reformatting, or
   dependency bumps without a stated reason.
4. **Verify before "done".** Run the checks below and paste real output. Never
   report success from inference.
5. **Ask when ambiguous.** One question, not four. Then proceed.

## Checks that must pass before you say it works

```bash
# New or changed skills:
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/SKILL_NAME
# Hook/runtime changes need the relevant checks under tests/ as well.
```

## Invariants (never break these)

- Edit canonical skill sources here; keep Claude and Codex links resolving here.
- Stage only the intended files; preserve unrelated in-progress work.

## Conventions

- Skills live in skills/<name>/SKILL.md with YAML name and description.

## Landmines

- ~/.codex/skills is a directory of individual symlinks; a new skill needs a link.

## Learnings

<!-- Append ONE concrete line each time the agent gets something wrong and is
     corrected. Concrete ("always use X for Y"), never abstract ("be careful"). -->

- 2026-10-17: New DJ skills share ECC source; personal track data stays in ~/DJ.
