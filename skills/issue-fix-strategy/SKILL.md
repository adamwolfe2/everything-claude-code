---
name: issue-fix-strategy
description: Chat-only executive triage for any set of issues, review findings, UX complaints, screenshots, logs, failing tests, tool diagnostics, or messy context. Use when the user wants plain-English judgement on what each issue is, why it matters, how to fix it, priority, proof needed, and the next suggested workflow step before implementation. Routes broad work to feature-graph-plan/feature-orchestrator, narrow risky fixes to safe-feature-slice, and decision-blocked work to feature-intake-grill without creating plan artifacts.
---

# Issue Fix Strategy

## Purpose

Turn any issue source into a blunt, decision-ready fix strategy.

This skill is the senior operator layer before implementation. It explains the issues in plain English, makes priority calls, recommends practical fixes, and tells the user the next workflow step.

This skill is chat-only. It does not create or edit `plans/<slug>/`, `decisions.md`, `plan.md`, `progress.md`, migrations, code, tests, or repo files.

## Inputs

Accept any source that may contain issues:

- pasted review findings
- code review comments
- UX complaints or persona-review notes
- screenshots or visual observations
- bug reports
- terminal logs
- failing tests
- tool diagnostics
- audit reports
- customer/user complaints
- mixed, incomplete, or messy context

Use available context to understand the issue as deeply as possible. If the input references code, docs, screenshots, routes, tests, schema, or logs that can be inspected safely, inspect enough evidence to avoid asking the user questions the workspace can answer.

## Core Posture

Act like the genius operator.

Do not ask the user to make routine engineering, product, or UX calls that can be inferred from code, existing product context, best practice, or the stated goal. Make the call, label assumptions, and keep moving.

Ask clarifying questions only when the answer could materially change:

- scope
- priority
- user-visible behavior
- permissions or ownership
- money, billing, refunds, or subscriptions
- data model or migration direction
- state transitions
- destructive behavior
- customer-visible records, notifications, or audit history
- external contracts, webhooks, retries, or idempotency
- deploy, backfill, production, or live-data risk

If the issue source is too weak to support a confident call, say that plainly and name the evidence needed.

## Priority Model

Classify each issue:

- `P0`: actively broken, unsafe, losing or corrupting data, moving money incorrectly, auth/security risk, launch blocker, or production-critical failure.
- `P1`: serious user/business impact, trust damage, high regression risk, important workflow blocked, or likely production incident.
- `P2`: important reliability, correctness, UX, maintainability, observability, or operational issue that should be scheduled soon.
- `P3`: polish, cleanup, lower-risk improvement, future-proofing, or non-blocking quality issue.

Priority must include a reason. Do not rank by vibes.

## Triage Workflow

1. Parse the input and list candidate issues.
2. Merge duplicates.
3. Split bundled findings that require different fixes, owners, risks, or verification.
4. Separate symptoms from likely root causes.
5. Drop or downgrade findings that are weak, stale, unverifiable, or only tool noise.
6. Assign each surviving issue a stable ID (`I1`, `I2`, ...) and use that ID everywhere the issue is referenced: priority order, waves, routing, and any handoff.
7. Classify each issue by priority and risk surface.
8. Recommend a fix path for each issue.
9. Identify previous intended behaviours that must not regress.
10. Identify proof required before implementation can be called done.
11. Choose the next suggested workflow step.

When useful, group issues into fix waves:

- Wave 1: blockers and high-risk root causes.
- Wave 2: important correctness, UX, and reliability work unlocked by Wave 1.
- Wave 3: polish, cleanup, documentation, and lower-risk follow-through.

## Routing Rules

End every response with `Next Suggested Step`. Recommend exactly one route.
When another route is genuinely defensible, list it under `Also viable` with a
one-line tradeoff. Never list more than two alternatives.

Route to `feature-graph-plan` when:

- the issues are clear enough to become dependency-graph nodes
- priorities and risk surfaces are understood
- no unresolved product or safety decision blocks planning
- the work spans multiple slices, files, or fix waves

`feature-graph-plan` is the planning stage of `feature-orchestrator`; execution
continues there under one canonical `progress.md`.

Route to `safe-feature-slice` when:

- the work is one narrow fix, or a few independent narrow fixes, touching a
  risky surface: money, permissions, ownership, destructive actions, webhooks,
  state transitions, migrations, integrations, or customer-visible records
- a full dependency graph would be overhead, but implementing directly would
  skip needed invariant protection

