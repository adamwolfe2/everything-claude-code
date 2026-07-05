---
name: code-review
description: Harsh unified code review workflow for PRs, current diffs, changed files, focused repo areas, or implementation plans. Use when the user asks for code review, review this branch, audit current changes, find issues, compare reviewers, run a normal or strict review, assess merge safety, decide whether code is ready, or demand thermo-level maintainability scrutiny without invoking a separate thermo skill. For JS/TS reviews, this skill runs the fallow skill for read-only structural analysis before finalizing (mandatory in full and strict modes).
---

# Code Review

## Overview

Run a findings-first code review that combines correctness, security, data safety,
tests, behavior preservation, and extremely strict structural maintainability.
Default to read-only review unless the user explicitly asks for fixes, commits,
deploys, or shipping.

This skill replaces the need for a separate thermo-nuclear review. Every review
must include the harsh structural lens by default. The job is not to produce a
long backlog or a polite list of nits. The job is to identify the highest-value
confirmed issues, explain why they matter, and give a safe fix and verification
path.

Do not approve code merely because behavior appears correct. If the implementation
works but makes the codebase harder to reason about, call that out directly.

Backticked skill names in this document (`fallow`, `cap`, `tdd-deep`,
`safe-feature-slice`, `bug-ripple`, `launch-critical-sweep`) refer to installed
skills. Invoke them through the active environment's skill mechanism (slash
command, skill tool, or equivalent).

## Mode Selection

Infer the mode from the user request and repo evidence:

- `quick`: current diff or named files, concise findings only.
- `full`: broader repo/PR review with parallel lanes and a ranked plan.
- `one`: return only the single strongest confirmed issue.
- `strict`: normal review plus maximum structural pressure.

If the request is actually go-live safety, refactor execution, a sibling-bug
sweep, or shipping, do not force a review mode — route per Specialist Routing.

Do not route strict maintainability review to another skill. `code-review` owns
that standard. If the user asks for a "thermo", "thermo-nuclear", "harsh",
"brutal", "code-judo", "spaghetti", or "1k-line" review, run this skill in
`strict` mode and apply the structural standards below.

## Preflight

Start from the real repo state:

1. Check `pwd`, `git status --short --branch`, and a narrow file tree.
2. Determine scope:
   - current branch diff when in a git repo and no scope is given
   - named files/directories when provided
   - current working tree when the user says current changes
   - plan/doc artifacts when reviewing an implementation plan
3. Read local instructions, relevant docs, manifests, configs, changed files,
   nearby tests, schemas/migrations, route maps, and public contracts as needed.
4. Exclude secrets, `.env*` values, generated output, dependencies, and private
   credential sections from broad reads.
5. For framework, SDK, provider, browser, payment, auth, or cloud behavior that
   may have changed, verify against current primary/official docs before treating
   the claim as confirmed.
6. For TypeScript/JavaScript repos or meaningful JS/TS diffs, run the `fallow`
   skill before finalizing the review. Mandatory for `full` and `strict` modes.
   For `quick` and `one` modes it may be skipped when structural analysis would
   add nothing (for example, a few-line diff in one file). Every JS/TS review
   must still include the Fallow evidence line — as a result, or as
   `skipped, <reason>`.

If the workspace is not a git repo, say so and review the provided files/artifacts
directly.

## Risk Tier

Classify the review target before ranking findings:

- Tier 1: money, auth, ownership, data loss, destructive writes, accepted records,
  migrations, webhooks, state transitions, customer-visible records.
- Tier 2: external integrations, queues, background jobs, admin workflows,
  deployment/env behavior, shared domain services.
- Tier 3: low-risk UI display, copy, simple filters, simple local logic.

Tier 1 requires stronger evidence, stricter blocking calls, tests or runtime proof,
and explicit preserved-behavior reasoning. For non-destructive local/test
migrations needed to verify a Tier 1 path, run them when safe and available.

## Review Lanes

Use the smallest set of lanes that fits the scope. For non-trivial reviews, run
independent lanes in parallel when tools and active policy allow it; otherwise run
them locally as separate passes.

1. Correctness and runtime behavior
   - broken logic, edge cases, async ordering, stale state, error handling
   - API/route/server/client boundary failures
   - regression against previous intended behavior

2. Security, auth, ownership, and privacy
   - missing auth/role/tenant checks
   - trusted client input
   - insecure tokens, links, downloads, storage, or data exposure
   - secret leakage in code, logs, tests, or docs

3. Money, state, data, migrations, and integrations
   - double charge, missed charge, wrong amount, fulfillment mismatch
   - illegal state transitions, stale writes, non-atomic partial updates
   - webhook signature/idempotency/retry gaps
   - unsafe migrations, schema drift, RLS/policy mismatch, queue/cron drift

