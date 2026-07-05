# Cap

## What This Skill Does

`cap` verifies intended work, repairs safe verification failures when possible, commits only the right files, and pushes safely. It is the "finish this properly" workflow.

The skill now routes the run through the smallest mode that honestly proves the work, so tiny changes do not automatically inherit the full release/deployment watch path.

## Use It When

- You want current work checked, committed, and pushed.
- You want a clean commit without sweeping unrelated dirty files into it.
- You want verification failures fixed when the repair is safe and deterministic.
- You say `cap`, `cap fast`, `fast cap`, `cap dry-run`, `cap verify`, `cap only`, `cap watch`, or `cap release`.

## How It Works

The skill inspects git state, identifies the intended file set, chooses repo-appropriate checks, runs verification, fixes safe failures, stages exact paths, reviews the staged diff for secrets and scope drift, commits with a Conventional Commit message, then pushes when safe.

Fast mode keeps checks focused for tiny changes. Dry-run mode stops before mutating git or remote state. Release mode adds branch inventory, deployment watching, and bounded automatic deployment recovery.

## Everyday Calls

- `cap fast`: tiny docs, skills, copy, metadata, or focused one-file changes.
- `cap`: normal verification, exact commit, push, and short linked-deployment status check.

## Specialist Calls

- `cap release`: full verify/commit/push/deployment-watch/recovery path.
- `cap dry-run`: no-mutation rehearsal of what cap would do.
- `cap verify`: checks only.
- `cap watch`: deployment follow-through after a push.
- `cap only`: commit only the explicit/session file set.

## What You Get

- Verification summary.
- Exact files staged and committed.
- Commit message.
- Push result or clear blocker.
- Any skipped checks and residual risk.
- Behavior-preservation confidence when code or behavior changed.

## Not For

Do not use this when you only want a review. Use `code-review`, `one-major-issue`, or `launch-critical-sweep` first if the work is not ready to ship.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/cap
```

Restart Codex after installing new skills.
