---
name: bug-ripple
description: Diagnose one reported bug, define its root cause and blast radius, then run a strict, findings-first, read-only sibling-bug ripple sweep with parallel Codex agents when explicitly authorized and available. Use when the user says bug ripple, sibling bugs, what else could break, fix and sweep, or asks for likely related failures after a bug.
---

# Bug Ripple

## Purpose

Use this skill when one concrete bug is a signal that nearby code may contain related failures. First diagnose the reported bug precisely, then search the same mental-model gap and feature area for sibling bugs. The default output is a findings-first report and fix menu, not code changes.

The review posture is strict but bounded. Be blunt about confirmed risk, bad invariants, weak tests, and messy structure that makes sibling bugs likely. Do not turn this into a repo-wide maintainability review, and do not pad the report with speculative nits.

## Hard Rules

1. Read-only until the user explicitly approves fixes. Do not edit files, apply patches, commit, deploy, mutate provider state, run migrations, or write generated artifacts during the ripple review.
2. Do not spawn subagents unless the user explicitly invoked `$bug-ripple`, said "bug ripple", asked for a multi-agent sweep, or otherwise clearly authorized delegation. If the runtime or active policy disallows subagents, use the local fallback and say so.
3. Keep the search bounded to the blast radius. Do not turn one bug into a repo-wide audit unless the user asks.
4. Do not print secrets, `.env*` contents, cookies, tokens, customer data, or provider payloads. Use redacted presence checks only when configuration is relevant.
5. Current framework, SDK, API, cloud, payment, browser, or standards claims need current primary docs, Context7, or official docs before being treated as confirmed.
6. Report confirmed or strongly evidenced bugs only. Label hypotheses as hypotheses and keep them out of the primary fix menu unless they are cheap and important to verify.
7. If no sibling bugs are found, say that plainly. Never pad the report with style nits, speculative edge cases, or generic best practices.
8. Be demanding about severity and structure. Do not soften data, auth, money, destructive-action, or common-path regressions because the fix is awkward. If the bug reveals avoidable branching, unclear ownership, cast-heavy contracts, or duplicated logic that materially increases sibling-bug risk, call that out as part of the finding.
9. Harshness is for evidence and prioritization, not theater. Use direct language, but every hard call must be backed by file/line evidence, a realistic trigger, user impact, and a narrow verification path.

## Phase 0: Intake and Baseline

Start from the target repo root when possible.

1. Read the user's bug description, stack trace, failing test, screenshot, PR comment, or file reference.
2. Load local instructions that can change behavior expectations: nearest `AGENTS.md`, repo docs, test docs, and relevant feature notes. Keep reads bounded.
3. Capture a read-only baseline:
   - `git status --short --branch`
   - `rg --files` or a narrow file inventory for the suspected area
   - package/test config names only when needed to understand the stack
4. If the bug target is missing and cannot be inferred, ask one concise question. If it can be inferred from repo evidence, proceed and state the assumption.

## Phase 1: Diagnose the Original Bug

Do this yourself before any fanout. The ripple is only as good as the root-cause statement.

1. Trace the bug to exact file and line evidence. Read the full relevant file, not only the failing line.
2. Identify what the user would see or lose.
3. Identify the mental-model gap, not just the broken statement. Examples: wrong ownership assumption, stale async state, nullable data treated as required, trusted client input, provider event assumed ordered, expanded object assumed present.
4. Define a prove-it test mentally:
   - expected behavior
   - current wrong behavior
   - exact assertion shape
5. Identify the minimal fix, but do not apply it.
6. Check whether tests already cover the intended behavior.
7. Decide whether the original bug is a one-off mistake or a structural signal. Structural signals include scattered special cases, unclear ownership boundaries, loose object shapes, unsafe casts, silent fallbacks, non-atomic state changes, duplicated helpers, and framework/provider assumptions hidden in UI or shared code.

Diagnosis output before fanout:

