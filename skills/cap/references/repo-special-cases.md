# Repo Special Cases

Load this reference only when a matching repo is detected or repo memory points to a known cap pattern.

## Repo-Local Cap Hooks

If the repo documents cap hooks in `AGENTS.md`, `CONTRIBUTING.md`, `HANDOFF.md`, `scripts/`, or a project runbook, read the relevant hook instructions before staging.

- Run only hooks that are safe, repo-local, and directly relevant to verification, release, deploy, or continuity.
- Do not print private runbook sections or credential-bearing content. Use narrow reads and redact secrets.
- Do not invent global hooks for one repo's workflow.
- If a repo needs a hosted deploy after push, use the established deploy script or runbook first. If no exact script or runbook is available, report the deploy as pending instead of improvising.

## Known Repo Memory

Use project memory and recent lessons to choose repo-specific verification, but verify drift-prone facts when cheap.

Examples of reusable patterns from prior cap runs:

- Some Vercel CLI installs reject `vercel ls --limit`; use plain `vercel ls` or `vercel inspect`.
- Avoid reading `.vercel/.env*` or `.env*`; inspect `.vercel/project.json`, env-name listings, or redacted key-presence scripts.
- For repos with Supabase migrations, check linked/local migration state and run non-destructive migrations when they are part of the intended slice.
- For KanAgent/Ralph, avoid broad test commands that spawn excessive Playwright/Electron instances unless release proof truly requires them.
- For Next.js builds in env-less worktrees, safe placeholder public env values may be required when the app trims public Supabase values at import time.
