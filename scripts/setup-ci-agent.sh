#!/usr/bin/env bash
# Fan the Claude CI/CD agent out to a repo. Usage: setup-ci-agent.sh <repo-path> [org/repo]
# Copies the template workflow + reminds about the one required secret.
set -euo pipefail
REPO_PATH="${1:?usage: setup-ci-agent.sh <repo-path> [org/repo]}"
TEMPLATE="$HOME/everything-claude-code/templates/github/claude-agent.yml"
DEST="$REPO_PATH/.github/workflows/claude-agent.yml"

[ -f "$TEMPLATE" ] || { echo "template missing: $TEMPLATE"; exit 1; }
mkdir -p "$(dirname "$DEST")"
cp "$TEMPLATE" "$DEST"
echo "✓ copied workflow -> $DEST"

# derive org/repo from arg or git remote
SLUG="${2:-}"
if [ -z "$SLUG" ]; then
  SLUG=$(git -C "$REPO_PATH" remote get-url origin 2>/dev/null | sed -E 's#.*github.com[:/]##; s#\.git$##' || true)
fi

if [ -n "$SLUG" ]; then
  if gh secret list --repo "$SLUG" 2>/dev/null | grep -qi anthropic; then
    echo "✓ ANTHROPIC_API_KEY already set on $SLUG"
  else
    echo "⚠ set the secret:  gh secret set ANTHROPIC_API_KEY --repo $SLUG"
  fi
  echo "Next: branch, commit .github/workflows/claude-agent.yml, open a PR (it will review itself)."
else
  echo "⚠ couldn't derive org/repo — set ANTHROPIC_API_KEY secret manually."
fi
