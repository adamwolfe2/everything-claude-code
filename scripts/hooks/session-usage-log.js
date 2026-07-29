#!/usr/bin/env node
// SessionEnd hook: log real per-session usage to telemetry.jsonl so the
// self-improvement loop (/digest, /evolve-skills) has fuel. Before this, telemetry
// only held taste.findings — zero data on token/credit burn (audit 2026-06-11).
const fs = require('fs');
const os = require('os');
const path = require('path');

let d = '';
process.stdin.on('data', c => (d += c));
process.stdin.on('end', () => {
  let i = {};
  try { i = JSON.parse(d); } catch { process.exit(0); }
  const tp = i.transcript_path;
  if (!tp || !fs.existsSync(tp)) process.exit(0);

  let inp = 0, out = 0, cr = 0, cc = 0, turns = 0;
  // peak_context (2026-06-27 digest ask, applied 2026-07-29): largest single-turn
  // context = input + cache_read + cache_creation — the SAME quantity the
  // context-budget hook gates on (SOFT 300K / HARD 600K). Logging it lets /digest
  // measure the size gate directly instead of proxying it via cumulative cache_read.
  let peak = 0;
  const tools = {};
  try {
    const lines = fs.readFileSync(tp, 'utf8').trim().split('\n');
    for (const ln of lines) {
      let o; try { o = JSON.parse(ln); } catch { continue; }
      const m = o.message;
      if (!m) continue;
      const u = m.usage;
      if (u) {
        inp += u.input_tokens || 0;
        out += u.output_tokens || 0;
        cr += u.cache_read_input_tokens || 0;
        cc += u.cache_creation_input_tokens || 0;
        const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        if (ctx > peak) peak = ctx;
        turns++;
      }
      if (Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b && b.type === 'tool_use') tools[b.name] = (tools[b.name] || 0) + 1;
        }
      }
    }
  } catch { process.exit(0); }

  const rec = {
    ts: new Date().toISOString(),
    type: 'session.usage',
    project: path.basename(i.cwd || ''),
    session: String(i.session_id || '').slice(0, 8),
    turns,
    out_tokens: out,
    cache_create: cc,
    cache_read: cr,
    peak_context: peak,
    raw_in: inp,
    tool_calls: Object.values(tools).reduce((a, b) => a + b, 0),
    top_tools: Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
  try { fs.appendFileSync(path.join(os.homedir(), '.claude', 'telemetry.jsonl'), JSON.stringify(rec) + '\n'); } catch {}
  process.exit(0);
});
