---
name: log-mistake
description: Capture a bug you just fixed as a structured lesson in ~/.claude/mistakes.jsonl — what broke, the root cause, and how to prevent the whole class of mistake. Feeds the weekly /digest.
---

# /log-mistake — turn a bug into a lesson

The practice that compounds hardest: convert each fixed bug into a structural prevention.

## Flow

1. **Determine the repo** automatically: `basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"`.

2. If `$ARGUMENTS` already contains the details, parse them and skip to step 4. Otherwise ask the user **three questions, one at a time, waiting for each answer**:
   - **What broke?** (one-line symptom — what the user/you actually saw)
   - **What was the root cause?** (the real reason, not the symptom)
   - **How do you prevent this whole CLASS of mistake in future?** (the durable rule)

3. **Derive 1–3 tags** from the content (examples: `type-safety`, `edge-case`, `async`, `auth`, `state`, `validation`, `config`, `race-condition`, `null-handling`, `api-contract`, `migration`, `caching`). Show the suggested tags and let the user adjust before saving.

4. **Append** the entry by calling the helper (it does safe JSON escaping):
   ```
   node ~/.claude/scripts/append-mistake.js "<repo>" "<bug_summary>" "<root_cause>" "<prevention>" "<tag1,tag2>"
   ```

5. **Confirm** in one line, e.g. `Logged [type-safety, edge-case] — null user on first render. Digest will track the pattern.`

## Rules

- Keep each field tight — a sentence each, not a paragraph. The value is in the prevention, not prose.
- Never invent the root cause. If the user is unsure, write what's known and tag it `unconfirmed`.
- If `mistakes.jsonl` is missing, the helper creates it on append.
- This is a nudge tool — never block other work to run it.
