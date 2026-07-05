# One Major Issue

## What This Skill Does

`one-major-issue` finds at most one high-impact confirmed issue. It is for a sharp answer, not a backlog.

## Use It When

- The user asks for the single biggest problem.
- You need one high-confidence review finding.
- A repo audit should return one actionable issue.
- You want the next fix to be narrow enough for `safe-feature-slice`.

## How It Works

The skill investigates the repo read-only, looks across the highest-risk surfaces, and reports only the strongest confirmed issue. If no major issue can be responsibly confirmed, it says so and names the best next investigative target.

## What You Get

- One issue title.
- Why it matters.
- Evidence with file and line anchors.
- Reproduction or verification path.
- Fix direction.
- Suggested `safe-feature-slice` handoff.
- Confidence level.

## Not For

Use `code-review` for a normal list of findings. Use `launch-critical-sweep` for pre-launch P0/P1 coverage across multiple critical surfaces.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/one-major-issue
```

Restart Codex after installing new skills.
