---
name: env-sync
description: Sync local env var changes to Vercel and verify parity. Use IMMEDIATELY after any .env.local change, when adding an integration that needs a new key, or when prod behaves differently from local (missing/stale env is the usual cause). Encodes Adam's standing rule — "ALWAYS push env updates to Vercel, never skip".
---

# env-sync

## Steps

1. Diff what changed: compare `.env.local` keys against `vercel env ls <environment>` output (names only — never print values).
2. For each new/changed key: `vercel env add <KEY> <environment>` (paste value when prompted, or pipe: `printf '%s' "$VAL" | vercel env add KEY production`). Use `printf`, not `echo` — trailing newlines have corrupted OAuth redirect_uris before (am-collective-os Google OAuth).
3. Cover ALL relevant environments: production + preview (+ development if the project uses `vercel env pull`).
4. Removed keys: `vercel env rm <KEY> <environment>` — stale keys cause ghost behavior.
5. Redeploy if the change affects runtime now: `vercel redeploy <url>` or push an empty-ish commit per repo convention (mind campaign-os: commit author must be adamwolfe102@gmail.com or Vercel blocks the deploy).
6. Verify: `vercel env ls` shows the key in every target env; hit the affected route/health endpoint once.
7. Never commit `.env*`. Never print secret values to the transcript — key NAMES only.

## Example

Added `EMAILBISON_API_KEY` + changed `NEXTAUTH_URL` locally → `vercel env ls production` shows neither current → add both to production + preview via printf pipe → redeploy → `curl -s https://<app>/api/health` 200 → report: "2 keys synced to prod+preview, redeployed, health OK."
