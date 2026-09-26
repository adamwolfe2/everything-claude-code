#!/usr/bin/env node
// Stop hook: code edited since the user's last message but no passing check after the last edit
// = "done that wasn't". Reads the main transcript + subagent transcripts (byte-offset cache).
// Log-only by default (~/.claude/state/vgate.jsonl). VGATE_MODE=block turns on blocking; VGATE_STATE moves state.
// Escape hatch: final line `[verify] skipped: <reason>`. Any internal error allows the stop.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const STATE = process.env.VGATE_STATE || path.join(os.homedir(), '.claude', 'state');
const MODE = process.env.VGATE_MODE === 'block' ? 'block' : 'log';
const MAX_BLOCKS = 2;

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const IGNORED = (p) => /\.(md|log)$/i.test(p) || /(^|\/)\.claude\//.test(p) || /^\/(tmp|dev|private\/tmp)\//.test(p);
const UI = (p) => /\.(tsx|jsx|css)$/.test(p) || /(^|\/)(app|components)\//.test(p) && !/\/api\//.test(p);
const CHECK = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?[\w:-]*(typecheck|lint|test|build|check)[\w:-]*|\b(tsc|vitest|jest|pytest|eslint|next build|playwright test|node --test)\b|\b(cargo|go)\s+(test|check|build|vet|clippy)\b|\bmake\s+(test|check|lint|build)\b|\bnode\s+\S*(tests?\/|\.test\.|run-all)\S*/;
const PIPED = /\|\s*(tail|head)\b/;
const FAIL_OUT = /\bFAIL\b|error TS\d+|\b[1-9]\d* (failed|failing)\b|Failed:\s*[1-9]/;
const UI_BASH = /\bcurl\b[^|;]*(localhost|127\.0\.0\.1)|browser-harness|agent-browser|playwright|screenshot/;
const UI_TOOL = /browser|chrome|screenshot|playwright|aside/i;

// Paths a Bash command writes: `> f`, `>> f`, `tee f`, `sed -i … f`, `perl -pi … f`.
// Heredoc bodies and quoted strings are blanked first so `=>`, `a > b` in code never count.
function bashWrites(raw) {
  const lines = raw.split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    kept.push(lines[i]);
    const tag = lines[i].match(/<<-?\s*['"]?(\w+)['"]?/);
    if (tag) while (i + 1 < lines.length && lines[i + 1].trim() !== tag[1]) i += 1;
  }
  const cmd = kept.join('\n').replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, 'Q');
  const out = [];
  for (const m of cmd.matchAll(/(?:^|[^0-9&>=\-])>{1,2}\s*([^\s&|;<>()]+)/g)) out.push(m[1]);
  for (const m of cmd.matchAll(/\btee\s+(?:-a\s+)?([^\s&|;<>]+)/g)) out.push(m[1]);
  for (const m of cmd.matchAll(/\b(?:sed\s+-i|perl\s+-p?i)\S*(?:\s+\S+)*?\s+([^\s&|;<>]+\.\w+)(?=\s*($|[;&|]))/g)) out.push(m[1]);
  return out.filter((p) => p !== 'Q' && !p.startsWith('/dev/') && !p.startsWith('$'));
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((b) => (typeof b === 'string' ? b : b.text || '')).join('\n');
  return '';
}

function isHuman(e) {
  if (e.type !== 'user' || e.isMeta || e.isCompactSummary || e.toolUseResult !== undefined) return false;
  const c = e.message && e.message.content;
  if (Array.isArray(c) && c.some((b) => b.type === 'tool_result')) return false;
  const text = textOf(c).trimStart();
  return text.length > 0 && !/^(<task-notification|<system-reminder>|Stop hook feedback|\[Request interrupted)/.test(text);
}

// Parse new complete lines of one transcript into events; `pending` maps tool_use id -> bash command.
function scan(file, st, isMain, isCheckCmd) {
  const size = fs.statSync(file).size;
  if (size < st.offset) Object.assign(st, { offset: 0, pending: {} });
  if (size === st.offset) return [];
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(size - st.offset);
  fs.readSync(fd, buf, 0, buf.length, st.offset);
  fs.closeSync(fd);
  const end = buf.lastIndexOf(10) + 1;
  st.offset += end;
  const events = [];
  for (const line of buf.subarray(0, end).toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; } // half-written or foreign line: skip, not fatal
    const t = Date.parse(e.timestamp) || 0;
    if (isMain && isHuman(e)) { events.push({ t, k: 'human' }); continue; }
    const content = e.message && Array.isArray(e.message.content) ? e.message.content : [];
    for (const b of content) {
      if (b.type === 'tool_use') {
        const input = b.input || {};
        if (EDIT_TOOLS.has(b.name)) {
          const p = input.file_path || input.notebook_path || '';
          if (p && !IGNORED(p)) events.push({ t, k: 'edit', p });
        } else if (b.name === 'Bash' && input.command) {
          for (const p of bashWrites(input.command)) if (!IGNORED(p)) events.push({ t, k: 'edit', p });
          if (isCheckCmd(input.command) || UI_BASH.test(input.command)) st.pending[b.id] = input.command;
        } else if (UI_TOOL.test(b.name)) events.push({ t, k: 'ui' });
      } else if (b.type === 'tool_result' && st.pending[b.tool_use_id]) {
        const cmd = st.pending[b.tool_use_id];
        delete st.pending[b.tool_use_id];
        const out = textOf(b.content);
        const ok = !b.is_error && !(PIPED.test(cmd) && FAIL_OUT.test(out));
        if (ok && UI_BASH.test(cmd)) events.push({ t, k: 'ui' });
        // ponytail: a check stamps at its result, so `test && echo > f` in ONE command reads as verified; split by position if that shows up in vgate.jsonl
        if (isCheckCmd(cmd)) events.push({ t, k: 'check', ok, cmd: cmd.slice(0, 120) });
      }
    }
  }
  return events;
}

