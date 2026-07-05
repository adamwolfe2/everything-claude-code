---
name: logic-ripple
description: Map the blast radius of a business/domain logic change before implementation. Use when the user says logic ripple, business-rule ripple, pricing/tax/GST ripple, entitlement ripple, apply this rule everywhere, find duplicate rule logic, canonicalize similar logic, or asks where else a rule/invariant should change across the codebase.
---

# Logic Ripple

## Purpose

Use this skill when a change to one business rule, domain invariant, calculation, permission, entitlement, state transition, validation, or provider contract may need to be applied elsewhere.

This is not a bug hunt around one broken line. It is a rule-equivalence investigation: where does this rule exist, where should it exist, where is it duplicated inconsistently, and where does similar-looking logic mean something different?

Default output is a strong read-only report and fix menu. Do not change code until the user approves the proposed scope.

## Hard Rules

1. Read-only until the user explicitly approves fixes. Do not edit files, apply patches, commit, deploy, mutate provider state, run migrations, or write generated artifacts during the ripple report.
2. Report before implementation. The first deliverable is a classification of what should change, what might change, what should not change, and why.
3. Do not treat text similarity as rule equivalence. Similar math, names, helpers, labels, or fields can represent different domain meanings.
4. Keep the sweep bounded by the rule. It may cross many surfaces, but every inspected area must have a plausible relationship to the business invariant.
5. Separate required correctness fixes from canonicalization opportunities. A wrong invoice total is not the same kind of finding as duplicated helper logic.
6. If repo context cannot prove two things are equivalent, put the item in `Probably Same Rule` or `Research Recommended`; do not silently promote it to `Must Fix`.
7. For current tax, legal, accounting, payment-provider, framework, SDK, browser, cloud, or standards behavior, use current primary/official docs or Context7 before treating the claim as confirmed.
8. Do not print secrets, `.env*` values, cookies, tokens, customer data, private provider payloads, or credential sections. Use redacted presence checks only when configuration is relevant.
9. Be direct and strict about money, tax, auth, ownership, entitlements, destructive actions, accepted records, and customer-visible outputs. Do not soften serious inconsistencies because the fix touches several files.
10. Do not pad with style nits, speculative cleanup, or broad architecture preferences. Canonicalization findings must reduce real duplicate rule risk.

## Phase 0: Intake And Rule Contract

Start from the target repo root when possible.

1. Capture the user's requested rule change or concern.
2. Load local instructions and relevant docs that affect behavior expectations: nearest `AGENTS.md`, product notes, pricing/tax docs, API/provider docs in the repo, test docs, schema notes, and feature plans. Keep reads bounded.
3. Capture a read-only baseline:
   - `git status --short --branch`
   - `rg --files` or a narrow file inventory for likely surfaces
   - package/test/config names only when needed to understand stack and proof options
4. Write a working rule contract:

```markdown
## Rule Contract

Rule under review: ...
Trigger for this ripple: ...
Applies when: ...
Does not apply when: ...
Inputs: ...
Outputs: ...
Rounding/ordering/state assumptions: ...
Customer-visible surfaces: ...
Persisted records affected: ...
Provider/external contracts affected: ...
Historical/immutable records: ...
Unknowns: ...
```

If the rule cannot be inferred safely from repo context and the user's prompt, ask one concise question. If it can be inferred, proceed and label assumptions.

## Phase 1: Build The Rule Map

Create `RULE_SURFACES` and `SEARCH_PATTERNS` before analysis.

For a pricing/GST/tax change, likely surfaces include:

- quote create, edit, duplicate, accept, expire, and revise flows
- line item calculations, discounts, deposits, shipping, surcharges, markups, commissions, refunds, credits, and voids
- invoice generation, PDFs, emails, payment/session creation, metadata, exports, reports, dashboards, receipts, and audit logs
- stored totals, derived totals, migrations, backfills, fixtures, tests, and seed data
- UI labels that imply tax-inclusive or tax-exclusive totals
- provider integrations such as Stripe, Shopify, Xero, accounting exports, or tax APIs when directly involved

For other rule types, adapt the surfaces:

- entitlements: UI gates, API guards, RLS/policies, downloads, webhooks, background jobs, tests, and billing state
- permissions/ownership: routes, server actions, queries, policies, admin tools, exports, and destructive actions
- state transitions: create/update/delete flows, jobs, retries, webhooks, notifications, audit history, and rollback paths
- validation: create/edit/import/bulk actions, API clients, schemas, forms, database constraints, and tests

Search by meaning, not only names:

