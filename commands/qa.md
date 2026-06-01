---
description: Browser-based QA test of the current feature using Codex CLI (computer-use/browser-use). Validates the actual user-facing behavior end-to-end and reports findings as a structured triage.
---

# /qa — Browser QA via Codex CLI

Delegates QA testing to Codex CLI (the OpenAI CLI), which has strong browser-use and computer-use. Use this between implementation and `/cap` to catch the UX bugs that unit/E2E tests miss.

## When to use

- After implementing a UI flow
- Before `/cap` on anything customer-facing
- When debugging a bug that only manifests in the browser
- When you want a real-world walkthrough of a feature

This is **NOT** a replacement for `/e2e` (Playwright). Use `/e2e` for repeatable scripted journeys; use `/qa` for exploratory, human-style QA.

## Prerequisites

- Codex CLI installed (`codex --version`)
- Codex authenticated (`codex login` once — uses your ChatGPT account)
- The local dev server is running and reachable (default `http://localhost:3000`)
- Optional: a logged-in test account, or a "Sign in with magic link" path Codex can complete

## Arguments

`$ARGUMENTS` may contain:
- A URL or path to start at (e.g. `/dashboard`)
- A natural-language goal (e.g. "test the funnel builder from prompt to preview")
- `--prod` to run against production instead of local dev
- `--account <email>` to pass test account credentials from `.env.local` or `~/.codex/test-accounts.json`

## Execution

1. **Verify dev server**
   ```bash
   curl -sf http://localhost:3000 -o /dev/null && echo "OK" || echo "DOWN"
   ```
   If down and not `--prod`, start it in tmux (`tmux new-session -d -s dev "npm run dev"`) and wait.

2. **Prepare the prompt**

   Build a Codex prompt that gives it everything it needs:

   ```text
   You are QA-testing a web app for Adam Wolfe.

   Project: <name from package.json>
   Stack: Next.js / Clerk / Prisma / etc.
   Base URL: http://localhost:3000  (or production URL)
   Auth: <how to sign in — magic link, test account, dev backdoor>

   Goal: <user-provided goal>

   Test path:
   1. Open the base URL
   2. Sign in if needed
   3. Walk through the user flow
   4. Try the happy path
   5. Try one obvious unhappy path (wrong input, refresh mid-flow, etc.)
   6. Note anything that looks broken, slow, ugly, or confusing

   Report:
   - PASS / PASS WITH ISSUES / FAIL
   - Bugs found (file/component if inferrable, console errors)
   - UX issues (jank, layout, copy)
   - Performance issues (slow loads, layout shifts)
   - Suggested fixes ranked by impact

   Use computer-use to drive a real browser. Capture screenshots of any issue.
   ```

3. **Run Codex non-interactively**

   ```bash
   codex exec --sandbox workspace-write "<the prompt above>"
   ```

   Or interactive if you want to watch:

   ```bash
   codex "<prompt>"
   ```

4. **Capture output**

   Codex's session ID is logged. Output and screenshots go to `~/.codex/sessions/<id>/`. Surface the report inline.

5. **Triage**

   Read Codex's findings and categorize:
   - **BLOCKER** — must fix before ship (broken flow, console errors, security)
   - **HIGH** — should fix before ship (UX confusion, missing states)
   - **MEDIUM** — polish (copy, alignment, micro-interactions)
   - **LOW** — nice-to-have

6. **Optional: fix loop**

   If user says "fix the blockers", spawn relevant subagents in parallel:
   - `build-error-resolver` for type/build issues
   - `code-reviewer` for review of proposed fixes
   - `impeccable` for UX/visual issues

## Output format

```text
/qa Summary

Target: http://localhost:3000<path>
Goal: <stated goal>
Codex session: <session id>

Result: PASS / PASS WITH ISSUES / FAIL

Bugs (BLOCKER):
- <file:line> <description> [screenshot: path]

Issues (HIGH/MED):
- <description>

UX Notes:
- <description>

Performance:
- <metric>

Recommended next steps:
- <action>
```

## Hard rules

- **Never** run `/qa` against production with destructive intent. Read-only walkthrough only on `--prod`.
- **Never** commit screenshots from `~/.codex/sessions/` into the project repo.
- **Never** include real customer data in Codex prompts. Use seed/test accounts.
- If Codex isn't authenticated, surface `codex login` and stop. Don't try to auth in-session.

## Notes

- Codex CLI uses your ChatGPT subscription. No separate API key needed for personal use.
- For repeatable, CI-runnable browser tests, prefer `/e2e` (Playwright) instead.
- `/qa` is the human-style walkthrough. `/e2e` is the regression net. Use both.
