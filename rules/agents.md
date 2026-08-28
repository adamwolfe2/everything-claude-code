# Agent + Skill + Command Orchestration

The setup has three execution surfaces. Use the right one.

| Surface | When |
|---|---|
| **Slash command** | You want a specific deterministic workflow with predictable output |
| **Skill** | A trigger phrase matches; Claude auto-activates the right workflow with the right rules loaded |
| **Agent** | You want a sub-task done with isolated context, parallel execution, or a different model |

Inventories of agents, skills, and commands are NOT listed here — the session listing already shows every one with its description. This file keeps only routing judgment.

## Decision Matrix

| Situation | Use |
|---|---|
| Multi-domain objective, unclear scope | `ceo` agent |
| New feature, multi-file | `planner` → slice specs → `tdd-guide` → `code-reviewer` + `security-reviewer` (parallel) → `/cap` |
| Tier-1 work (money/auth/RLS/webhooks) | `safe-feature-slice` skill activates automatically; verify before `/cap` |
| Build broke | `build-error-resolver` agent or `/build-fix` |
| UI/design work | `impeccable` skill auto-activates on design language |
| Marketing copy (landing page, cold email, launch) | corresponding marketing skill |
| Ready to ship | `/cap` |
| Browser walkthrough QA | `/qa` |
| Regression test journey | `/e2e` |
| File is too verbose | `/caveman-compress <file>` |
| New project / unfamiliar codebase | `/onboard-project` then `codebase-onboarding` skill |

## Parallel execution

Spawn subagents when the user explicitly asks for subagents, delegation, parallel agents, or parallel agent work and the active runtime allows it. That authorization applies to the current requested work; do not silently carry it into unrelated future work.

When explicitly authorized, dispatch independent bounded work in a SINGLE message with multiple Agent tool calls. Give each agent exact scope and disjoint write ownership. Common parallel pairs:
- `code-reviewer` + `security-reviewer` after implementation
- Multiple subagents auditing different files
- Research agents reading different docs

Delegation does not expand tool permissions. In particular, it does not authorize any agent to open, focus, or control the user's browser. Each agent must use headless or read-only methods unless the user separately and explicitly requests browser control.

## Immediate auto-activation

No user prompt needed:
1. Complex feature → `planner`
2. Code just written → `code-reviewer`
3. Bug fix or new feature → `tdd-guide`
4. Architectural decision → `architect`
5. UI/design language detected → `impeccable` skill
6. Tier-1 language detected (money, auth, RLS, webhook, state) → `safe-feature-slice` skill