function agentsChecks(cwd) {
  try {
    const md = fs.readFileSync(path.join(cwd, 'AGENTS.md'), 'utf8');
    const sec = md.split(/^#+\s*/m).find((s) => /^checks\b/i.test(s)) || '';
    return [...sec.matchAll(/`([^`\n]{3,})`/g)].map((m) => m[1]);
  } catch { return []; } // no AGENTS.md is normal
}

function decide(input) {
  const tp = input.transcript_path;
  if (!tp || !fs.existsSync(tp)) return { decision: 'allow', why: 'no transcript' };
  const session = input.session_id || path.basename(tp, '.jsonl');
  const stateFile = path.join(STATE, 'vgate', `${session}.json`);
  let s = { files: {}, since: 0, events: [], blocks: {} };
  try { s = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* first stop in this session */ }

  const extra = agentsChecks(input.cwd || '');
  const isCheckCmd = (cmd) => CHECK.test(cmd) || extra.some((c) => cmd.includes(c));
  const st = (f) => (s.files[f] = s.files[f] || { offset: 0, pending: {} });
  for (const ev of scan(tp, st(tp), true, isCheckCmd)) {
    if (ev.k === 'human') { s.since = Math.max(s.since, ev.t); s.events = []; } else s.events.push(ev);
  }
  const subDir = path.join(tp.replace(/\.jsonl$/, ''), 'subagents');
  if (fs.existsSync(subDir)) {
    for (const rel of fs.readdirSync(subDir, { recursive: true })) {
      const f = path.join(subDir, String(rel));
      if (!/agent-[^/]*\.jsonl$/.test(f) || fs.statSync(f).mtimeMs < s.since) continue;
      s.events.push(...scan(f, st(f), false, isCheckCmd));
    }
  }
  s.events = s.events.filter((e) => e.t >= s.since);

  const edits = s.events.filter((e) => e.k === 'edit');
  const passes = s.events.filter((e) => e.k === 'check' && e.ok);
  const lastEdit = Math.max(0, ...edits.map((e) => e.t));
  const uiEdits = edits.filter((e) => UI(e.p));
  const lastUi = Math.max(0, ...uiEdits.map((e) => e.t));

  const finalLine = String(input.last_assistant_message || '').trim().split('\n').pop().trim();
  const paths = [...new Set(edits.map((e) => e.p))].sort();
  const base = { edits: paths.length, ui: uiEdits.length > 0, paths: paths.slice(0, 8), final: finalLine.slice(0, 160) };
  const save = () => { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s)); };

  if (!edits.length) { save(); return { ...base, decision: 'allow', why: 'no edits' }; }
  if (/^\[verify\] skipped:\s*\S/.test(finalLine)) { save(); return { ...base, decision: 'allow', why: 'skipped' }; }
  if (input.stop_hook_active) { save(); return { ...base, decision: 'allow', why: 'stop_hook_active' }; }
  if (Array.isArray(input.background_tasks) && input.background_tasks.length) { save(); return { ...base, decision: 'allow', why: 'background tasks' }; }

  const checked = passes.some((e) => e.t >= lastEdit);
  const uiSeen = !uiEdits.length || s.events.some((e) => e.k === 'ui' && e.t >= lastUi);
  if (checked && uiSeen) { save(); return { ...base, decision: 'allow', why: 'verified' }; }

  const hash = crypto.createHash('sha1').update(paths.join('\n')).digest('hex').slice(0, 12);
  const n = s.blocks[hash] || 0;
  if (n >= MAX_BLOCKS) { save(); return { ...base, decision: 'allow', why: 'block cap' }; }
  if (MODE === 'block') s.blocks[hash] = n + 1;
  save();
  const missing = [!checked && 'no passing check ran after the last edit', !uiSeen && 'UI files changed but nothing looked at the rendered page'].filter(Boolean);
  const hint = extra.length ? ` AGENTS.md Checks: ${extra.slice(0, 3).join(' · ')}.` : '';
  const reason = `[verify] You changed ${paths.length} file(s) since the user's last message (${paths.slice(0, 4).map((p) => path.basename(p)).join(', ')}${paths.length > 4 ? ', …' : ''}) and ${missing.join('; ')}. Run the repo's checks (typecheck/lint/test/build) and quote the real output${uiSeen ? '' : ', and load the page (browser or curl localhost)'} before saying done.${hint} If a check truly cannot run, end with the line \`[verify] skipped: <reason>\`.`;
  return { ...base, decision: MODE === 'block' ? 'block' : 'would_block', why: missing.join('; '), reason };
}

function log(entry) {
  try {
    fs.mkdirSync(STATE, { recursive: true });
    fs.appendFileSync(path.join(STATE, 'vgate.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), mode: MODE, ...entry })}\n`);
  } catch { /* logging must never break a stop */ }
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => { raw += d; });
  process.stdin.on('end', () => {
    let input = {};
    try {
      input = JSON.parse(raw || '{}');
      const r = decide(input);
      const { reason, ...rest } = r;
      log({ session: input.session_id, cwd: input.cwd, ...rest });
      if (r.decision === 'block') process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    } catch (error) {
      log({ session: input.session_id, decision: 'allow', why: `error: ${error.message}` });
    }
    process.exit(0);
  });
}

module.exports = { decide, bashWrites, CHECK };
