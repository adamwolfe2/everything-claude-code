#!/usr/bin/env node
// UserPromptSubmit hook: curb credit burn from marathon sessions.
// Adam's #1 drain (audit 2026-06-11): avg 849K output tok/session, sessions of
// 1000+ tool calls that rebuild a giant context every turn (256M cache_create / 40 sessions).
// Thresholds are ABSOLUTE context tokens (model-agnostic) because the cost is the
// cache rebuild per turn, not the context-window ceiling.
const fs = require('fs');

// Calibrated to the 1M-context model + audit 2026-06-11 (median peak 570K, 43% of
// turns ran >500K context, each re-billing the whole window as cache_read).
const SOFT = 300000; // nudge: compact / wrap up at clean boundary
const HARD = 600000; // stop: start a fresh session now

let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  let i = {};
  try { i = JSON.parse(d); } catch { process.exit(0); }
  const tp = i.transcript_path;
  if (!tp || !fs.existsSync(tp)) process.exit(0);

  let ctx = 0;
  try {
    const lines = fs.readFileSync(tp, 'utf8').trim().split('\n');
    for (let k = lines.length - 1; k >= 0; k--) {
      let o; try { o = JSON.parse(lines[k]); } catch { continue; }
      const u = o.message && o.message.usage;
      if (u) {
        ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        break;
      }
    }
  } catch { process.exit(0); }

  const k = Math.round(ctx / 1000);
  let msg = '';
  if (ctx >= HARD) {
    msg = `[CONTEXT BUDGET] Session ~${k}K context tokens. STOP and tell Adam NOW, in one line: start a FRESH session. Long sessions are his #1 credit drain — every turn here rebuilds this whole context. Offer to write a 3-line handoff to .claude/specs/ before he opens the new chat.`;
  } else if (ctx >= SOFT) {
    msg = `[CONTEXT BUDGET] Session ~${k}K context tokens. Remind Adam once to wrap up soon or /compact at the next clean boundary to cut credit burn.`;
  }
  if (msg) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
    }));
  }
  process.exit(0);
});
