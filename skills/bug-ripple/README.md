# Bug Ripple

## What This Skill Does

`bug-ripple` starts with one reported bug, works out the real root cause, then checks nearby code for sibling bugs caused by the same bad assumption. It is a strict, bounded blast-radius review, not a repo-wide audit.

## Use It When

- One bug feels like a sign that the same pattern may exist elsewhere.
- You want to know "what else could break like this?"
- You want a fix menu before implementation starts.
- You need sibling issues confirmed with file and line evidence.

## How It Works

The skill first diagnoses the original bug and names the user impact, root cause, location, prove-it test, and likely fix. Only after that does it build a small blast-radius scope and search for related failures. When explicitly authorized and available, it can use parallel read-only agents for separate risk lanes.

## What You Get

- Original bug diagnosis with a structural-signal call.
- Bounded blast-radius scope.
- Confirmed sibling bugs, if any, ranked as BLOCKER, MAJOR, or MODERATE.
- Structural risk in the blast radius when it materially increases sibling-bug risk.
- Missing tests and prove-it test ideas.
- A fix menu ordered by impact.

## Not For

Use `code-review` or `launch-critical-sweep` for broader audits. Use `safe-feature-slice` when you are ready to fix the confirmed issues.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/bug-ripple
```

Restart Codex after installing new skills.