```markdown
## Diagnosis

Bug: ...
User impact: ...
Root cause: ...
Where: path/to/file.ext:line
Prove-it test: `expect(...).toBe(...)` currently ...
Suggested fix: ...
Existing coverage: covered / missing / unclear
Structural signal: one-off / likely pattern / unclear
Assumptions: ...
```

## Phase 2: Build the Blast Radius

Create `SCOPE_FILES` before ripple analysis. Include only files with a clear relationship to the bug:

- the root-cause file or files
- direct imports, exports, callers, and callees
- same feature directory or route/action/component family
- tests for the affected behavior
- schema, migration, policy, queue, webhook, or config files only when directly implicated
- shared helpers only when the bug depends on their contract

Default bounds:

- Aim for 8 to 30 files for normal app bugs.
- Use directories only when they are small and feature-specific.
- Exclude generated output, build caches, vendored dependencies, logs, broad `.env*` reads, and unrelated worktrees.
- If the blast radius must expand, state why before expanding.

Also create `SEARCH_PATTERNS` from the diagnosed root cause. Examples:

- missing null or empty handling
- repeated unsafe type assertion
- unawaited async work
- stale closure or missing dependency
- ownership/auth check missing
- payment/webhook fulfillment before provider proof
- non-idempotent mutation
- stale cache after mutation
- unchecked provider response shape
- destructive action without scope guard

## Phase 3: Ripple Fanout

### Preferred fanout

If subagents are available and explicitly authorized, spawn the independent read-only agents in one parallel batch when possible. Use `explorer` agents for codebase questions. Do not assign overlapping write work because this skill is read-only.

Use as many lanes as make sense for the stack and blast radius. Three agents is the minimum useful fanout; six to nine is appropriate for launch-critical or high-blast-radius bugs.

Recommended lanes:

1. Same pattern elsewhere: find repeats of the original bug shape.
2. Boundary and data contracts: nulls, empty values, invalid shapes, parsing, serialization.
3. Async and state: races, stale closures, ordering, cancellation, duplicate submits.
4. Auth, ownership, money, and destructive actions: missing tenant/user/payment/state guards.
5. Persistence and migrations: schema drift, constraints, RLS/policies, transaction boundaries.
6. Integrations and provider events: webhooks, retries, idempotency, env/config assumptions.
7. UI/runtime surface: routing, server/client boundaries, form pending states, cache invalidation.
8. Test coverage: missing characterization tests and assertions needed before fixing.
9. Skeptical pass: dedupe, false positives, and whether findings are actually user-impacting.
10. Structural signal pass: only when the original bug suggests architecture or maintainability caused the failure; look for sibling-prone complexity in the scoped blast radius, not broad style issues.

If fewer lanes apply, skip irrelevant lanes and report why.

### Agent brief template

Give each agent the same diagnosis and `SCOPE_FILES`, plus one lane-specific focus.

```text
You are a read-only sibling-bug hunter. You are not alone in the codebase.
Do not edit files, write files, run migrations, commit, deploy, or mutate external state.

Diagnosed bug:
- Bug:
- User impact:
- Root cause:
- Where:
- Suggested fix:

Your lane:
- Focus:

Scope:
- Search only these files/directories:

Required method:
1. Read the relevant scoped files before making claims.
2. Search for the diagnosed root-cause pattern and closely related failure modes.
3. Use current primary docs or Context7 for version-specific framework/API claims.
4. Report only realistic bugs with file:line evidence and a prove-it assertion.
5. Be strict about structural causes when they materially increase bug risk: unclear invariants, wrong ownership layer, duplicated logic, scattered branches, unsafe casts, or non-atomic state transitions.
6. If you find nothing, say "No sibling issues found."

Return:
- Findings, each with severity, file:line, user impact, cause, short snippet or symbol, fix idea, and prove-it assertion.
- Files inspected.
- Checks/docs used.
- Unresolved uncertainty.
```

