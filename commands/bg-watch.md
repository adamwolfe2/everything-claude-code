---
name: bg-watch
description: Background agents + agent-loop harness. Launch a standing watcher over PRs/CI across repos, or run a bounded loop-until-dry harness that drains the research-queue with propose-only passes. The "background agents" and "agent loops" red tier.
---

# /bg-watch — background agents + agent loops

Two standing-agent patterns. Both are read-only / propose-only by default.

## 1. Background watcher (standing agent)

Polls open PRs + failed CI across Adam's repos every ~15 min, appends alerts to `~/.claude/bg-alerts.md`.

- One poll now (surface alerts in chat):
  `BG_WATCH_ONCE=1 ~/everything-claude-code/scripts/bg-watch.sh && tail -30 ~/.claude/bg-alerts.md`
- Run detached for the session (re-invokes you on exit) — launch via `run_in_background`:
  `~/everything-claude-code/scripts/bg-watch.sh`
- Tune cadence: `BG_WATCH_INTERVAL=600` (seconds). Edit the `REPOS=( … )` list in the script.

When alerts land, surface the top one in ONE line and propose the fix toolchain.

## 2. Agent-loop harness (loop-until-dry)

Bounded loop that drains `~/.claude/research-queue.md`: each iteration runs a headless,
propose-only pass on the highest-leverage open item and writes a proposal to
`~/.claude/overnight/loop-<date>.md`. Stops when the queue is dry or MAX iters hit.

`~/everything-claude-code/scripts/loop-harness.sh 3`   # max 3 iterations

HARNESS-ONLY, propose-only, semi-autonomous — never applies or merges. Review the doc,
then say `evolve` to apply winners. Product-repo items are skipped with a note.

## When to reach for these

- Watcher: leave running while you work — it catches a red CI or a stale PR you'd miss.
- Loop harness: when the research-queue has piled up and you want proposals drafted in
  one pass instead of one-at-a-time. Pairs with the weekly `/overnight` + evolve cadence.
