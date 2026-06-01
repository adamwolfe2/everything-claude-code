---
name: dashboard
description: One-shot status board for all known projects. Smaller than /morning-briefing — just facts, no recommendations. Use when you want a fast overview without spinning up the full briefing flow.
---

# /dashboard — Project status board

Fast (<15s). Reads MEMORY.md project index. For each project: branch, last commit, CI status, deployment state. No analysis, just facts.

## Output format

```
/dashboard — <timestamp>

Project       Branch          LastCommit    CI         Deploy      MRR    Notes
─────────────────────────────────────────────────────────────────────────────────
TaskSpace     main            2h ago        green      Ready       $4k    -
Trackr        testing/...     1h ago        green      Ready       $2k    13 ahead
Cursive       main            5h ago        green      Ready       $12k   -
TBGC          main            6d ago        n/a        n/a         -      stale
Wholesail     main            1d ago        green      Ready       -      DNS pending
Hook          main            3d ago        yellow     Building    $400   -
CampusGTM     main            12d ago       red        Error       -      missing env
VendCFO      main            4d ago        green      Ready       $100   -
MyVSL         main            2h ago        green      Ready       $1k    -
AMC           main            30m ago       green      Ready       -      internal
CreditOS      main            8d ago        red        n/a         -      Stripe bug
LeaseStack    main            1d ago        green      Ready       -      -
MySLP         main            1w ago        green      Ready       -      -
AIMS          phase-3-...     2d ago        green      Building    -      rebrand
```

## Implementation

Per project (parallel):
1. `cd <path> && git log -1 --format='%cr|%s' && git rev-parse --abbrev-ref HEAD`
2. `gh run list --repo <repo> --limit 1 --json status,conclusion`
3. `vercel ls --json | head -3` (if Vercel)
4. Stripe MRR (if MCP available)

Total time: ≤15s. Cache results at `~/.claude/dashboard-cache.json` with 5-min TTL.

## Hard rules

- Read-only. Never modifies project state.
- If a check times out (>5s), report `-` not `error`.
- Parallel all per-project calls.
- No emojis in output (use plain `green` / `yellow` / `red` text).
