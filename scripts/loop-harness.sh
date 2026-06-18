#!/usr/bin/env bash
# Agent-loop harness (the "agent loops" tier). Bounded loop-until-dry: drains the
# research-queue by running a headless propose-only pass per item, stopping when the
# queue has no open items or MAX iterations hit. HARNESS-ONLY, propose-only, semi-autonomous.
# Usage: loop-harness.sh [MAX_ITERS]   (default 3)
export PATH="/Users/adamwolfe/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ECC=/Users/adamwolfe/everything-claude-code
QUEUE=~/.claude/research-queue.md
OUT=~/.claude/overnight
LOG=~/.claude/logs/loop-$(date +%Y%m%d).log
MAX="${1:-3}"
mkdir -p "$OUT" ~/.claude/logs
cd "$ECC" || exit 1

open_items() { grep -c '^- \[ \]' "$QUEUE" 2>/dev/null || echo 0; }

i=0
while [ "$i" -lt "$MAX" ]; do
  remaining=$(open_items)
  echo "[$(date)] loop iter $((i+1))/$MAX — $remaining open queue items" >> "$LOG"
  [ "$remaining" -eq 0 ] && { echo "[$(date)] queue dry — stop" >> "$LOG"; break; }

  claude -p "Agent-loop harness, iteration $((i+1)). HARNESS-ONLY, PROPOSE-ONLY — do not apply/merge.
Pick the SINGLE highest-leverage UNCHECKED item from $QUEUE (lines starting '- [ ]'). Produce a concrete,
eval-gated implementation proposal for it: exact target file(s), the change, and which eval id it moves
(or a NEW eval to add — do not edit the eval file). Append the proposal to $OUT/loop-$(date +%Y-%m-%d).md
under a numbered heading. If the item is product-repo scope (not ~/.claude), SKIP it and note why.
Do NOT check the box — Adam does that after applying. Terse, facts only." >> "$LOG" 2>&1

  i=$((i+1))
done
echo "[$(date)] loop-harness done ($i iters) -> $OUT/loop-$(date +%Y-%m-%d).md" >> "$LOG"