4. Tests and verification gaps
   - missing regression tests for changed behavior
   - weak mocks or snapshots that do not prove the real boundary
   - test/prod fixture gaps
   - missing browser/runtime/provider proof for user-visible or integration paths

5. Structural maintainability
   - apply the Structural Standards section below

6. JS/TS structural analysis
   - run the Fallow Evidence Lane below when JS/TS is in scope

## Fallow Evidence Lane

Fallow answers graph-level questions that linters and context-window reading
miss: unused files/exports, unused or unlisted dependencies, circular imports,
duplicated logic, complexity hotspots, and architecture-boundary drift. It
applies when the review includes a TypeScript/JavaScript package, frontend
workspace, Node service, or JS/TS tooling surface.

The `fallow` skill is the canonical path and owns the mechanics: command
selection, adopted-vs-unadopted handling, monorepo/production scoping,
read-only rules, and output interpretation. Follow that skill rather than
improvising commands. If the skill or its runner is unavailable and you fall
back to manual commands, report the fallback in the evidence line.

Review-specific rules:

- Ask for `audit` mode for changed-code or PR review; `full`, `dead-code`,
  `dupes`, or `health` mode for broad maintainability review.
- Treat output as a map of where to inspect, not as automatic findings. Apply
  the fallow skill's classification (confirmed finding, policy/config issue,
  inherited backlog, false positive). Only confirmed findings enter the main
  findings list; the rest go to `Open Questions / Assumptions` or residual
  risk unless they block the review itself.
- In changed-code review, prioritize: `fail` verdicts, unresolved imports and
  unlisted dependencies, then new unused files/exports/dependencies, new
  boundary violations or cycles, new high-complexity functions, and new
  duplicate logic introduced by the change.
- In broad maintainability review, use full-repo output to pick the highest
  leverage files first, then inspect the source for simpler designs. Do not
  flood the review with a raw inventory of every unused export or clone group.
- A Fallow runtime/config error is not a product finding. Report the failed
  command and reason, then continue from source, tests, and repo evidence. If
  an unadopted repo produces a noisy first-run backlog, stop using it as a
  gate and summarize the adoption need separately.

In every JS/TS review summary, include one line. If this line is missing, the
code review is incomplete:

```text
Fallow / structural-analysis evidence: <command> -> <pass|warn|fail|skipped>, <top signal or reason skipped>
```

When a Fallow-backed issue becomes a finding, cite the actual source file/line
and explain the real maintainability or correctness impact. Do not cite only
the tool name.

## Structural Standards

Apply these standards to every meaningful review, not only to explicitly strict
reviews. Each standard lists what to flag and the preferred remedy direction.

### 1. Be ambitious about structural simplification

Look for code-judo moves: restructurings that preserve behavior while making
the implementation dramatically simpler, smaller, and more direct. Do not stop
at "this could be a bit cleaner," and do not rubber-stamp an implementation
that works but leaves the codebase messier.

- Flag: complicated implementations where a cleaner reframing could delete
  whole categories of complexity; refactors that move code around without
  reducing the number of concepts a reader must hold in their head.
- Remedy: prefer deleting whole branches, helper layers, modes, flags, or
  concepts over polishing them; reframe the state model so conditionals
  disappear instead of getting centralized.

### 2. Treat 1000-line file growth as a presumptive blocker

Do not let a PR push a file from under 1000 lines to over 1000 lines without a
very strong structural reason.

- Flag: any diff that crosses the threshold, especially when the new code could
  be split out.
- Remedy: extract helpers, subcomponents, services, or modules before accepting
  sprawl; explicitly ask whether the code should be decomposed first. Waive
  only when the file has a compelling ownership reason and remains clearly
  organized.

### 3. Reject spaghetti growth

Treat "weird if statements in random places" as a design problem, not a style
nit. Call out changes that make surrounding code harder to reason about, even
if they technically work.

- Flag: new conditionals bolted onto unrelated code paths; one-off booleans,
  nullable modes, optional flags, or special cases complicating existing
  control flow; narrow edge-case handling dropped into the middle of an already
  busy function; "temporary" branching likely to become permanent debt.
- Remedy: push complexity into a dedicated model, helper, state machine, policy
  object, module, or boundary; replace condition chains with a typed model,
  explicit dispatcher, or state machine; collapse duplicate branches into one
  clearer flow.

### 4. Prefer direct, boring, maintainable code

Treat brittle, ad-hoc, magical, or overly generic behavior as a quality
problem, and be skeptical of generic mechanisms that hide simple data-shape
assumptions.

- Flag: thin abstractions, identity wrappers, pass-through helpers, or
  indirection layers that do not buy clarity.
