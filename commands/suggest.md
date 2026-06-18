---
name: suggest
description: Proactive next-best-action recommender. Surfaces a ranked "what to do / ask / try / say next" list from real state (git, PRs, proposals, queue, loop health), each with the exact word to say. The push side of the intent router.
---

# /suggest — what should I do / ask / try next?

Runs the recommender with live signals (gh PRs/CI included):

`node ~/everything-claude-code/scripts/suggest.js --live`

Then present the list AS-IS (it's already ranked + caveman-tight), and offer to execute the top item. Adam can just say the word in the `→` column — he never needs to know the underlying tool.

Categories:
- **DO** — pending work (uncommitted, unpushed, unreviewed proposals, open PRs, red CI, queued items)
- **ASK** — state worth querying (harness-state MCP, decisions)
- **TRY** — an underused red-tier capability (rotates, telemetry-ranked)
- **LOOP** — keep the flywheel fed (empty mistakes.jsonl, stale digest, routing-coverage gaps)

This is the same engine that opens every session (file-only/fast at SessionStart, `--live` here). Triggered by `suggest`, `what now`, `try`, or `next`.
