#!/usr/bin/env node
// PreToolUse(Read) hook: stop wasteful full-file reads of huge files.
// Audit 2026-06-11: 621 full-file reads + 9 single reads >40K chars were the #1
// context filler (~1.7M tokens). Only blocks the egregious cases (>1000 lines or
// >40K chars) read with NO offset/limit — normal reads pass untouched.
const fs = require('fs');

const MAX_LINES = 1000;   // hard deny (egregious)
const MAX_CHARS = 40000;
const WARN_LINES = 600;   // non-blocking nudge (evolve 2026-06-18): the audit's real
const WARN_CHARS = 24000; // concern was full reads of >400-line files; deny bar was 2.5x too high

let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  let i = {};
  try { i = JSON.parse(d); } catch { process.stdout.write(d); process.exit(0); }
  const t = i.tool_input || {};
  const p = t.file_path;
  // already scoped, or no path → allow
  if (!p || t.offset != null || t.limit != null) { process.stdout.write(d); process.exit(0); }
  let lines = 0, chars = 0;
  try {
    const stat = fs.statSync(p);
    chars = stat.size;
    // below the WARN floor → allow without counting lines
    if (chars <= WARN_CHARS) { process.stdout.write(d); process.exit(0); }
    const buf = fs.readFileSync(p, 'utf8');
    lines = buf.split('\n').length;
  } catch { process.stdout.write(d); process.exit(0); }

  // WARN tier: non-blocking nudge for medium files that slip under the deny bar
  if ((lines > WARN_LINES || chars > WARN_CHARS) && !(lines > MAX_LINES || chars > MAX_CHARS)) {
    console.error(`[READ DISCIPLINE] ${p} is ${lines} lines / ~${Math.round(chars/1000)}K chars. Grep for the symbol you need, then Read a range with offset/limit. (nudge)`);
    process.stdout.write(d);
    process.exit(0);
  }

  if (lines > MAX_LINES || chars > MAX_CHARS) {
    const out = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `[READ DISCIPLINE] ${p} is ${lines} lines / ~${Math.round(chars/1000)}K chars (~${Math.round(chars/4000)}K tokens). Reading it whole bloats context every turn after. Grep for what you need, then Read a range with offset/limit. If you truly need the whole file, read it in chunks. (Per Adam's token-economy rules.)`,
      },
    };
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
  }
  process.stdout.write(d);
  process.exit(0);
});