- direct names: `gst`, `tax`, `vat`, `subtotal`, `total`, `inclusive`, `exclusive`
- formulas and operators: percent multipliers, rounding, line aggregation, discounts-before-tax, tax-after-discount
- data fields: stored totals, metadata keys, provider payload fields, denormalized snapshots
- user copy: "includes GST", "ex GST", "tax", "fees", "total due"
- tests and fixtures with hardcoded totals
- duplicate helper names or near-identical calculation shapes

## Phase 2: Classify Every Candidate

Every candidate must land in exactly one bucket:

- `Must Fix`: same business rule, current behavior would be wrong if not changed.
- `Probably Same Rule`: likely equivalent, but repo evidence leaves a meaningful uncertainty.
- `Canonicalization Candidate`: duplicate or near-duplicate rule logic should probably call one canonical implementation.
- `Intentionally Different`: similar shape, but a different domain rule or lifecycle stage.
- `Do Not Touch`: false match, display-only usage, historical data, irrelevant math, or unrelated feature.
- `Research Recommended`: equivalence depends on law, accounting, tax, provider, framework, or domain behavior not proven by repo context.

Classification evidence should answer:

- Why does this look related?
- What rule does it appear to implement?
- What user, data, money, auth, entitlement, or operational impact occurs if missed?
- What makes it safe or unsafe to change?
- What proof would confirm the classification?

## Phase 3: Factor In / Factor Out

Factor in:

- same rule on different surfaces, roles, routes, jobs, provider events, exports, or customer artifacts
- same lifecycle rule at draft, accepted, invoiced, paid, refunded, credited, voided, or archived states
- UI/server/database/provider mismatches
- tests, fixtures, stories, snapshots, and seed data that encode the old rule
- canonical helpers that should own the invariant
- generated customer-facing artifacts such as PDFs, emails, receipts, downloads, and reports
- partial or duplicate calculations that would drift after the requested change

Factor out unless evidence says otherwise:

- similar math with different domain meaning, such as commission, markup, platform fee, shipping, surcharge, discount, or deposit handling
- display-only formatting that consumes already-computed values without owning the rule
- historical, accepted, paid, audited, or legal records that should remain immutable
- legacy import/backfill scripts not used by current runtime behavior
- analytics approximations that are intentionally non-authoritative
- country, region, customer type, or product category rules that only look equivalent
- tests that intentionally preserve old historical behavior

Danger cases to explicitly inspect when relevant:

- tax-inclusive versus tax-exclusive pricing
- rounding per line versus rounding once at total
- discounts before tax versus after tax
- mixed taxable and non-taxable line items
- partial payments, deposits, refunds, credit notes, write-offs, and voids
- stored totals versus derived totals
- draft mutable records versus accepted immutable records
- payment amount, invoice amount, PDF amount, and email amount disagreeing
- changing a shared helper without checking callers that depend on old behavior

## Phase 4: Research Gate

Use repo evidence first. Recommend external research when equivalence cannot be proven locally and the answer depends on:

- tax, legal, compliance, or accounting treatment
- payment provider semantics, invoices, taxes, refunds, deposits, metadata, or webhook behavior
- framework, SDK, database, browser, or cloud behavior that may have changed
- industry/domain rules the codebase does not document

If the user explicitly asked for research, perform it using current primary/official sources and cite them in the final report.

If the user did not ask for research, add a `Research Recommended` section and stop before classifying those items as `Must Fix`:

```markdown
### Research Recommended
| Candidate | Why It Looks Similar | Why Repo Context Is Insufficient | Suggested Research | Decision Needed |
|---|---|---|---|---|
```

Ask:

```text
Do you want external research before I classify these as must-fix, intentionally-different, or probably-same-rule?
```

If research is declined, keep ambiguous items out of `Must Fix` and state the residual risk.

## Phase 5: Fanout

If subagents are available and the user explicitly invoked `$logic-ripple`, said "logic ripple", asked for a multi-agent sweep, or otherwise clearly authorized delegation, spawn read-only agents in parallel. Do not assign overlapping write work because this skill is report-first.

Useful lanes:

1. Same-rule surfaces: find every route/action/component/job/provider path using the rule.
2. Data and persistence: stored totals, snapshots, migrations, constraints, RLS/policies, fixtures, tests.
3. Customer artifacts: PDFs, emails, exports, reports, receipts, dashboard cards, labels.
4. Provider and integration contracts: payment/accounting/tax/webhook metadata and external docs when requested.
5. Canonicalization: duplicate formulas, helpers, branch chains, and near-identical logic that should share one owner.
6. Skeptic: false positives, intentionally different rules, immutable history, and over-broad scope.
7. Verification: prove-it tests, browser flows, provider checks, migration/backfill proof, and regression risks.

Agent brief:

