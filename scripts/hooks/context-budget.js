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
// Cumulative gates (evolve 2026-06-18): marathon LENGTH, not window size, is the burn
// driver. Worst sessions (863t/188M, 594t/113M cache_read) never trip the size gate.
const SOFT_TURNS = 800;
const HARD_TURNS = 1500;
const SOFT_CR = 300000000; // cumulative session cache_read tokens
const HARD_CR = 600000000;

let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  let i = {};
  try { i = JSON.parse(d); } catch { process.exit(0); }
  const tp = i.transcript_path;
  if (!tp || !fs.existsSync(tp)) process.exit(0);

  let ctx = 0, turns = 0, crSum = 0, gotCtx = false;
  try {
    const lines = fs.readFileSync(tp, 'utf8').trim().split('\n');
    // single full pass: latest ctx (from the end) + cumulative turns & cache_read
    for (let k = lines.length - 1; k >= 0; k--) {
      let o; try { o = JSON.parse(lines[k]); } catch { continue; }
      const u = o.message && o.message.usage;
      if (u) {
        if (!gotCtx) {
          ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
          gotCtx = true;
        }
        crSum += u.cache_read_input_tokens || 0;
      }
      if (o.type === 'assistant' || (o.message && o.message.role === 'assistant')) turns++;
    }
  } catch { process.exit(0); }

  const k = Math.round(ctx / 1000);
  const crM = Math.round(crSum / 1000000);
  const hard = ctx >= HARD || turns >= HARD_TURNS || crSum >= HARD_CR;
  const soft = ctx >= SOFT || turns >= SOFT_TURNS || crSum >= SOFT_CR;
  let msg = '';
  if (hard) {
    msg = `[CONTEXT BUDGET] Session ~${k}K ctx · ${turns} turns · ~${crM}M cumulative cache_read. STOP and tell Adam NOW, in one line: start a FRESH session. Marathon LENGTH (turns/cache_read), not just window size, is his #1 credit drain — every turn rebuilds the whole context. Offer a 3-line handoff to .claude/specs/ before the new chat.`;
  } else if (soft) {
    msg = `[CONTEXT BUDGET] Session ~${k}K ctx · ${turns} turns · ~${crM}M cumulative cache_read. Remind Adam once to wrap up soon or /compact at the next clean boundary to cut credit burn.`;
  }
  if (msg) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg },
    }));
  }
  process.exit(0);
});
