#!/usr/bin/env bash
# export-public.sh — generate a SHAREABLE, sanitized starter kit from this setup.
# Copies only teachable artifacts (skills/commands/hooks/workflows/agents/rules/evals/
# routing), strips personal data, EXCLUDES all private files, then leak-scans the output.
# Usage: export-public.sh [dest]   (default ~/claude-starter-kit)
set -euo pipefail
SRC="$HOME/everything-claude-code"
DEST="${1:-$HOME/claude-starter-kit}"
KIT="$SRC/public-kit"

echo "→ building starter kit at $DEST"
rm -rf "$DEST"; mkdir -p "$DEST"

# ---- 1. ALLOWLIST: copy only teachable dirs (never MEMORY/decisions/telemetry) ----
for d in skills commands agents rules workflows evals templates; do
  [ -d "$SRC/$d" ] && cp -R "$SRC/$d" "$DEST/$d"
done
mkdir -p "$DEST/scripts/hooks"
# generic hooks only — the teachable ones
for h in context-budget read-discipline intent-router suggest mistake-log-nudge taste-lint scope-check session-start session-end suggest-compact pre-compact; do
  [ -f "$SRC/scripts/hooks/$h.js" ] && cp "$SRC/scripts/hooks/$h.js" "$DEST/scripts/hooks/" 2>/dev/null || true
done
cp "$SRC/scripts/coverage-guard.js" "$DEST/scripts/" 2>/dev/null || true
cp "$SRC/routing.json" "$DEST/routing.json" 2>/dev/null || true
[ -d "$SRC/mcp-servers" ] && cp -R "$SRC/mcp-servers" "$DEST/mcp-servers"

# ---- 2. KIT TEMPLATES: README + sanitized .example configs ----
cp "$KIT/README.md" "$DEST/README.md"
cp "$KIT/CLAUDE.md.example" "$DEST/CLAUDE.md.example"
cp "$KIT/projects.json.example" "$DEST/projects.json.example"
cp "$KIT/settings.json.example" "$DEST/settings.json.example"
cp "$KIT/gitignore" "$DEST/.gitignore"

# ---- 3. EXCLUDE: nuke anything private that slipped in via a copied dir ----
# personalized commands whose EXAMPLES embed the real project roster — not teachable generically
rm -f "$DEST/commands/dashboard.md" "$DEST/commands/morning-briefing.md" 2>/dev/null || true
find "$DEST" -name 'MEMORY.md' -delete 2>/dev/null || true
find "$DEST" -path '*knowledge*' -delete 2>/dev/null || true
rm -f "$DEST/evals/harness-evals.jsonl" 2>/dev/null || true   # ships as .example instead
cp "$KIT/harness-evals.jsonl.example" "$DEST/evals/harness-evals.jsonl.example" 2>/dev/null || true

# ---- 4. SANITIZE: strip personal data from every text file ----
# absolute home path -> ~, personal emails -> placeholder, gh org -> placeholder, long IDs -> redacted
find "$DEST" -type f -not -path '*impeccable/references*' \( -name '*.md' -o -name '*.js' -o -name '*.mjs' -o -name '*.json' -o -name '*.sh' -o -name '*.yml' -o -name '*.yaml' -o -name '*.example' \) -print0 \
| while IFS= read -r -d '' f; do
  sed -i '' \
    -e "s#/Users/adamwolfe#~#g" \
    -e "s#-Users-adamwolfe#-Users-USER#g" \
    -e "s#projects/-Users-USER/memory#memory#g" \
    -e "s#Adam Wolfe's#{{YOUR_NAME}}'s#g" \
    -e "s#Adam Wolfe#{{YOUR_NAME}}#g" \
    -e "s#Adam's#your#g" \
    -e "s#[[:<:]]Adam[[:>:]]#you#g" \
    -e "s#[[:<:]]Wolfe[[:>:]]#you#g" \
    -e "s#[[:<:]]Rocky'\\{0,1\\}s\\{0,1\\}[[:>:]]#<stakeholder>#g" \
    -e "s#known projects ([^)]*)#known projects (see projects.json)#g" \
    -e "s#observed in trackr, taskspace, aims#observed across multiple repos#g" \
    -e "s#[[:<:]][Tt]rackr[[:>:]]#repo-a#g" \
    -e "s#[[:<:]][Tt]askspace[[:>:]]#repo-b#g" \
    -e "s#[[:<:]][Ll]easestack[[:>:]]#repo-c#g" \
    -e "s#[[:<:]][Cc]reditos[[:>:]]#repo-d#g" \
    -e "s#[[:<:]][Cc]ampusgtm[[:>:]]#repo-e#g" \
    -e "s#[[:<:]][Cc]ursive[[:>:]]#repo-f#g" \
    -e "s#[[:<:]][Ww]holesail[[:>:]]#repo-g#g" \
    -e "s#[[:<:]][Vv]end[Cc][Ff][Oo][[:>:]]#repo-h#g" \
    -e "s#[[:<:]][Vv]endhub[[:>:]]#repo-i#g" \
    -e "s#adamwolfe10[0-9]@gmail.com#you@example.com#g" \
    -e "s#adamwolfe2/#YOUR_GH_ORG/#g" \
    -e "s#ModernAmenities-Org/#YOUR_GH_ORG/#g" \
    -e "s#AIMS-Product/#YOUR_GH_ORG/#g" \
    -e "s#prj_[A-Za-z0-9]\{20,\}#prj_REDACTED#g" \
    -e "s#ins_[A-Za-z0-9]\{20,\}#ins_REDACTED#g" \
    -e "s#user_[A-Za-z0-9]\{20,\}#user_REDACTED#g" \
    -e "s#team_[A-Za-z0-9]\{20,\}#team_REDACTED#g" \
    "$f" 2>/dev/null || true
done

# ---- 5. LEAK SCAN: fail loudly if anything personal survived ----
echo "→ leak-scanning output…"
LEAKS=$(grep -rliE "adamwolfe|[[:<:]]adam[[:>:]]|[[:<:]]wolfe[[:>:]]|[[:<:]]rocky[[:>:]]|truffleboys|meetcursive|gensinger|melodi|vendhubhq|getmyvsl|aimseos|trytrackr|trytaskspace|leasestack|prj_[A-Za-z0-9]{20}|ins_[A-Za-z0-9]{20}|sk-[A-Za-z0-9]{20}|sk_live|whsec_" "$DEST" 2>/dev/null | grep -viE "app/api/users|/users/user_|impeccable/references" || true)
if [ -n "$LEAKS" ]; then
  echo "⚠ POTENTIAL LEAKS — review before sharing:"; echo "$LEAKS"
else
  echo "✓ clean — no personal identifiers found"
fi

echo "→ kit contents:"; find "$DEST" -maxdepth 1 -mindepth 1 | sed 's#.*/#  #' | sort
echo "✓ done. Review $DEST, then: cd $DEST && git init && gh repo create claude-starter-kit --public --source=. --push"
