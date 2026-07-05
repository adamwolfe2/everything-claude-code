# Launch Critical Sweep

## What This Skill Does

`launch-critical-sweep` looks for confirmed P0/P1 blockers before launch. It focuses on things that could break trust immediately: auth, payments, destructive actions, data loss, migrations, deployment, and critical user journeys.

## Use It When

- A product is about to go live.
- The user asks for launch blockers or catastrophic risks.
- You need confirmed critical issues, not a long backlog.
- The app touches money, ownership, customer records, webhooks, or production configuration.

## How It Works

The skill inspects the riskiest launch surfaces and only reports issues that meet a high evidence bar. It avoids flooding the user with lower-priority cleanup. Each confirmed blocker gets a narrow fix handoff.

## What You Get

- Confirmed P0/P1 blockers only.
- Evidence-backed impact.
- File, route, or workflow anchors.
- Fix direction.
- Handoff to `safe-feature-slice` for each blocker.

## Not For

Use `code-review` for normal merge review. Use `thin-slice-plan` or `issue-fix-strategy` for broader backlog triage.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/launch-critical-sweep
```

Restart Codex after installing new skills.
