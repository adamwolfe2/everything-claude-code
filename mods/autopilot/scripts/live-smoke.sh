#!/usr/bin/env bash
# Live smoke test for the autopilot mod: real headless `claude -p` sessions, no fakes.
# Unit tests passed while two live bugs shipped (2026-10-14); run this before pushing mods/autopilot.
#   1. UI edit + passing check with a dev server on :3000 -> exactly one auto-screenshot.
#   2. /audit with no client -> asks for one, writes no CRM file.
# Costs two short Sonnet sessions. Needs port 3000 free.
set -uo pipefail

FIXTURE="$HOME/.cache/autopilot-smoke"
SHOTS="$HOME/.claude/screenshots"
AUDITS="$HOME/.claude/audits"
fail=0
check() { if eval "$2"; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi; }

if lsof -iTCP:3000 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "port 3000 is busy; stop that server first" >&2
  exit 2
fi

# A tiny static app with playwright installed once (the hook runs `npx --no-install playwright`).
if [ ! -x "$FIXTURE/node_modules/.bin/playwright" ]; then
  mkdir -p "$FIXTURE"
  printf '{ "name": "autopilot-smoke", "private": true, "scripts": { "test": "true" } }\n' > "$FIXTURE/package.json"
  (cd "$FIXTURE" && npm install --no-save --silent playwright@1.63.0) || { echo "playwright install failed" >&2; exit 2; }
fi
printf '<!doctype html><html><body><h1>Smoke page</h1></body></html>\n' > "$FIXTURE/index.html"
git -C "$FIXTURE" rev-parse --git-dir >/dev/null 2>&1 || git -C "$FIXTURE" init -q

python3 -m http.server 3000 --directory "$FIXTURE" >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
for _ in $(seq 1 20); do curl -sf -o /dev/null http://localhost:3000 && break; sleep 0.5; done

echo "1. auto-screenshot"
mkdir -p "$SHOTS"
before=$(ls "$SHOTS" | wc -l)
out=$(cd "$FIXTURE" && claude -p --model sonnet --allowedTools "Edit" "Read" "Bash(npm test)" -- \
  "Use the Edit tool to change 'Smoke page' to 'Smoke page edited' in index.html. Then run exactly: npm test. Then quote verbatim any line starting with [screenshot] that you received, or say NONE." 2>&1)
after=$(ls "$SHOTS" | wc -l)
check "the session saw a [screenshot] note" '[[ "$out" == *"[screenshot]"* ]]'
check "exactly one new screenshot file ($((after - before)))" '[ $((after - before)) -eq 1 ]'

echo "2. /audit without a client"
audits_before=$(ls "$AUDITS" 2>/dev/null | wc -l)
# A plain `claude -p "/audit"` ends before the command's 300ms submit timer fires, so hold
# the session open with streamed input, as an interactive session stays open.
out=$(cd "$FIXTURE" && { echo '{"type":"user","message":{"role":"user","content":"/audit"}}'; sleep 40; } |
  claude -p --model sonnet --input-format stream-json --output-format stream-json --verbose 2>/dev/null |
  python3 -c 'import sys, json
for line in sys.stdin:
    try: m = json.loads(line)
    except ValueError: continue
    if m.get("type") == "result": print(m.get("result") or "")')
audits_after=$(ls "$AUDITS" 2>/dev/null | wc -l)
check "it asks for the client or call notes" '[[ "$out" =~ [Cc]lient|notes ]]'
check "no CRM file was written" '[ "$audits_before" -eq "$audits_after" ]'

[ $fail -eq 0 ] && echo "live smoke: PASS" || echo "live smoke: FAIL"
exit $fail
