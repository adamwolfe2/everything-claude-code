# Verification and Repair

Run code verification and env sync checks in parallel only when their outputs and generated files are isolated.

## Parallel Safety

- Only parallelize checks when their outputs are isolated.
- Do not parallelize commands that write the same generated output, cache, build directory, test database, lockfile, or other shared state.
- For Next.js and similar frameworks, do not run `build` and typecheck in parallel when either command may touch shared generated types such as `.next/types`.
- For database-backed tests, serialize test commands unless each process has an isolated database.

## Fast Mode

Start from the changed files and identify the smallest command that proves the intended behavior or packaging contract.

- For Codex skill changes, prefer `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py <skill-folder>` when available, plus the repo's skill validator or public-safety audit when publishing a skills repository.
- For docs-only changes, use configured markdown, link, formatting, or repository validators if they exist. If none exist, use staged-diff review plus public-safety or spell/link spot checks relevant to the change.
- For a tiny source-code change, run the most focused test, typecheck, lint, or smoke that covers the touched path.
- Use normal cap if no focused command gives meaningful coverage.
- Do not let fast mode hide a known red baseline. If the repo documents a required cap command for the changed surface, either run it or explicitly report why this request is a focused exception.

## Node / JS / TS

- Lint: repo lint script if present, otherwise `eslint` if configured.
- Typecheck: repo typecheck script or `tsc --noEmit` if TypeScript is present.
- Format check: only if a formatter is configured.
- Tests: repo test script if it is real, or the established project runner.
- Build: repo build script if present.
- Structural analysis: run `fallow audit --no-cache` when the repo has adopted Fallow. For unadopted repos, use `npx fallow --no-cache`, `npx fallow dead-code --no-cache --format json`, `npx fallow dupes --no-cache --format json`, or `npx fallow health --no-cache --format json` only when dead code, duplication, complexity, dependency drift, circular imports, or boundary drift are relevant to the change.
- Do not apply `fallow fix` during cap unless the user explicitly asked for cleanup and the dry run has been reviewed.

## Python

- Lint: `ruff check .` or `flake8`.
- Typecheck: `mypy` when configured.
- Tests: `pytest`.
- Format check: `black --check .` when configured.

## Other Ecosystems

Use the standard lint, test, build, migration, or smoke commands when they are clearly configured in the repo. If the repo does not make commands clear, say so instead of inventing commands.

## Vercel Env Sync Check

Skip silently if the `vercel` CLI is unavailable or no project is linked.

- Extract key names from `.env.local`, ignoring blank lines and comments.
- Never print `.env.local` values.
- Use a line-based parser that reports only key names or redacted presence flags.
- Run `vercel env ls` for the linked project.
- Compare both directions:
  - local-only keys: missing at deploy time
  - Vercel-only keys: stale or not pulled locally
- Report mismatches as warnings, not blockers.

For auth-capable web apps, sanity-check public URL and auth redirect envs:

- Identify URL-like keys such as `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `SITE_URL`, `APP_URL`, `AUTH_URL`, `NEXTAUTH_URL`, `SUPABASE_AUTH_EXTERNAL_*`, and callback or redirect URL vars.
- Never print secret values. It is acceptable to print non-secret public URL origins and redacted presence flags.
- Flag production URL values that are localhost, preview-only domains, missing `https://`, or contain leading/trailing whitespace/newlines.
- If Supabase auth is used, verify the app builds recovery and invite links through the intended public origin and callback route, not `window.location.origin` alone when that could inherit localhost or a preview URL.
- If the Management API token is not safely available, do not guess or mutate Supabase Auth settings. Report required dashboard checks instead: Auth Site URL should be the production domain, redirect allowlist should include the callback route, and recovery/invite templates should use `{{ .ConfirmationURL }}` unless the app intentionally verifies tokens itself.
- When a URL env value is changed, trigger or watch a fresh deployment before declaring release complete, because Vercel env changes are only picked up by new deployments.

## Failure Handling

When a required check fails, first decide whether it is safe to repair locally, even if the failure is outside the user's intended diff.

- Keep requested changes and verification-repair changes distinct in reasoning and staging.
- Do not stop at the first "unrelated existing file" failure if restoring green is straightforward and reviewable.

Lint or format failures:

- Auto-fix when the tool supports it.
- Keep only safe, mechanical fixes.
- Re-run the check.
- Limit to 3 fix loops per category.

Typecheck or build failures:

- Fix when failures are caused by the current changes or when a baseline failure has a clear, local, deterministic repair.
- Safe examples include stale imports, drifted type signatures, broken test typings, or narrow config mismatches.
- If the repair touches files outside the intended scope, prefer a separate preparatory commit when that keeps history clearer.
- Re-run after each fix.
- Limit to 3 fix loops per category.

Test failures:

- Fix failures when they are local and deterministic, including safe baseline failures that block green verification.
- If failures look flaky, environment-specific, externally blocked, or risky to diagnose automatically, stop and report them instead of guessing.
- If required services, env vars, or fixtures are missing, say so explicitly.
- Limit to 3 fix loops per category.

Baseline failures outside the intended diff:

- Treat green verification as the preferred outcome, not proof that the current task must stop.
- Repair the baseline when the change is small, reviewable, and unlikely to hide product decisions.
- If restoring green requires extra files, keep them out of the feature commit when a separate repair commit is clearer.
- If the repair is tiny and inseparable from the main change, one commit is acceptable, but explain it in the commit body and summary.

Hard stop:

- Stop before committing if required verification still fails after bounded repair attempts, unless the user explicitly authorizes a best-effort commit.
