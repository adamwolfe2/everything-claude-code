# Git Workflow

## Default ship path: `/cap`

Use `/cap` instead of raw `git commit && git push`. It runs the full preflight (lint, types, tests, format, build, env sync, optional CodeRabbit), then commits and pushes. Use it for every ship.

For commit message generation only (no checks, no push), use `/caveman-commit` — terse ≤50-char conventional commit from the staged diff.

## Commit Message Format

```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Attribution: disabled globally via ~/.claude/settings.json. Do NOT include `Co-Authored-By: Claude` lines.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft a comprehensive PR title (≤70 chars) and body
4. Include a test plan checklist
5. Push with `-u` flag if new branch
6. Use `gh pr create` with a HEREDOC for the body

## Feature Implementation Workflow

1. **Plan First**
   - Use `planner` agent — decompose into milestones → slices → tasks
   - Write each slice spec to `.claude/specs/YYYY-MM-DD-<slug>.md`
   - Tier-1 slices (money, auth, RLS, webhooks, state transitions) MUST use the `safe-feature-slice` skill

2. **TDD Approach**
   - Use `tdd-guide` agent
   - Write failing test first (RED)
   - Implement to pass (GREEN)
   - Refactor (IMPROVE)
   - Verify 80%+ coverage

3. **Code Review**
   - `code-reviewer` immediately after writing code
   - For auth/payment/PII: also `security-reviewer` (in parallel)
   - Address CRITICAL and HIGH issues before continuing

4. **QA (optional, for UI changes)**
   - `/qa` — browser walkthrough via Codex CLI
   - `/e2e` — Playwright regression net

5. **Ship**
   - `/cap` — preflight, commit, push
   - Blocks if any check fails

## Hard rules

- Never use `--no-verify` to bypass hooks
- Never force-push to main/master
- Never commit `.env*` files
- Always create NEW commits over `--amend` (especially after a pre-commit hook failure — the working tree may be confused)
- Stage files explicitly (`git add path1 path2`) instead of `git add -A` or `git add .`
