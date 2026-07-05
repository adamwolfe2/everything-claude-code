#!/usr/bin/env bash
# setup-second-account.sh
# Provision a SECOND Claude Code account on this Mac that SHARES one harness +
# one context/memory brain with the primary account, but keeps auth + usage
# isolated so both Max plans can run simultaneously.
#
# Idempotent. Safe to re-run. Creates NO auth, runs NO login (that's interactive).
#
# Usage:  bash setup-second-account.sh [CONFIG_DIR] [LABEL]
#   CONFIG_DIR  default: ~/.claude-aims
#   LABEL       default: aims
set -euo pipefail

PRIMARY="${HOME}/.claude"
SECOND="${1:-$HOME/.claude-aims}"
LABEL="${2:-aims}"
REPO="${HOME}/everything-claude-code"

say()  { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }

echo "▶ Provisioning second Claude Code config: $SECOND  (label: $LABEL)"
[ -d "$PRIMARY" ] || { echo "✖ primary $PRIMARY missing — aborting"; exit 1; }
[ -d "$REPO" ]    || { echo "✖ harness repo $REPO missing — aborting"; exit 1; }
mkdir -p "$SECOND"

# ── Bucket A: harness — symlink the repo-backed dirs (single source of truth) ──
for d in agents commands skills rules workflows evals; do
  [ -e "$REPO/$d" ] && ln -sfn "$REPO/$d" "$SECOND/$d" && say "harness: $d → repo"
done

# ── Bucket B: shared brain — symlink the REAL context files (edits propagate) ──
for f in CLAUDE.md RTK.md; do
  [ -e "$PRIMARY/$f" ] && ln -sfn "$PRIMARY/$f" "$SECOND/$f" && say "context: $f (shared)"
done
for d in knowledge external-skills; do
  [ -e "$PRIMARY/$d" ] && ln -sfn "$PRIMARY/$d" "$SECOND/$d" && say "context: $d/ (shared)"
done
# memory lives under projects/-Users-adamwolfe/memory — share ONLY memory,
# keep per-account session transcripts separate.
mkdir -p "$SECOND/projects/-Users-adamwolfe"
MEM="$PRIMARY/projects/-Users-adamwolfe/memory"
[ -d "$MEM" ] && ln -sfn "$MEM" "$SECOND/projects/-Users-adamwolfe/memory" && say "memory/ (shared MEMORY.md + per-project files)"

# ── Hooks/settings — symlink so both accounts run identical hooks ──
[ -f "$PRIMARY/settings.json" ] && ln -sfn "$PRIMARY/settings.json" "$SECOND/settings.json" && say "settings.json (hooks, shared)"

# ── MCP: copy user-scope LOCAL servers into account #2 ──
# (project-scope MCP — tavily/stripe/clerk/supabase — travel with each repo's
#  own .mcp.json, so they are already shared when #2 opens the same repo.)
SRC="$HOME/.claude.json"; DST="$SECOND/.claude.json"
if [ -f "$SRC" ] && command -v jq >/dev/null; then
  base='{}'; [ -f "$DST" ] && base="$(cat "$DST")"
  echo "$base" | jq --argjson mcp "$(jq '.mcpServers // {}' "$SRC")" '.mcpServers = $mcp' \
    > "${DST}.tmp" && mv "${DST}.tmp" "$DST"
  names="$(jq -r '.mcpServers // {} | keys | join(", ")' "$DST")"
  [ -n "$names" ] && say "MCP (user-scope, shared): $names"
else
  warn "jq or ~/.claude.json missing — add local MCP manually: CLAUDE_CONFIG_DIR=$SECOND claude mcp add ..."
fi

# ── Account-LOCAL (deliberately NOT shared): auth, history, telemetry ──
# Claude creates these fresh on first run in $SECOND. We touch logs so hooks don't error.
: > "$SECOND/telemetry.jsonl" 2>/dev/null || true
warn "auth/history/telemetry stay LOCAL to $SECOND — created on first login (this is correct)"

cat <<EOF

▶ Filesystem wiring DONE. Interactive steps you must run (I can't do headless):

  1) Shell wrappers — append to ~/.zshrc, then: source ~/.zshrc
       # personal (default ~/.claude) — unchanged:
       #   just run:  claude
       claude-${LABEL}() { CLAUDE_CONFIG_DIR="$SECOND" claude "\$@"; }

  2) Log in account #2 + TEST SIMULTANEITY (the one real unknown):
       CLAUDE_CONFIG_DIR="$SECOND" claude      # → /login as adam@aimanagingservices.com
     Then, in a SECOND terminal at the same time:
       claude                                   # your personal account
     • Both work at once  → done, true parallel. ✅
     • Personal got signed out → macOS Keychain collision. Fix (guaranteed):
         security delete-generic-password -s "Claude Code-credentials" 2>/dev/null
         claude                       # /login personal  → writes ~/.claude/.credentials.json (file)
         CLAUDE_CONFIG_DIR="$SECOND" claude   # /login #2 → writes $SECOND/.credentials.json (file)
       (See TWO-ACCOUNT-HANDOFF.md → "Keychain decision tree".)

  3) Re-auth claude.ai connectors on account #2 (cannot be copied — OAuth per account):
       Vercel · Notion · Slack · Asana · Gmail · GDrive · GCal · Figma · Airtable · M365 · Close · HubSpot · Mercury · n8n
       → do it in claude.ai connector settings while signed in as account #2.

  4) Re-approve OAuth local MCP on account #2:  supabase · airops

  aside (your logins/passwords) + browser-harness already work on BOTH — no action.
EOF
echo "▶ Full checklist: ~/.claude/knowledge/TWO-ACCOUNT-HANDOFF.md"