- Remedy: delete wrappers that do not meaningfully clarify the API; keep the
  direct flow unless the abstraction removes real complexity.

### 5. Push hard on type and boundary cleanliness

- Flag: unnecessary optionality, `unknown`, `any`, cast-heavy code, loose
  ad-hoc object shapes, or silent fallbacks that paper over an unclear
  invariant.
- Remedy: explicit typed models, shared contracts, schemas, or discriminated
  shapes; make the boundary explicit so the control flow gets simpler.

### 6. Keep logic in the canonical layer

- Flag: feature logic leaking into shared paths, UI-specific logic leaking into
  services, implementation details leaking through APIs, and copy-pasted or
  bespoke helpers where a canonical utility already exists.
- Remedy: move logic to the package, service, or module that already owns the
  concept; reuse the canonical helper; change the ownership boundary so the
  feature becomes a natural extension of an existing abstraction.

### 7. Treat avoidable orchestration complexity as a design smell

Do not over-index on micro-optimizations, but do flag orchestration that makes
correctness and recovery harder to reason about.

- Flag: independent work serialized for no good reason; partial-update logic
  that leaves state less atomic than necessary; tests that mock away the
  boundary where the regression is likely to happen.
- Remedy: parallelize independent work when that also simplifies the flow;
  restructure related updates into a more atomic shape; add regression tests
  at the real boundary rather than only asserting mocked internals.

Do not be satisfied with "maybe rename this" feedback when the real issue is
structural. Do not be satisfied with a merely cleaner version of the same messy
idea if there is a plausible path to a much simpler idea.

## Evidence Bar

Only report findings that are confirmed or strongly evidenced. A finding needs:

- specific file/line, hunk, runtime, test, schema, or documentation evidence
- a concrete failure mode or maintainability regression
- user, operator, data, security, money, deploy, or future-maintenance impact
- a focused fix direction
- the verification needed to prove the fix

Do not pad with low-value style nits. Do not invent a finding to satisfy the
shape. Label `Hypothesis` when the evidence is incomplete and keep hypotheses out
of blocker lists unless verification is cheap and important.

For structural findings, the concrete failure mode may be future-maintenance
impact: more branches to reason about, unclear invariants, wrong ownership,
larger blast radius, or avoidable coupling. Still ground it in specific code.

## Ranking

Rank by this order unless the user requested a specific lens:

1. P0/P1 correctness, security, money, auth, data loss, destructive action,
   migration, or launch-blocking workflow failures.
2. High-likelihood user-visible or operational regressions.
3. Missing invariant/ownership/state protections around Tier 1 behavior.
4. Structural regressions that make the codebase materially harder to reason
   about.
5. Missed opportunities for dramatic simplification where the simpler structure
   is visible and materially safer.
6. Test gaps that hide a realistic serious regression.
7. Performance, observability, DX, and maintainability concerns.

For `one` mode, return only the strongest confirmed issue. For `full` mode, keep
the list high-signal and deduplicated.

## Approval Bar

Do not approve merely because behavior seems correct. The bar for approval is:

- no confirmed correctness, security, ownership, money, data, migration, webhook,
  or launch-safety blocker
- no clear structural regression
- no obvious missed opportunity to make the implementation dramatically simpler
  when such a path is visible
- no unjustified file-size explosion
- no obvious spaghetti growth from special-case branching
- no hacky or magical abstraction that makes the code harder to reason about
- no unnecessary wrapper/cast/optionality churn obscuring the real design
- no clear architecture-boundary leak or avoidable canonical-helper duplication
- no missed opportunity for an obvious decomposition that would materially improve
  maintainability
- no missing verification for a realistic serious regression

Treat these as presumptive blockers unless the author can justify them clearly:

- the PR preserves a lot of incidental complexity when there is a plausible
  code-judo move that would delete it
- the PR pushes a file from below 1000 lines to above 1000 lines
- the PR adds ad-hoc branching that makes an existing flow more tangled
- the PR solves a local problem by scattering feature checks across shared code
- the PR adds an unnecessary abstraction, wrapper, or cast-heavy contract that
  makes the design more indirect
- the PR duplicates an existing helper or puts logic in the wrong layer when there
  is a clear canonical home
- the PR lacks tests or runtime proof for Tier 1 behavior

If those conditions are not met, leave explicit, actionable feedback and push for
a cleaner decomposition.

## Specialist Routing

Keep only genuinely different workflows standalone:

- Use the `fallow` skill inside JS/TS code review as the structural evidence
  lane — mandatory for `full` and `strict` modes, skippable with a stated
  reason for `quick` and `one`.
- Use `launch-critical-sweep` for go-live, release readiness, catastrophic-risk,
  or "is this safe to launch?" questions.
