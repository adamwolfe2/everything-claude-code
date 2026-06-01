# everything-claude-code (Adam Wolfe's setup)

Personal Claude Code configuration. Forked from [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code), then heavily reshaped around how I actually ship SaaS products: Next.js + Clerk + Prisma/Drizzle + Neon + Stripe + AI SDK, with strict preflight, money/permissions/RLS safety, and design craft.

This repo is symlinked into `~/.claude/` (agents, commands, rules, skills) so every project on this machine inherits the same setup.

```
~/.claude/agents    -> everything-claude-code/agents
~/.claude/commands  -> everything-claude-code/commands
~/.claude/rules     -> everything-claude-code/rules
~/.claude/skills    -> everything-claude-code/skills
```

---

## Layout

```
everything-claude-code/
|-- agents/             Specialized subagents (CEO, planner, tdd-guide, ...)
|-- commands/           Slash commands (/cap, /tdd, /plan, /qa, ...)
|-- skills/             Workflow/domain knowledge (impeccable, safe-feature-slice, ...)
|-- rules/              Always-follow guidelines (security, testing, git, ...)
|-- hooks/              hooks.json + Node-based session lifecycle scripts
|-- scripts/            Cross-platform Node implementations of hooks
|-- contexts/           Mode prompts (dev / review / research)
|-- mcp-configs/        MCP server definitions
|-- examples/           Sample project + user CLAUDE.md
|-- archive/            Skills/hooks parked out of the active selector
|-- .claude-plugin/     Plugin manifest (if I ever publish this)
```

---

## Agents (10)

| Agent | Role |
|---|---|
| ceo | Strategic orchestrator. Multi-step objectives. Delegates to others. |
| planner | Implementation planning, risk assessment, slice decomposition |
| architect | System design, scalability, tech decisions |
| tdd-guide | RED/GREEN/REFACTOR, 80%+ coverage enforcement |
| code-reviewer | Quality, maintainability, simplicity |
| security-reviewer | Auth, payment, PII, OWASP, RLS audits |
| build-error-resolver | Minimal-diff fixes for TS/build errors |
| e2e-runner | Playwright test generation + execution |
| refactor-cleaner | Dead code, dependency cleanup, knip/ts-prune |
| doc-updater | README + docs/CODEMAPS sync |

## Commands (slash)

Daily-driver core: `/init` `/plan` `/tdd` `/cap` `/qa` `/code-review` `/verify` `/build-fix` `/refactor-clean`

Extras: `/checkpoint` `/orchestrate` `/eval` `/learn` `/test-coverage` `/update-codemaps` `/update-docs` `/onboard-project` `/setup-pm`

The headline workflow is **`/cap`** — commit + push with full preflight (lint, types, tests, format, build, env sync, optional CodeRabbit, session memory extraction, push, deploy URL).

## Skills (live)

backend-patterns · catch-up · clerk · coding-standards · continuous-learning · eval-harness · frontend-patterns · impeccable · safe-feature-slice · security · security-review · strategic-compact · tdd-workflow · verification-loop · (plus marketing/cold-email and others added later)

Archived skills sit in `archive/` and stop polluting the selector. Add back per-project if needed.

## Rules

`security.md` · `coding-style.md` · `testing.md` · `git-workflow.md` · `agents.md` · `patterns.md` · `performance.md` · `performance-audit.md` · `hooks.md`

These are referenced from `~/.claude/CLAUDE.md` (the global instructions file). All projects inherit them.

## Hooks

Live in `hooks/hooks.json`. The important ones:

- **PreToolUse** — block `npm run dev` outside tmux, remind about tmux for long commands, block random `.md` file creation, suggest manual compaction at boundaries.
- **PostToolUse** — auto-Prettier on JS/TS edits, run `tsc --noEmit` after `.ts/.tsx` edits, warn on `console.log`, log PR URLs.
- **Stop** — audit modified files for `console.log` before session ends.
- **SessionStart / SessionEnd / PreCompact** — persistent memory and "continuous learning" pattern extraction.

These get merged into `~/.claude/settings.json` (the RTK hook stays — they compose).

## MCPs

Configured globally in `~/.claude.json`. Production set: Airtable, Slack, Notion, Gmail, Drive, Calendar, Asana, Microsoft 365, Stripe, Supabase, Vercel, Vibiz, Magic, Tavily, AirOps, Figma, Clerk, HubSpot, Mercury, n8n, blooio, emailbison.

Rule of thumb: 20–30 configured, ≤10 active per project, <80 tools live. Disable per-project via `disabledMcpServers` to keep context window healthy.

---

## Provenance

Net of integrations from external repos:

- **affaan-m/everything-claude-code** — original fork foundation
- **affaan-m/ecc** — selective: `/quality-gate`, `/harness-audit`, `/multi-plan`, `/multi-execute`; skills: `cost-aware-llm-pipeline`, `database-migrations`, `deployment-patterns`
- **coreyhaines31/marketingskills** — marketing skills: `cold-email`, `cro`, `onboarding`, `pricing`, `launch`
- **nextlevelbuilder/ui-ux-pro-max-skill** — CSV data + MASTER.md pattern merged into `impeccable`
- **JuliusBrussee/caveman** — `/caveman-commit`, `/caveman-compress`, `/caveman-stats`
- **gsd-build/gsd-2** — concepts only (slice/task decomposition into `planner`, `.claude/specs/` per-project state)
- **James Vanderhaak's workflow** — `safe-feature-slice` skill, `/cap` design
