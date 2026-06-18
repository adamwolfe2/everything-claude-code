#!/usr/bin/env bash
# Standing background watcher (the "background agents" tier). Polls GitHub PRs + CI
# across Adam's repos and appends alerts to ~/.claude/bg-alerts.md. Read-only; no actions.
# Run detached:  ~/everything-claude-code/scripts/bg-watch.sh &
# or via run_in_background from a session, or on a launchd interval.
export PATH="/Users/adamwolfe/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ALERTS=~/.claude/bg-alerts.md
INTERVAL="${BG_WATCH_INTERVAL:-900}"   # seconds between polls (default 15 min)
ONCE="${BG_WATCH_ONCE:-}"              # set to 1 to poll once and exit

# Repos to watch (adamwolfe2 unless noted). Trim/extend freely.
REPOS=(
  adamwolfe2/trackr
  adamwolfe2/cursive
  adamwolfe2/taskspace
  adamwolfe2/tbgc
  adamwolfe2/amcollective
  adamwolfe2/campaign-os
)

poll() {
  local ts; ts=$(date '+%Y-%m-%d %H:%M')
  local found=0
  {
    for r in "${REPOS[@]}"; do
      # open PRs (with CI conclusion if available)
      local prs
      prs=$(gh pr list --repo "$r" --state open --json number,title,isDraft,statusCheckRollup \
            --jq '.[] | select(.isDraft==false) | "  PR #\(.number) \(.title) — checks: \([.statusCheckRollup[]?.conclusion] | join(","))"' 2>/dev/null || true)
      if [ -n "$prs" ]; then
        echo "## [$ts] $r"; echo "$prs"; found=1
      fi
      # latest failed CI run
      local fail
      fail=$(gh run list --repo "$r" --status failure --limit 1 \
             --json displayTitle,headBranch --jq '.[] | "  ✗ CI FAILED: \(.displayTitle) on \(.headBranch)"' 2>/dev/null || true)
      [ -n "$fail" ] && { echo "## [$ts] $r"; echo "$fail"; found=1; }
    done
  } >> "$ALERTS"
  [ "$found" = 1 ] && echo "[$ts] bg-watch: new alerts -> $ALERTS" || echo "[$ts] bg-watch: clean"
}

touch "$ALERTS"
if [ -n "$ONCE" ]; then poll; exit 0; fi
while true; do poll; sleep "$INTERVAL"; done
