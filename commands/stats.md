---
name: stats
description: Show telemetry stats from ~/.claude/telemetry.jsonl — sessions, commands fired, skills triggered, failures, per-project breakdowns. Use to see what's actually being used vs what's noise.
---

# /stats — Telemetry summary

Reads `~/.claude/telemetry.jsonl` (the unified event log) and produces a report.

## Arguments

`$ARGUMENTS` optional:
- `--since 7d` (default) — last N days. Accepts `7d`, `30d`, `90d`, `all`.
- `--project <name>` — filter to one project
- `--type <eventType>` — filter to one event type
- `--raw` — dump events instead of summary

## Execution

Run:

```bash
node -e "
const t = require('/Users/adamwolfe/everything-claude-code/scripts/lib/telemetry.js');
const args = process.argv.slice(1);
const sinceArg = args.find(a => a.startsWith('--since=')) || '--since=7d';
const days = parseInt(sinceArg.replace('--since=', ''), 10) || 7;
const since = new Date(Date.now() - days * 86400000).toISOString();
const s = t.summarize({ since });
console.log(JSON.stringify(s, null, 2));
" -- --since=7d
```

Then format and report:

```
/stats — Last 7 days

Sessions: <n>
Total events: <n>

Top commands:
  /cap         12x
  /qa           5x
  /code-review  4x

Top skills:
  safe-feature-slice  8x
  impeccable          6x
  tdd-workflow        5x

Per-project activity:
  trackr      45 events
  cursive     32 events
  amcollective 28 events

Failures (3):
  - /cap blocked on trackr [missing env var X]
  - command.fail on cursive [tsc errors]
  - ship.fail on aims [Vercel build timeout]

Skills triggered 0x (candidates for /prune):
  - clickhouse-io, prompt-injection, ...
```

## Insights

If a command fires <5x in 30 days → flag as low-usage.
If a skill is in `~/.claude/skills/` but never triggers → flag for prune.
If failures concentrate in one project → suggest `/health <project>` to diagnose.

## Hard rules

- Never modify the telemetry file.
- If `~/.claude/telemetry.jsonl` doesn't exist, report "No telemetry yet — hooks may not be wired" and exit gracefully.