Route to `feature-intake-grill` when:

- a missing decision could materially change scope, risk, data, permissions, money, migration direction, state transitions, external contracts, live-data handling, or user-visible behaviour
- the issue set is important but unsafe to graph without one or more user decisions

Route to `grill-me` only when:

- the user explicitly asks to be grilled
- the user wants a heavy plan/design stress test rather than normal decision intake

Route to `Implement directly` only when:

- the fix is tiny and obvious
- the affected surface is narrow
- the risk is low and no risky surface from the `safe-feature-slice` list is
  touched
- orchestrator overhead would be wasteful

Route to `Stay in discussion` when:

- the issue list is too ambiguous
- the source evidence is too weak
- the next safe move is to gather or inspect more context before planning
- a focused `code-review` pass would confirm or kill the weakest findings
  before any routing call is safe

## Output Shape

Use this structure unless the user requests a different format:

```markdown
# Issue Fix Strategy

## Executive Call

[Blunt recommendation: what matters, what is noise, what should happen next.]

## Priority Order

1. [I1] [P0/P1/P2/P3] [Issue name] - [short reason]
2. [I2] [P0/P1/P2/P3] [Issue name] - [short reason]

## Issues

### I1. [Issue Name]

Priority: [P0/P1/P2/P3]

What the issue is:
[Plain-English explanation.]

Why it needs fixing:
[User, business, technical, operational, trust, data, money, auth, or maintenance impact.]

How we will fix it:
[Concrete repair path. Make the recommendation. Mention alternatives only if they matter.]

What must not regress:
[Previous intended behaviours, invariants, or workflows that need protection.]

Proof required:
[Tests, typecheck, browser smoke, migration proof, deploy proof, provider proof, manual verification, or other evidence.]

Suggested routing:
[`feature-graph-plan`, `feature-intake-grill`, `safe-feature-slice`, `Implement directly`, or `Stay in discussion`, with reason.]

## Recommended Fix Order

Wave 1:
- [I# - issue/fix and why first.]

Wave 2:
- [I# - issue/fix and why next.]

Wave 3:
- [I# - issue/fix and why later.]

## Clarifying Questions

[Ask only questions that could materially change scope, risk, or the recommended route. If none, write: None that block the next step.]

## Next Suggested Step

Recommended: [proceed to `feature-graph-plan` (execution continues under `feature-orchestrator`), run `feature-intake-grill`, use `safe-feature-slice`, use `grill-me`, implement directly, or stay in discussion]

Reason:
[Why this route is the right next move.]

Also viable:
[At most two alternatives, each with a one-line tradeoff, only when genuinely defensible. Otherwise write: None.]
```

## Output Scaling

- 10 issues or fewer: use the full per-issue template for every issue.
- More than 10 issues: keep the full template for P0 and P1 issues only. Summarize P2 and P3 issues in one compact table — `ID | Priority | Issue | Fix direction | Routing` — and expand a P2/P3 issue to the full template only when its fix is risky, counterintuitive, or decision-blocked.
- Compacting never deletes triage judgement: every priority still needs a reason, and a compacted issue that routes onward keeps its ID so regression protections and proof requirements can be derived at planning time.

Issue IDs are the traceability handle for the rest of the flow. When routing to `feature-graph-plan`, every accepted issue ID must map to at least one graph node.

## Rules

- Be blunt, practical, and plain-English.
- Do not flatter the user.
- Do not bury the executive call under caveats.
- Do not create implementation artifacts.
- Do not ask questions before making the best available recommendation.
- Do not turn every uncertainty into a user question.
- Do not treat tool output as truth when product context or source evidence contradicts it.
- Do not let low-priority polish crowd out root causes.
- Do not recommend implementation before naming proof and regression protection.
- If prior intended behaviour is unknown, say so and lower confidence.

## Confidence

When useful, include a short confidence note:

- `High`: supported by source evidence, reproduction, tests, or clear product context.
- `Medium`: likely correct, but one or two assumptions remain.
- `Low`: issue source is incomplete or evidence has not been verified.

Confidence should reflect both the fix recommendation and behaviour-preservation confidence, not just whether the new requested path seems plausible.

## Lessons And Memory Routing

Do not create or append `LESSONS.md` beside this installed skill. Use the active environment's global lessons and memory system instead. Lessons are for mistakes, corrections, and reusable failure-prevention rules; memories are for durable user, project, or workflow context when the active instructions allow memory updates. Keep entries concise and redact secrets, tokens, customer data, and private details.
