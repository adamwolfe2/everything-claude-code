---
name: health
description: Health-check the Claude Code setup itself — every hook, every CLI dependency, every MCP, every script. Reports broken bits. Use weekly or when something feels off.
---

# /health — Setup health audit

Pings every moving part. Fast (<10s). Reports what's broken.

## Checks (run in parallel)

### 1. CLI dependencies
For each: `<cli> --version` (with timeout). Report version or "missing".
- `node`, `npm`, `pnpm`, `bun`, `yarn`
- `gh`, `git`
- `vercel`
- `coderabbit`, `codex`
- `rtk`
- `prettier`, `tsc` (via `npx`)
- `playwright`

### 2. MCP servers (from ~/.claude.json + ~/.claude/settings.json)
For each configured MCP, attempt a lightweight ping (list resources / echo). Report:
- Connected / Connecting / Failed (with reason)

### 3. Hook scripts
For each script in `~/.claude/everything-claude-code/scripts/hooks/`:
- File exists, syntactically valid (`node -c <file>`), no obvious error on dry-run

### 4. Skills/commands
- Count files in `~/.claude/skills/` and `~/.claude/commands/`
- Validate frontmatter on each (must have `name:` and `description:`)
- Report any malformed

### 5. Telemetry
- `~/.claude/telemetry.jsonl` exists, readable, last write within 7 days
- Last 10 events parseable

### 6. Knowledge
- `~/.claude/knowledge/decisions/` count
- Index up to date (run knowledge rebuild if needed)

### 7. Memory
- `~/.claude/projects/-Users-adamwolfe/memory/MEMORY.md` exists, under 200 lines

### 8. RTK
- `rtk gain` works (not "command not found")

## Output

```
/health Report — <date>

CLIs
  node 25.4.0       OK
  pnpm 9.x          OK
  coderabbit 0.5.2  OK (not authenticated — run `coderabbit auth login`)
  codex 0.36.0      OK
  gh 2.x            OK
  vercel ...        OK
  rtk ...           OK

MCPs (22 configured, 18 active)
  Asana             OK
  Stripe            FAILED (timeout)
  Notion            OK
  ...

Hooks (12)
  rtk-bash          OK
  scope-check.js    OK
  taste-lint.js     OK
  ...

Skills/Commands
  26 skills, 29 commands, 10 agents
  All frontmatter valid

Telemetry
  Last event: <ts> (<n> events total)

Knowledge
  <n> decisions indexed

Memory
  MEMORY.md: <n> lines (limit 200)

Issues:
  - CodeRabbit not authenticated
  - Stripe MCP unreachable
  - <n> commands haven't fired in 30 days: /caveman-stats, /prune

Recommendations:
  - Run `coderabbit auth login`
  - Check Stripe MCP token in ~/.claude.json
  - Review low-usage commands for pruning
```

## Hard rules

- Health checks are READ-ONLY. Never modify config.
- Each check has a 5-second timeout. Don't hang.
- If `~/.claude/` doesn't exist, this isn't an Adam Wolfe machine — bail with a friendly note.
