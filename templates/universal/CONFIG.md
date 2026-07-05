# CONFIG SPLIT — global vs per-project

Evidence: permissions posture currently ranges from `bypassPermissions` (cursive) to allow-all (5 repos) to none (vendcfo, steel-trap). Plaintext API keys sit in ~/.claude/settings.json. This defines the target state.

## Global (~/.claude, symlinked from everything-claude-code)

| Item | Ruling |
|---|---|
| CLAUDE.md | Behavior contract only (autopilot, vocabulary, token economy). Target ≤1,500 words — currently 3,012 with drifted prose. Facts live in data files (routing.json, projects.json), not prose |
| CODING_STANDARDS.md | Single source for conventions. Rules/coding-style.md, patterns.md, testing.md fold INTO it (3 files → 1); performance-audit.md moves to skills (it's a prompt, not a rule) |
| skills/, commands/, agents/, workflows/ | Global. Never copy into repos |
| Hooks | Global in settings.json. Per-repo hooks only for repo-specific automation (vendhub asana fetch is the model) |
| MCP servers | Global: harness-state, aside ONLY. Everything else project-scope — each global server's tool defs load every session in every repo |
| Secrets | NEVER in settings.json (blooio + emailbison keys are there today, plus tracked .bak). Move to env refs / keychain; rotate both |

## Per-project (repo/.claude/ + repo root)

| Item | Ruling |
|---|---|
| CLAUDE.md | From CLAUDE.md.template. Facts + deltas + gotchas ONLY — global standards not restated |
| settings.json | Standard posture below. bypassPermissions nowhere |
| .mcp.json | Project's own servers (supabase w/ project_ref, vercel scope) |
| specs/ | Slice specs + session handoffs (already good practice — keep) |
| REVIEW_CHECKLIST.md | Copy from template; append repo-specific gates |

## Standard project settings.json

```json
{
  "permissions": {
    "allow": [
      "Read(*)", "Glob(*)", "Grep(*)",
      "Bash(git *)", "Bash(pnpm *)", "Bash(npx tsc*)", "Bash(npx *)",
      "Edit(*)", "Write(*)"
    ]
  }
}
```
Rationale: reads + build/test free; deploys, deletes, env mutation, MCP writes stay prompted. Tighten per-repo for Tier-1-heavy codebases.

## Session hygiene (from the token audit — enforced by habit, nudged by hooks)

- Compact or hand off to specs at task boundaries; don't ride 500K+ context (43% of turns did)
- Grep → Read range; never full-read big files; never re-read unedited files (423 wasted re-reads)
- MCP list calls always take limit/filter
- Model: cheapest sufficient; Haiku for fan-out workers
