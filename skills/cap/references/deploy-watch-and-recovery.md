# Deploy Watch and Recovery

Use this reference for `cap release`, `cap watch`, or a plain `cap` that escalates because release proof is required.

## When to Watch

Run the full deployment watch when:

- the user asks for `cap release`, deploy, production proof, or live verification
- the change touches deployment config, env vars, public runtime behavior, auth redirects, payments, webhooks, cron, migrations, or other release-sensitive surfaces
- repo memory or local continuity says a deploy watch is expected for this project
- the latest linked deployment reports `Error` or `Canceled`

For plain `cap` on low-risk changes, a short post-push deployment status check is enough unless one of the escalation conditions applies.

## Vercel Status Check

Skip silently if `vercel` is unavailable or the repo is not linked.

- Check the latest deployment with plain `vercel ls`; this installed CLI rejects `--limit`.
- Treat the first deployment row as the newest deployment, or use the URL printed first after the table.
- If the latest deployment is already `Ready`, `Error`, or `Canceled`, report it inline.
- For a full watch, continue polling every 60 seconds until terminal status.

## Full Vercel Deployment Watch

- Stop the watch when deployment reaches `Ready`, `Error`, or `Canceled`.
- Treat `Ready` as success.
- Treat `Error` or `Canceled` as the start of automatic recovery, not the end of the flow.
- If the watch cannot run in the background in the current environment, keep it in the foreground until terminal status or the user asks to stop.
- If the watch runs unusually long, continue reporting state rather than silently stopping.

## Automatic Recovery Loop

When a deployment fails:

- Inspect the failure immediately.
- Prefer Vercel MCP tools when available for deployment status and build/runtime logs.
- Otherwise use the best available CLI inspection commands such as `vercel inspect` and deployment logs.

Classify the failure:

- build error
- runtime error
- missing or mismatched env var
- config or routing issue
- external or authorization blocker

If the cause is local and deterministic, fix it automatically.

Before the next recovery commit, re-run the narrowest relevant local verification:

- build issues -> build plus nearby typecheck or lint
- runtime issues -> most relevant app tests plus build when needed
- env or config issues -> relevant config validation plus build

Then:

- Stage only fix-related files.
- Create a follow-up Conventional Commit.
- Push it.
- Restart the 60-second deployment watch.

Continue diagnose -> fix -> verify -> commit -> push -> watch until deployment reaches `Ready`.

Stop after 3 follow-up recovery commits in one cap run, or earlier if the same failure signature repeats after a fix.

When the recovery cap is reached, report the latest deployment identifier or URL, repeated failure evidence, and files changed during recovery.

## Hard Blockers

Stop recovery for:

- missing secrets or credentials Codex cannot safely create
- authorization, billing, quota, or org-level Vercel restrictions
- external outages
- ambiguous product decisions
- destructive schema or data migrations
- repeated nondeterministic failures where root cause is not knowable from repo and logs

When blocked, report the exact blocker, latest deployment identifier or URL, and log evidence.

Do not fabricate env values, disable protections, or guess at risky production changes just to force a green deploy.
