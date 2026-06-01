---
name: safe-feature-slice
description: Safety-first workflow for building one narrow feature slice or reviewing an existing feature/slice for correctness, auth, ownership, state, integration risk, and missing tests. Use when asked to implement, harden, audit, review, or ship feature work that must preserve invariants — especially money, permissions, data ownership, destructive actions, webhooks, state transitions, or customer-visible records.
---

# Safe Feature Slice

## Core Principle

Optimize for preserving the feature invariant, avoiding unsafe states, keeping business rules in the correct layer, making the code testable, preventing integration drift, and not inventing hidden product decisions.

Do not redesign the feature unless explicitly asked. If something is ambiguous, write down the ambiguity and recommend a safe default instead of silently choosing a risky path.

## Initial Read

Read the relevant files before coding or reviewing. Look for:

- Feature brief or decision notes
- Existing tests and fixtures
- Domain logic, shared types, and contracts
- Database schema, migrations, constraints, RLS, and policies
- API routes, server actions, webhooks, jobs, and queues
- Auth checks, ownership checks, permissions, and audit logs
- UI flows, error handling, retry/idempotency behavior, and stale-version handling

If no formal feature brief exists, infer a short working version before coding or reviewing:

```text
Feature:
[what the user should be able to do]

Primary actor:
[who is allowed to do it]

Core invariant:
[this must always remain true]

Unsafe outcomes:
[what must never happen]

Assumptions:
[what I am assuming because it was not specified]
```

Classify the risk tier before proceeding:

- **Tier 1**: money, permissions, data ownership, state transitions, destructive writes, webhooks, accepted/customer-facing records.
- **Tier 2**: external adapters, background jobs, queues, sync logic, admin workflows.
- **Tier 3**: UI display, copy, layout, simple filters, low-risk polish.

Tier 1 requires stricter review, stronger tests, and explicit safety checks. Tier 3 should stay proportionate.

## Build Mode

Use build mode when the user asks to implement or harden one slice. Keep the slice narrow and state this before edits:

```text
Slice:
[what this slice does]

Allowed scope:
[files/folders expected to change]

Invariant protected:
[safety rule this slice must preserve]

Dependencies:
[what this assumes already exists]

Integration risk:
[how this could break another part]
```

Then work in this order:

1. Find or write the failing test first.
2. Confirm the test fails for the right reason.
3. Implement the smallest correct change.
4. Keep business rules out of UI components and thin route handlers.
5. Use existing shared types/contracts; do not redefine them locally.
6. Add edge-case tests for unsafe outcomes.
7. Run the relevant checks.
8. Report what changed and what remains risky.

Prefer boring, explicit, testable code. Use domain/service layers for critical rules. Use database constraints, RLS, transactions, idempotency keys, audit events, and stale-version checks where the risk tier calls for them.

## Review Mode

Use review mode when the user asks for a review, audit, safety pass, or already-built feature assessment. Do not only judge whether the code looks fine. Review against these questions:

- What is the core invariant?
- Can this feature enter an unsafe state?
- Can the wrong user access or mutate the wrong data?
- Can the frontend trick the backend?
- Can state change in more than one place?
- Can money, ownership, permissions, or status change without audit?
- Can duplicate requests, retries, or webhooks cause duplicate effects?
- Can stale data or old versions be accepted?
- Are errors swallowed instead of handled?
- Are database constraints and RLS doing enough?
- Do tests prove dangerous cases or only the happy path?
- Would this still work if two requests happen at the same time?
- Does this slice break the feature spine or shared contract?

For code reviews, lead with concrete findings and file/line references. Classify confirmed unsafe paths separately from hypotheses and missing-test risks.

## Hard Rules

- Do not redefine shared types locally.
- Do not invent new states casually.
- Do not bypass the domain layer.
- Do not put critical business rules only in UI components.
- Do not trust request body values for ownership, price, amount, role, status, or permissions.
- Do not use `as any`, `@ts-ignore`, or disabled lint rules to force progress.
- Do not delete or weaken tests.
- Do not mock the dangerous part when it should be tested for real.
- Do not silently catch errors and continue.
- Do not add fallback behavior for unsafe cases.
- Do not use service-role/admin access unless explicitly justified.
- Do not change contracts without calling it out.
- Do not merge unrelated cleanup into the slice.

## Safety Checks

For features touching money, permissions, data ownership, destructive actions, webhooks, state transitions, or customer-visible records, explicitly consider:

- Auth and authorization
- RLS and database constraints
- Ownership and org/customer boundaries
- Idempotency, retries, and replayed events
- Transactions and race conditions
- Stale version handling
- Invalid state transitions
- Audit logging and manual review paths
- Database and external service failures
- Production monitors or alerts

At minimum, consider tests for: happy path, wrong user, wrong org/customer, stale version, expired entity, duplicate request, replayed webhook/event, invalid amount/status/input, concurrent request, database failure, external service failure, and missing audit event.

For critical domain logic, prefer unit tests plus integration tests against the real boundary that enforces the invariant. Add RLS allow/deny tests, concurrency tests, property-style tests, or mutation testing when the risk and repo tooling justify them.

## Final Response

When finished, respond in this format:

```text
Summary:
[what changed or what was reviewed]

Invariant:
[the core rule this preserves]

Unsafe outcomes checked:
[dangerous cases considered]

Tests:
[what tests exist or were added]

Issues found:
[bugs, risks, missing tests, contract drift]

Recommended fixes:
[smallest safe fixes, in priority order]

Files changed or reviewed:
[list]

Status:
PASS / PASS WITH RISKS / BLOCKED / FAIL
```

Use `PASS` only if the slice is safe, tested, and integration-safe. Use `PASS WITH RISKS` for acceptable non-critical gaps. Use `BLOCKED` when a product decision, missing dependency, or contract ambiguity prevents safe completion. Use `FAIL` for a concrete unsafe path, broken invariant, weak auth, broken state transition, missing critical test, or integration break.

## Attribution

Authored by James Vanderhaak. Adopted into Adam Wolfe's setup verbatim with permission.