### Local fallback

If subagents are unavailable, not authorized, or fail, run the lanes locally as separate passes. Label the report as "single-agent fallback" or "partial fanout" and do not invent consensus.

## Phase 4: Evidence Bar

A finding qualifies for the main report only when it has:

- file and line evidence
- a concrete user-visible or data-integrity impact
- a specific trigger condition
- a plausible root cause tied to the original bug area
- a prove-it assertion or reproduction sketch
- a narrow fix idea

Keep the bar high and the language plain. A bug-ripple finding is not "maybe cleaner"; it is "this can fail because..." or "this structure hides the same failure mode because...".

Severity:

- BLOCKER: should not ship/merge/launch as-is; data loss, unauthorized access, money movement/fulfillment error, destructive action, app-wide outage, or live launch blocker.
- MAJOR: should fix before merge unless consciously accepted; common user path broken, persistent data corruption risk, security boundary weakening, broken payment/auth/integration path, or structure that makes a Tier 1 failure hard to reason about.
- MODERATE: real issue with a realistic trigger; degraded workflow, missing recovery, brittle boundary, or test gap likely to hide regression.

Do not include MINOR/LOW items in the fix menu. Put them in notes only if useful.

Structural findings qualify only when they are tied to the diagnosed bug pattern or materially expand the blast radius. Examples worth reporting:

- the same invariant is reimplemented in multiple places and one copy is already wrong
- a shared helper accepts loose shapes or silent fallbacks that mask invalid state
- a UI/server/provider boundary relies on casts, nullable modes, or ad-hoc branching that can repeat the original failure
- a state transition is split across branches or async steps where partial state creates a sibling bug
- feature-specific logic has leaked into a shared path and now bypasses the intended guard

Do not report broad preferences such as naming, formatting, file length, or "could be cleaner" unless they directly hide or reproduce the failure mode.

## Phase 5: Merge and Report

Deduplicate by root cause, affected behavior, and file range. Track which agents or lanes found each issue. Consensus is a signal, not proof; a single well-evidenced critical bug still matters.

Use this output shape:

```markdown
## Bug Ripple Report

Mode: parallel fanout / partial fanout / single-agent fallback
Agents or lanes completed: ...
Agents or lanes failed/skipped: ...
Verdict: BLOCKED / FAIL / PASS WITH RISKS / NO SIBLING BUGS FOUND
Hard call: the most important decision from the review in one direct sentence

### Original Bug
- What's broken:
- Why:
- Where:
- Suggested fix:
- Test coverage:
- Structural signal:

### Blast Radius
- Files/directories searched:
- Scope exclusions:

### Confirmed Sibling Bugs
| # | Severity | File:Line | Found By | Issue | Fix |
|---|---|---|---|---|---|

### Structural Risk In The Blast Radius
Only include if it directly increases sibling-bug risk.

### Strong Hypotheses
Only include if important and clearly labeled.

### Missing Tests
- Original bug:
- Sibling bugs:

### Prove-It Tests To Write Before Fixing
- [ ] ...

### Fix Menu
- [ ] 0. Original bug: ...
- [ ] 1. Sibling bug: ...
- [ ] 2. Sibling bug: ...

### Residual Risk
- ...
```

End the report with a hard stop:

```text
Tell me which fixes to apply, for example "fix all", "fix 0 and 2", or "just the original".
```

## If the User Approves Fixes

The ripple review is complete. Switch into implementation mode for the selected fixes:

1. Preserve unrelated worktree changes.
2. Write or update the prove-it test first where practical.
3. Confirm the test fails for the bug when safe.
4. Apply the narrow fix.
5. Run repo-appropriate checks and non-destructive migrations when relevant.
6. Report intentional behavior changes, preserved intended behavior, evidence, and behavior-preservation confidence from 0 to 100.

If the user says "fix all" after a ripple report, treat that as approval to implement the listed fix menu, not permission to broaden scope beyond it.