```text
You are a read-only logic-ripple investigator. You are not alone in the codebase.
Do not edit files, write files, run migrations, commit, deploy, or mutate external state.

Rule contract:
- Rule under review:
- Applies when:
- Does not apply when:
- Known unknowns:

Your lane:
- Focus:

Scope:
- Search only these files/directories/surfaces:

Required method:
1. Read relevant scoped files before making claims.
2. Classify each candidate as Must Fix, Probably Same Rule, Canonicalization Candidate, Intentionally Different, Do Not Touch, or Research Recommended.
3. Use current primary docs or Context7 for version-specific framework/provider claims when needed.
4. Report only candidates with file:line or route/schema/provider evidence.
5. Be strict about money, tax, auth, ownership, entitlements, accepted records, and customer-visible outputs.

Return:
- Candidates by classification, each with file:line, why it is related, why it may differ, risk if missed, proposed action, prove-it test, and confidence.
- Files inspected.
- Docs/checks used.
- Unresolved uncertainties.
```

If subagents are unavailable, not authorized, or fail, run the lanes locally and label the report as `single-agent fallback` or `partial fanout`.

## Phase 6: Evidence And Severity

A `Must Fix` item needs:

- file/line, route, schema, test, provider, or artifact evidence
- clear rule equivalence
- realistic trigger condition
- user-visible, data, money, auth, entitlement, compliance, or operational impact
- narrow fix direction
- prove-it test or verification path

Severity:

- `BLOCKER`: should not ship/merge/launch as-is; money/tax total wrong, unauthorized access, entitlement bypass, destructive/state corruption, accepted customer record wrong, provider fulfillment mismatch, or launch-blocking inconsistency.
- `MAJOR`: should fix before merge unless consciously accepted; common path uses stale rule, customer-facing artifact disagrees, persistence/provider/reporting drift, or duplicated rule logic has already diverged.
- `MODERATE`: realistic edge case, missing recovery, stale fixture/test, or duplicate logic likely to drift.
- `MINOR`: include only as notes, not in the fix menu.

Canonicalization qualifies when it reduces real rule drift:

- one canonical helper/service/model can replace multiple copied formulas
- UI/server/provider surfaces should consume the same typed rule output
- a rule belongs in a domain layer instead of being scattered through routes/components
- tests can target one invariant instead of hardcoded totals in many places

Do not report canonicalization just because a helper could exist.

## Phase 7: Report

Use this output shape:

```markdown
## Logic Ripple Report

Mode: parallel fanout / partial fanout / single-agent fallback
Lanes completed:
Lanes skipped/failed:
Verdict: BLOCKED / FAIL / PASS WITH RISKS / NO REQUIRED RIPPLE FOUND
Hard call: one direct sentence on the real scope.

### Rule Contract
- Rule under review:
- Applies when:
- Does not apply when:
- Unknowns:
- Assumptions:

### Required Ripple Fixes
| # | Severity | Area | File:Line | Why Same Rule | Risk If Missed | Proposed Fix | Confidence |
|---|---|---|---|---|---|---|---|

### Probably Same Rule
| Area | File:Line | Why It Looks Same | Why It May Differ | Decision Needed | Confidence |
|---|---|---|---|---|---|

### Canonicalization Opportunities
| # | Current Duplication | Proposed Canonical Owner | Why This Reduces Rule Drift | Confidence |
|---|---|---|---|---|

### Research Recommended
| Candidate | Why It Looks Similar | Why Repo Context Is Insufficient | Suggested Research | Decision Needed |
|---|---|---|---|---|

### Intentionally Different
| Area | File:Line | Why Similar | Why Different |
|---|---|---|---|

### Do Not Touch
| Area | Reason |
|---|---|

### Missing Tests And Proof
- ...

### Proposed Fix Menu
- [ ] 0. ...
- [ ] 1. ...

### Residual Risk
- ...
```

End with a hard stop:

```text
Tell me which fixes to apply, for example "fix all must-fix items", "research first", "fix 0 and 2", or "canonicalize only after the required fixes".
```

## If The User Approves Fixes

The report is complete. Switch into implementation mode for the selected fix menu only:

1. Preserve unrelated worktree changes.
2. Create or update the canonical rule helper/service/model first when the approved fix requires it.
3. Write or update prove-it tests where practical before changing behavior.
4. Apply the selected narrow fixes.
5. Run repo-appropriate checks, browser/UI proof for customer-visible surfaces, provider proof when safe, and non-destructive migrations when relevant.
6. Report intentional behavior changes, preserved intended behavior, evidence, skipped proof, and behavior-preservation confidence from 0 to 100.

If the user says "fix all" after a logic-ripple report, treat that as approval to implement the listed fix menu, not permission to broaden scope beyond it.
