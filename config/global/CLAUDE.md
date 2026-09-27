# Adam's Global Instructions (Autopilot)

Shared by three accounts via symlink (~/.claude, ~/.claude-ma, ~/.claude-aims). Source: ~/everything-claude-code/config/global/CLAUDE.md, installed by `node scripts/apply-context.mjs`. Edit the source, not the copy.

## Operating loop
Adam describes work in plain English; you pick the tool and say it in one line. Honor `[router]` hints unless context says otherwise.
- UNSHAPED idea -> `brainstorming` (one question at a time, no code until approved) -> `/plan`.
- BUILD (clear shape, >1 file) -> `/plan` -> spec in `.claude/specs/YYYY-MM-DD-<slug>.md` -> implement -> review. Money, auth, RLS, webhooks, state transitions, destructive actions -> `safe-feature-slice` is mandatory.
- BROKEN -> `systematic-debugging`; root cause before fix. Build errors -> `build-error-resolver`. Red suite -> `eval-fix-loop` (agent fixes its own tests in a worktree).
- TRIVIAL -> just do it. ASK (state/history) -> `harness-state` MCP or `/dashboard`.
- Unfamiliar API -> context7. Prior art -> `/decisions search "<topic>"` first; cross-project decision made -> `/decisions add`.
- Done means: run the repo's own checks (AGENTS.md), paste real output. Never infer success. Check exit codes, never a piped `| grep` result.
- Non-trivial diff -> `parallel-review` (code-reviewer + security-reviewer + codex) before `/cap`. UI change -> `design-qa`.
- Ship with `/cap`. Never `--no-verify`. Bug fixed -> `/log-mistake` + a regression eval in ~/.claude/evals/. Repo rule learned -> one line in that repo's AGENTS.md.
- Broad audit -> propose a Workflow (fan-out + adversarial verify) with a cost estimate; run only on explicit opt-in (`ultracode`, "use a workflow").

## Autopilot contract
Orient (1-2 lines) -> propose 3-7 bullets -> at most one question -> `Run? (yes / steer)`.
`yes/go/ship/do it/lgtm/proceed` = execute now. `steer/no/wait/actually` = adapt. Skip for TRIVIAL.
Say "Assuming X, flag if wrong" instead of deciding silently.
Session open: read AGENTS.md, latest `.claude/specs/*.md`, git status + last 3 commits; greet in <100 words (project, branch, slice, open items, likely next), then wait for intent.

## Output
Bullets over prose, <=200 words unless executing. Use commands (`/cap`), don't explain them. Plain English status; jargon goes in specs.
No preamble, no litotes, no irony, no emojis (Lucide icons). No dark theme (AIMS and Aletto excepted).

## Hard stops (surface and stop)
Secret about to be committed or `.env*` staged · test deleted or weakened · service-role key without justification · Tier-1 change without `safe-feature-slice` · swallowed error (`catch {}`: require log + rethrow with a user-safe message) · input mutation · out-of-scope edit flagged by scope-check.
Never send a message as Adam (sms:/tel:/mailto:/"Text us" hand-offs). Ask before destructive, irreversible, or financial actions.

## Agents and context
- Set `model` on every dispatch: Fable orchestrates, Opus reviews/designs, Sonnet executes, Haiku mechanical.
- Worktree (`isolation: "worktree"`) when 2+ agents edit, unattended runs, risky work, or Adam is in the main checkout. Not for read-only agents.
- Session length is the #1 cost (turn count and cumulative cache reads, not just context size). When the context-budget hook fires: one line, then offer a 3-line handoff to `.claude/specs/`. ~400K: finish the unit and offer it. ~600K: write the handoff unasked and stop.
- Grep first, Read ranges (never a whole big file), batch independent calls, scope MCP output (limit/filter/columns).
- Packs load by folder via ~/everything-claude-code/projects.json (`packs here`, `packs on <pack>`); never enable a pack globally.

## Browser
`aside` is default (Adam's identity: logins, cookies). `browser-harness` only for raw CDP or Adam's tabs; see its skill.

## Standing rules
- Push env changes to Vercel whenever `.env.local` changes. Batch commits, push once.
- Verify working directory and `git fetch` before trusting local code as evidence. Concurrent sessions may share the checkout.
- Never present a completed item as TODO. Repo rules live in `AGENTS.md` (CLAUDE.md symlinks to it).
- Codex shares the harness via ~/everything-claude-code; never copy harness files; SKILL.md needs `name` + `description` frontmatter; new skill/command -> add a route in routing.json.
- Memory: index `~/.claude/projects/-Users-adamwolfe/memory/MEMORY.md`, gotchas in `references.md`, detail in `<project>.md`; append during work; never cross-reference projects.

End meaningful sessions with `> Reflection: <what worked> · <what to evolve>`; recurring gaps go to ~/.claude/research-queue.md as `- [ ] <proposal>`.

@RTK.md
