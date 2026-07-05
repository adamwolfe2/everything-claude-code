# Logic Ripple

## What This Skill Does

`logic-ripple` maps the blast radius of a business or domain rule change before implementation. It finds where the same rule should change, where similar logic is intentionally different, and where duplicate rule logic should be canonicalized.

## Use It When

- You are changing pricing, tax, GST, discounts, totals, entitlements, permissions, validation, or state transitions.
- You want to know where else the same rule needs to apply.
- You suspect similar code paths calculate or enforce the same rule differently.
- You want a report and fix menu before any edits happen.
- You need a research gate for rules that may depend on tax, legal, accounting, provider, or framework behavior.

## How It Works

The skill starts by writing a rule contract, then searches by meaning rather than only text. It classifies every candidate as `Must Fix`, `Probably Same Rule`, `Canonicalization Candidate`, `Intentionally Different`, `Do Not Touch`, or `Research Recommended`.

When research is needed and the user did not already ask for it, the skill stops and asks whether to research before promoting ambiguous items into the fix menu.

## What You Get

- A rule contract and assumptions.
- Required ripple fixes ranked by severity.
- Similar-looking areas that may not be the same rule.
- Canonicalization opportunities where one helper or domain owner would reduce drift.
- Research recommendations when repo context is not enough.
- A hard-stop fix menu before implementation.

## Not For

Use `bug-ripple` when one concrete bug suggests sibling bugs. Use `code-review` for a PR, diff, or broader code-quality audit. Use `safe-feature-slice` when you already know the fix scope and are ready to implement.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/logic-ripple
```

Restart Codex after installing new skills.
