# Issue Fix Strategy

## What This Skill Does

`issue-fix-strategy` turns a messy pile of issues into a blunt, plain-English fix strategy. It is chat-only and does not create plan files or edit code.

## Use It When

- You have review findings, UX complaints, screenshots, logs, failing tests, or tool output.
- You want to know what each issue is and why it matters.
- You want priorities and a fix order before implementation.
- You want the agent to make the obvious calls and ask only material clarifying questions.

## How It Works

The skill normalizes the issue list, merges duplicates, separates symptoms from likely root causes, ranks each issue, recommends a fix path, names behavior that must not regress, and identifies proof needed before work is called done.

It ends by routing to the right next step.

## What You Get

- Executive call.
- Priority order.
- Plain-English explanation per issue.
- Fix approach.
- Regression protection.
- Proof required.
- Next suggested step.

## Not For

Use `feature-graph-plan` when the strategy is already clear and ready to become graph nodes. Use `feature-intake-grill` when a missing decision materially changes scope or safety. Use `safe-feature-slice` when the work is one narrow fix on a risky surface and a full dependency graph would be overhead.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/issue-fix-strategy
```

Restart Codex after installing new skills.
