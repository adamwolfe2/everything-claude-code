# Commit and Memory

Use this reference only for modes that permit mutation.

## Stage and Review

Before committing, inspect what will actually be included:

```bash
git diff --cached --name-only
git diff --cached --stat
```

Review the staged diff for:

- secrets or credentials
- accidental generated artifacts
- unrelated files
- lockfile churn that was not actually needed

If anything looks wrong, fix the staging set before committing.

## Commit Message

Use Conventional Commits:

```text
<type>(<scope>): <subject>

<body>
```

Rules:

- Subject is imperative, lowercase, no trailing period, max 72 chars.
- Body explains why, what changed, and important trade-offs.
- Use the narrowest obvious scope.
- Use a single-quoted HEREDOC for multi-line messages.
- Do not add co-author trailers unless the repo or user explicitly wants them.

Before committing, show a concise summary of:

- files being committed
- separate verification-repair files or commit planned to restore green
- checks that passed
- the commit message about to be used

Then commit immediately. Do not ask for confirmation unless the staging scope is ambiguous.

## Post-Commit Memory Review

After each successful commit in the cap flow, run the helper when it exists:

```bash
if [ -f "$HOME/.codex/scripts/post_commit_memory_review.py" ]; then
  /usr/bin/python3 "$HOME/.codex/scripts/post_commit_memory_review.py" --cwd "$PWD"
fi
```

Use the output as a checklist right after commit succeeds. If the helper is unavailable, apply the checklist manually:

- Update `~/.codex/lessons.md` only if the work uncovered a correction, avoidable miss, or reusable failure pattern.
- Update the appropriate file under `~/.codex/memories/` only when the active system/user instructions permit memory writes and the work uncovered durable preference, project decision, operational detail, or reusable reference.
- If multiple commits happen in one cap run, avoid duplicate lesson or memory entries.

## Continuity Review

Before pushing, check whether this repo already uses continuity files such as:

- `HANDOFF.md`
- `plans/`
- `STATUS-*.md`
- repo-local notes or memory files

If the current work changed what the next session needs to know, update those existing files before pushing.

Rules:

- Preserve the repo's existing continuity system instead of inventing a new one.
- If the user explicitly asks for a handoff, use `$handoff`.
- Skip continuity edits in `cap fast` unless the changed file set is itself continuity work.

## Legacy Local Cap Lessons

The local `cap/LESSONS.md` may contain useful historical routing notes, but do not let it become an always-on slow gate and do not append new entries there.

- Read recent cap lessons when a cap run hits a familiar repo, a repeated failure, or an ambiguous mode choice.
- Write new reusable cap routing, staging, verification, or deploy lessons to the active environment's global lessons system when the active instructions permit it.
- Keep entries concise and redact secrets, tokens, customer data, and private details.
- After 10-20 repeated entries, distill durable rules into the relevant reference file instead of growing the main `SKILL.md`.
