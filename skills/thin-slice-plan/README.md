# Thin Slice Plan

## What This Skill Does

`thin-slice-plan` turns broad work into a dependency-ordered plan made of small, safe, verifiable slices. It plans only; it does not implement.

## Use It When

- The user asks to plan, slice, sequence, or stop before implementation.
- A feature, fix, or audit report is too broad to execute as one step.
- Work touches multiple risk surfaces and needs careful order.
- Existing planning docs are vague, monolithic, or unsafe to resume.

## How It Works

The skill builds a working brief, names the core invariant, identifies previous behavior to preserve, surfaces unsafe outcomes, classifies risk tiers, and decomposes the work into small slices with dependencies, acceptance signals, verification paths, and stop conditions.

## What You Get

- `plans/<feature-slug>/slice-plan.md`.
- Working brief.
- Dependency graph.
- Blocked decisions.
- Slice-by-slice verification plan.
- Next safe slice.

## Not For

Use `safe-feature-slice` when you want planning plus implementation. Use `feature-orchestrator` for whole-feature graph execution with worker waves.

## Install

```bash
$skill-installer install https://github.com/vanderhaka/skills/tree/main/skills/.curated/thin-slice-plan
```

Restart Codex after installing new skills.
