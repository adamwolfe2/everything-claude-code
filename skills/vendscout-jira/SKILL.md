---
name: vendscout-jira
description: "Auto-create and maintain Jira ENG tickets as a side effect of VendScout engineering work in the vendhub repo. Fires only when the checkout is vendhub (or a vendhub worktree) AND the change touches VendScout paths. Adam never files tickets by hand — this skill files them in the practiced format (Bug/Story, ADF Acceptance Criteria, Story Points, Backlog-only, Ready For Review when a PR is up, `Jira: ENG-xxxx` on the PR)."
---

# VendScout → Jira (ENG)

Adam works through fixes. You file the paperwork. Silent, one status line per ticket.

## Scope gate (ALL must hold, else do nothing)

1. Checkout is `/Users/adamwolfe/vendhub` or a `vendhub-*` worktree (`git rev-parse --show-toplevel`, `git remote -v` → `ModernAmenities-Org/vendhub`).
2. The diff touches VendScout: paths matching `toolkit/`, `scout`, `harvest`, `enrich`, `territory`, `website-builder`, `crm`, `credits`, or the PR title/branch says VendScout/Scout/toolkit.
3. The work is engineering (code, migration, test, CI). Docs-only → no ticket.

Other repos, non-Scout vendhub work, spec/notes edits: skip silently.

## When it fires

- A PR is opened (`gh pr create`) or a fix is committed and pushed.
- A bug is found and logged to a spec intake table (create a Backlog ticket, no status flip).
- A PR merges (flip to Done outside process, transition `25`).

## Procedure

1. **Dedupe first.** `searchJiraIssuesUsingJql` with `searchResultMode: "count"`, then a scoped query:
   `project = ENG AND statusCategory != Done AND (summary ~ "<keyword>" OR text ~ "<PR number>")`. Also check the PR body for an existing `Jira: ENG-` prefix. Reuse if found.
2. **Type.** Bug = regression / wrong behavior / data corruption. Story = new capability or hardening. Prefix summary `[VendScout] `.
3. **Create** via `createJiraIssue` (cloudId `27c5da22-db6f-42dc-a16b-b54d0f0896ca`, project `ENG`, assignee Adam):
   - `description`: what was wrong, root cause, what changed, files touched, PR link, migrations to apply.
   - `customfield_10048` Acceptance Criteria — **required, ADF doc object, never a string**. 3–6 bullets, testable, drawn from the actual diff + the checks you ran (typecheck/jest/CI green, repro query returns 0, etc.).
   - `customfield_10039` Story Points — Bug 2 / Story 3 default; 1 for one-liners, 5 for multi-file or migration, 8 for anything with a data backfill.
   - Labels: `vendscout`.
4. **Status.** New tickets land in **Backlog and stay there**. Never move anything to To Do. PR open → transition Backlog `2` (Groomed) → `3` (Ready For Work) → `4` → Ready For Review, then `9` only if a reviewer is actively on it. Merged → `25` Done outside process (ask Adam first; also ask before `5` Cancelled). Stuck in To Do → `15` → `16` → `6` back to Backlog.
5. **Link.** Prefix the PR body first line with `Jira: ENG-xxxx` (`gh pr edit --body`). `addCommentToJiraIssue` with the PR URL and the CI evidence.
6. **Report** one line: `Jira: ENG-1870 created (Bug, 2pt, Ready For Review) · PR #2971 linked`.

## Gotchas (learned 2026-08-26)

- MCP ignores `fields` on JQL search — always `searchResultMode: "count"` first, then parse the saved result file.
- Story Points needs the field on screens 10005/10006 and context 10141 — already done; if "not on the appropriate screen" recurs, fix via browser-harness `js(fetch(...))` with `X-Atlassian-Token: no-check`, never aside.
- Acceptance Criteria as a plain string fails creation. Build: `{"type":"doc","version":1,"content":[{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}]}]}`.
- Full workflow/transition table: memory `jira-eng-workflow-and-fields.md`.
