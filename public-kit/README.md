# Claude Code Starter Kit — a self-improving harness

A sanitized, public version of a deep Claude Code setup: recursive learning loops, agent
teams, a self-training intent router, eval-gated self-improvement, autonomous routines, a
custom MCP, and CI/CD run by agents. Strip-mined of personal data — fork it and make it yours.

> This is the *architecture*, not someone's private config. No project names, secrets, or
> client data. Everything here is a pattern you can adopt.

---

## The idea: a harness that gets better on its own

Most people use Claude Code as a chatbot. The next levels are about turning it into a
**system that compounds** — it learns from your sessions, surfaces the right tool, and
improves its own skills against a frozen eval set. The loop:

```
work → log mistakes + telemetry → weekly digest mines the signal →
  propose harness mutations → eval-gate them → keep only winners →
  better harness → better work → (repeat, forever)
```

Nothing here asks permission to *propose*. Promotion to your actual config is always
human-reviewed and eval-gated. That's the safety contract.

---

## What's inside

| Piece | File(s) | What it does |
|---|---|---|
| **Autopilot contract** | `CLAUDE.md.example` | How Claude behaves: orient → propose → confirm → execute. Tight output, hard stops, routing. |
| **Intent router** | `routing.json`, `scripts/hooks/intent-router.js` | Reads your prompt every turn, surfaces the right tool. You never memorize 80 commands. Self-trains from a log. |
| **Proactive recommender** | `scripts/suggest.js` | Opens each session with a ranked *do / ask / try / say* list from real state (git, PRs, queue). Project-aware. |
| **Agent teams (workflows)** | `workflows/*.js` | `parallel-review` (multi-reviewer + adversarial verify), `eval-fix-loop` (agent fixes its own tests), `harness-evolve` (self-improvement). |
| **Frozen eval set** | `evals/*.example` | The judge. Mutations only promote if they beat the eval set with no regression. |
| **Custom MCP** | `mcp-servers/harness-state/` | Zero-dep MCP exposing your own state (memory/decisions/telemetry) as queryable tools. |
| **CI/CD agent** | `templates/github/claude-agent.yml` | GitHub Action: auto-review every PR + `@claude` mention-to-fix. |
| **Token-economy hooks** | `scripts/hooks/context-budget.js`, `read-discipline.js` | Curb the #1 cost driver (marathon sessions) — gate on context size AND turn count. |
| **Skills / commands / agents** | `skills/`, `commands/`, `agents/` | The reusable workflows (`/cap` ship pipeline, review skills, TDD, design, etc.). |

---

## The capability tiers (what to activate, in order)

1. **Hooks** — automate behavior the model can't enforce itself (format-on-save, token guards, nudges).
2. **Skills + slash commands** — package repeatable workflows (`/cap` = preflight+commit+push; `/qa` = browser walkthrough).
3. **Subagents + parallel agents** — isolated context, run reviewers concurrently.
4. **Intent router + proactive suggest** — stop memorizing; the harness routes for you.
5. **Eval-gated self-improvement** — a frozen eval set + a mutation loop = the setup compounds.
6. **Routines / headless runs** — cron a daily digest + weekly evolve so the loop turns unattended.
7. **Agent teams (workflows)** — orchestrate many agents deterministically (review, fix, migrate).
8. **Custom MCP + CI/CD agents** — expose your own tools; put agents in your pipeline.

---

## Setup

```bash
# 1. Clone, then copy the example config into place
cp CLAUDE.md.example ~/.claude/CLAUDE.md         # edit: your name, rules, projects
cp settings.json.example ~/.claude/settings.json # edit: paths to the hook scripts
cp projects.json.example ./projects.json          # edit: your repos + conventions

# 2. Symlink the teachable dirs into ~/.claude (or copy)
ln -s "$PWD/skills"    ~/.claude/skills
ln -s "$PWD/commands"  ~/.claude/commands
ln -s "$PWD/agents"    ~/.claude/agents
ln -s "$PWD/workflows" ~/.claude/workflows

# 3. (optional) register the custom MCP
claude mcp add harness-state -- node "$PWD/mcp-servers/harness-state/server.js"

# 4. Rename the eval examples and start your own
cp evals/harness-evals.jsonl.example evals/harness-evals.jsonl
```

Then read `CLAUDE.md.example` top to bottom — it's the operating manual.

---

## How the self-improvement actually works

- **Mistakes are fuel.** Every bug you fix gets logged as a one-line lesson + a regression
  eval. The eval means the harness can't relapse into that bug class.
- **The eval set is the judge.** A weekly loop proposes changes to your skills/rules, applies
  each on a branch, scores it against the frozen evals, and keeps only the winners. You merge.
- **The router trains itself.** Every tool suggestion is logged; misroutes become routing fixes.
- **Coverage never rots.** A guard flags any new skill/command with no routing entry.

This is the "autoresearch" pattern: *git is the memory, the metric is the judge, the human
writes the eval criteria, and the agent doesn't ask permission to experiment.*

---

## License

MIT. Learn from it, fork it, make it weird. Attribution appreciated, not required.
