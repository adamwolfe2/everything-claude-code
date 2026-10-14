# Thermo Nuclear Code Quality Review

## What This Skill Does

`thermo-nuclear-code-quality-review` is an extremely strict maintainability review. It looks for structural complexity, giant files, spaghetti branching, weak abstractions, and missed simplification opportunities.

## Use It When

- The user asks for a harsh maintainability review.
- Code seems to work but feels messy or fragile.
- A PR may be adding complexity that will hurt future work.
- You want direct feedback on architecture, decomposition, and readability.

## How It Works

The skill reviews code quality with a high bar. It flags structural regressions, needless abstractions, large files, branching sprawl, duplicated helpers, misplaced logic, and type-contract muddiness. It prefers fewer high-conviction findings over a long list of nits.

## What You Get

- Maintainability findings ordered by severity.
- Plain explanation of why the structure is costly.
- Concrete cleanup direction.
- Strong opinions on simplification and ownership boundaries.

## Not For

Use `code-review` for general correctness and merge-readiness. Use `one-major-issue` when the user wants only one confirmed issue.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/thermo-nuclear-code-quality-review
```

Restart Codex after installing new skills.