- Use `tdd-deep` when the user wants behavior-preserving refactor/cleanup with
  characterization tests and implementation.
- Use `bug-ripple` after diagnosing one concrete bug when similar sibling bugs
  may exist.
- Use `issue-fix-strategy` when the review produces multiple findings with mixed
  priorities and the user needs an executive triage, fix order, and routing call
  before implementation.
- Use `safe-feature-slice` for one narrow fix or hardening task on a risky
  surface once the finding is clear.
- Use `feature-orchestrator` when the required fixes are already clear but span
  multiple slices, files, or waves and should run as a tracked dependency graph
  with parallel workers.
- Use `cap` when the user asks to verify, commit, push, deploy, or finish the
  branch.

Do not route to a separate thermo-nuclear skill. The harsh structural review bar
lives here.

When routing to a non-review workflow, explain the reason in one line and continue
with the specialist only if the current request clearly matches it.

## Subagent Pattern

Use subagents only when available and allowed by the active environment/user
instructions. Keep the critical path local and delegate independent lanes.

Good lanes to delegate:

- correctness/runtime
- auth/ownership/security
- money/state/webhooks/migrations
- tests/verification gaps
- structural maintainability and code-judo opportunities
- JS/TS Fallow structural analysis through the `fallow` skill, when the repo or diff is in scope
- skeptical dedupe/false-positive pass

Brief each agent with role, exact scope, read/write boundary, files or artifacts
to inspect, evidence standard, and concise report format. Review is read-only by
default, so agents should not edit files unless the user explicitly requested
implementation and the write sets are disjoint.

## Output

Lead with findings. Use this shape:

```markdown
Findings

- [Severity] `path:line` Title
  Why it matters:
  Evidence:
  Fix direction:
  Verification:

Open Questions / Assumptions

Summary

Verdict: PASS | PASS WITH RISKS | FAIL | BLOCKED | NO MATERIAL FINDINGS
Suggested next step:
Behavior preservation confidence: 0-100, with a short evidence basis
Structural quality confidence: 0-100, with a short evidence basis
Fallow / structural-analysis evidence: command and verdict, or skipped with reason
```

For any JS/TS review, the Fallow evidence line is required. Missing Fallow
evidence means the review is not finished.

Severity labels:

- `BLOCKER`: should not merge/launch as-is.
- `MAJOR`: should fix before merge unless consciously accepted.
- `MODERATE`: real issue, but can be scheduled if risk is understood.
- `MINOR`: include only when no higher-value findings exist.

For review-only requests, do not edit files. For implementation requests, finish
the review judgment first, then move into the appropriate fix workflow.

When there are actionable findings, end with a suggested next step. Recommend
exactly one; when another route is genuinely defensible, list it as an
alternative with a one-line tradeoff, and never list more than two alternatives:

- `Use safe-feature-slice to fix [specific issue]` for one narrow fix or
  hardening task.
- `Use issue-fix-strategy to triage these findings` when there are multiple
  findings with mixed priorities and the fix order or routing needs an
  executive call before implementation.
- `Use feature-orchestrator to deliver [scope]` when the required fixes are
  already clear but span multiple slices and deserve a tracked dependency graph
  with parallel workers.
- `Use launch-critical-sweep` when the real decision is go-live safety.
- `Use tdd-deep` when the next move is behavior-preserving refactor with
  characterization tests.
- `Use bug-ripple` when one confirmed bug implies likely sibling bugs.
- `Use cap` when the code is reviewed and the user asks to verify, commit, push,
  or ship.
- `No action` when there are no material findings.

## Behavior Preservation

For any review of changed behavior, explicitly separate:

- previous intended behaviors that should remain true
- intentional behavior changes from the request
- possible accidental drift
- evidence used: tests, source, runtime/browser checks, docs, schemas, provider
  truth, or current official documentation

Do not give high confidence merely because the new path works. Confidence must
also account for unintended regressions and avoidable complexity that makes future
behavior harder to preserve.

## Review Tone

Be direct, serious, and demanding about quality. Do not be rude, but do not soften
major maintainability issues into mild suggestions. If the code is making the
codebase messier, say so clearly. If the implementation missed an opportunity for
dramatic simplification, say that clearly too.

Useful phrasing:

- `this pushes the file past 1000 lines. can we decompose this first?`
- `this adds another special-case branch into an already busy flow. can we move this behind its own abstraction?`
- `this works, but it makes the surrounding code harder to reason about. keep the behavior and restructure the implementation.`
- `there is a code-judo move here that makes this much simpler. reframe this so these branches disappear.`
- `this refactor moves complexity around, but does not delete it. make the model itself simpler.`
