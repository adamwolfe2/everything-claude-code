# Code rules (merged from coding-style, git-workflow, security, performance, agents)

- Immutability: return new objects; never mutate inputs.
- Errors: no empty catch, no `catch { return [] }`; log with context and rethrow or return a typed error. Check `{ error }` on every supabase-js call.
- Validate at trust boundaries with zod, including third-party API responses (parse, do not cast). Parameterized queries only.
- Secrets from env only; fail closed when missing. No secrets in logs or error messages. Security issue found: stop, run security-reviewer, fix CRITICAL first.
- Files 200-400 lines typical, 800 max; functions <50 lines; nesting <=4; no console.log left behind.
- Commits: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci). Stage files explicitly. New commits over `--amend`. Never force-push main. Ship via `/cap`.
- PRs: review full `git diff <base>...HEAD`; title <=70 chars; body has a test plan; `gh pr create` with a heredoc.
- Spawn subagents only when Adam explicitly asks for subagents, delegation, or parallel agent work; dispatch independent bounded work in one message with disjoint write ownership. Delegation never grants browser control: agents stay headless unless Adam asks for his browser.
