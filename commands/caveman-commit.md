---
name: caveman-commit
description: Generate a terse caveman-style conventional commit message (≤50 char subject) for staged changes
---

Generate a commit message for the current staged changes.

Conventional Commits format. Subject line ≤50 chars, imperative, lowercase
after the type. No period on subject. Body only when the "why" isn't obvious
from the subject — explain why over what. Drop filler, hedging, padding.

Types: feat, fix, refactor, docs, test, chore, perf, ci

Process:
1. Run `git diff --cached` to inspect staged changes.
2. If nothing staged, stop and tell the user.
3. Draft subject under 50 chars. If it doesn't fit, the change is probably two commits.
4. Skip "this commit", "this change", articles, and adjectives like "various", "some", "minor".
5. Output the message only — do not run `git commit`.
