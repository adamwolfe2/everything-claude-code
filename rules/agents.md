# Agent + Skill + Command Orchestration

The setup has three execution surfaces. Use the right one.

| Surface | When |
|---|---|
| **Slash command** | You want a specific deterministic workflow with predictable output |
| **Skill** | A trigger phrase matches; Claude auto-activates the right workflow with the right rules loaded |
| **Agent** | You want a sub-task done with isolated context, parallel execution, or a different model |

## Agents (`~/.claude/agents/`)

| Agent | Purpose | Trigger |
|---|---|---|
| `ceo` | Strategic orchestrator | Multi-domain objectives, ambiguous goals |
| `planner` | Slice/task decomposition, risk assessment | New feature, refactor |
| `architect` | System design | Architectural decisions, scalability |
| `tdd-guide` | Tests-first methodology | New code, bug fixes |
| `code-reviewer` | Quality + maintainability | Immediately after writing code |
| `security-reviewer` | OWASP / RLS / auth / payments | Auth/payment/PII surfaces |
| `build-error-resolver` | Minimal-diff TS/build fixes | Build fails, type errors |
| `e2e-runner` | Playwright generation + run | Critical user journeys |
| `refactor-cleaner` | Dead code, knip, ts-prune | Maintenance sweeps |
| `doc-updater` | README + CODEMAPS sync | Docs out of date |

## Skills (`~/.claude/skills/`)

Engineering / safety:
- `safe-feature-slice` — Tier-1 safety workflow (REQUIRED for money/auth/RLS/webhooks/state)
- `tdd-workflow` — write tests first, 80% coverage
- `security-review` — auth/input/secrets/payments checklist
- `coding-standards` — TS/JS/React/Node defaults
- `backend-patterns`, `frontend-patterns` — language defaults
- `clerk` — Clerk Backend + CLI
- `database-migrations` — schema changes, zero-downtime patterns
- `deployment-patterns` — CI/CD, Docker, rollback, prod-ready checklists
- `cost-aware-llm-pipeline` — LLM cost/routing/caching
- `agent-architecture-audit` — diagnostic for agent/LLM apps
- `codebase-onboarding` — analyze unfamiliar repo, generate guide
- `eval-harness`, `verification-loop` — evals on critical changes
- `continuous-learning` — auto-extract patterns at session end
- `strategic-compact` — manual compaction nudges at clean boundaries

Design / craft:
- `impeccable` — frontend craft. Honors `PRODUCT.md` + `DESIGN.md`. Now backed by ui-ux-pro-max CSV data (67 styles, 161 palettes, 57 type pairings, 99 UX rules, 16 stack templates) — see `impeccable/references/ui-ux-pro-max/`

Marketing / GTM:
- `product-marketing` — root context skill (creates `.agents/product-marketing.md`, other marketing skills reference it)
- `cold-email` — cold outreach + follow-ups
- `cro` — landing/pricing/form conversion optimization
- `pricing` — packaging, freemium, willingness-to-pay
- `launch` — Product Hunt, beta, GTM playbook
- `onboarding` — post-signup activation, first-run, time-to-value

## Slash Commands (`~/.claude/commands/`)

Daily core:
- `/init` — set up workspace at session start
- `/plan` — restate requirements, decompose into slices
- `/tdd` — TDD cycle for a feature
- `/cap` — **commit and push with full preflight (headline workflow)**
- `/qa` — browser walkthrough via Codex CLI
- `/code-review` — quality + security review of uncommitted changes
- `/verify` — build/types/lint/tests audit
- `/build-fix` — fix build errors
- `/refactor-clean` — dead code sweep
- `/onboard-project` — audit project against canonical template + scaffold missing pieces

Extras:
- `/checkpoint` — named checkpoints + comparison
- `/orchestrate` — sequential agent workflow (feature/bugfix/refactor/security)
- `/e2e` — Playwright test generation + run
- `/eval` — evaluation harness
- `/learn` — pattern extraction mid-session
- `/test-coverage` — coverage report
- `/update-codemaps` + `/update-docs` — sync docs
- `/setup-pm` — package manager config

Imported workflows:
- `/quality-gate` — ECC quality pipeline
- `/harness-audit` — audit Claude config itself
- `/multi-plan` + `/multi-execute` — multi-model plan/execute
- `/evolve` + `/prune` — continuous-learning v2 (instinct lifecycle)
- `/loop-start` — managed autonomous loop with safety defaults
- `/caveman-commit` — terse ≤50-char commit
- `/caveman-compress` — compress a verbose file
- `/caveman-stats` — token-saving stats

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

ALWAYS dispatch independent agent work in a SINGLE message with multiple Agent tool calls. Common parallel pairs:
- `code-reviewer` + `security-reviewer` after implementation
- Multiple subagents auditing different files
- Research agents reading different docs

## Immediate auto-activation

No user prompt needed:
1. Complex feature → `planner`
2. Code just written → `code-reviewer`
3. Bug fix or new feature → `tdd-guide`
4. Architectural decision → `architect`
5. UI/design language detected → `impeccable` skill
6. Tier-1 language detected (money, auth, RLS, webhook, state) → `safe-feature-slice` skill
