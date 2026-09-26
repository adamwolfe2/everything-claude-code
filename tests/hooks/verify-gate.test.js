// verify-gate.js contract: synthetic transcripts, HOME pointed at a temp dir (no real state touched).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'verify-gate.js');
let passed = 0;
let failed = 0;
const t = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`); }
};

let clock = Date.parse('2026-09-26T12:00:00Z');
const ts = () => new Date((clock += 1000)).toISOString();
const human = (text) => ({ type: 'user', timestamp: ts(), message: { role: 'user', content: text } });
let ids = 0;
function tool(name, input, { error = false, out = 'ok' } = {}) {
  const id = `toolu_${(ids += 1)}`;
  return [
    { type: 'assistant', timestamp: ts(), message: { content: [{ type: 'tool_use', id, name, input }] } },
    { type: 'user', timestamp: ts(), toolUseResult: {}, message: { content: [{ type: 'tool_result', tool_use_id: id, content: out, is_error: error }] } },
  ];
}
const edit = (p) => tool('Edit', { file_path: p, old_string: 'a', new_string: 'b' });
const bash = (command, opts) => tool('Bash', { command }, opts);

function session(main, subagent) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vgate-home-'));
  const dir = path.join(home, 'proj');
  fs.mkdirSync(dir, { recursive: true });
  const tp = path.join(dir, 'sess.jsonl');
  const write = (f, entries) => fs.appendFileSync(f, entries.flat().map((e) => `${JSON.stringify(e)}\n`).join(''));
  write(tp, main);
  const sub = path.join(dir, 'sess', 'subagents', 'agent-abc.jsonl');
  if (subagent) { fs.mkdirSync(path.dirname(sub), { recursive: true }); write(sub, subagent); }
  return { home, tp, append: (entries) => write(tp, entries), appendSub: (entries) => write(sub, entries) };
}
function stop(s, extra = {}, env = {}) {
  const input = { session_id: 'sess', transcript_path: s.tp, cwd: s.home, stop_hook_active: false, last_assistant_message: 'Done.', ...extra };
  const r = spawnSync('node', [SCRIPT], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, HOME: s.home, ...env } });
  assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
  const log = fs.readFileSync(path.join(s.home, '.claude', 'state', 'vgate.jsonl'), 'utf8').trim().split('\n');
  return { out: r.stdout.trim(), last: JSON.parse(log[log.length - 1]) };
}
const BLOCK = { VGATE_MODE: 'block' };

console.log('verify-gate.js:');
t('edit with no check: would_block in log mode, silent stdout', () => {
  const r = stop(session([human('fix it'), edit('/r/src/a.js')]));
  assert.strictEqual(r.last.decision, 'would_block');
  assert.strictEqual(r.out, '');
});
t('edit with no check: block mode emits decision JSON with the escape hint', () => {
  const r = stop(session([human('fix it'), edit('/r/src/a.js')]), {}, BLOCK);
  const j = JSON.parse(r.out);
  assert.strictEqual(j.decision, 'block');
  assert.ok(j.reason.includes('[verify] skipped:'), j.reason);
});
t('edit then passing check: allow', () => {
  const r = stop(session([human('fix it'), edit('/r/src/a.js'), bash('pnpm test')]), {}, BLOCK);
  assert.strictEqual(r.last.why, 'verified');
  assert.strictEqual(r.out, '');
});
t('check before the last edit does not count', () => {
  const r = stop(session([human('x'), bash('pnpm test'), edit('/r/src/a.js')]));
  assert.strictEqual(r.last.decision, 'would_block');
});
t('failing check (non-zero exit) does not count', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js'), bash('pnpm test', { error: true })]));
  assert.strictEqual(r.last.decision, 'would_block');
});
t('check piped to tail with FAIL in output does not count', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js'), bash('pnpm test 2>&1 | tail -5', { out: 'FAIL src/a.test.js\nTests: 1 failed' })]));
  assert.strictEqual(r.last.decision, 'would_block');
});
t('AGENTS.md Checks command counts as a check', () => {
  const s = session([human('x'), edit('/r/src/a.py'), bash('./scripts/verify.sh --all')]);
  fs.writeFileSync(path.join(s.home, 'AGENTS.md'), '# Repo\n\n## Checks\n- `./scripts/verify.sh`\n');
  assert.strictEqual(stop(s).last.why, 'verified');
});
t('subagent edit with no check: would_block', () => {
  const r = stop(session([human('x'), tool('Agent', { prompt: 'do it' })], [human('sub prompt'), edit('/r/lib/b.ts')]));
  assert.strictEqual(r.last.decision, 'would_block');
});
t('subagent edit + subagent check: allow', () => {
  const r = stop(session([human('x'), tool('Agent', { prompt: 'do it' })], [edit('/r/lib/b.ts'), bash('npm run typecheck')]));
  assert.strictEqual(r.last.why, 'verified');
});
t('stop_hook_active: allow', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js')]), { stop_hook_active: true }, BLOCK);
  assert.strictEqual(r.last.why, 'stop_hook_active');
  assert.strictEqual(r.out, '');
});
t('"[verify] skipped: <reason>" final line: allow', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js')]), { last_assistant_message: 'Changed it.\n[verify] skipped: no test runner in this repo' }, BLOCK);
  assert.strictEqual(r.last.why, 'skipped');
});
t('"[verify] skipped:" with no reason does not escape', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js')]), { last_assistant_message: '[verify] skipped:' });
  assert.strictEqual(r.last.decision, 'would_block');
});
t('markdown and .claude/ edits are ignored', () => {
  const r = stop(session([human('x'), edit('/r/README.md'), edit('/r/.claude/specs/s.json')]));
  assert.strictEqual(r.last.why, 'no edits');
});
t('edits before the latest human message are out of scope', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js'), human('thanks, now explain it')]));
  assert.strictEqual(r.last.why, 'no edits');
});
t('bash write counts as an edit; node -e arrow does not', () => {
  assert.strictEqual(stop(session([human('x'), bash('echo 1 > src/v.js')])).last.decision, 'would_block');
  assert.strictEqual(stop(session([human('x'), bash('node -e "[1].map(a => a > 0)"')])).last.why, 'no edits');
});
t('UI edit needs rendered-page evidence too', () => {
  assert.strictEqual(stop(session([human('x'), edit('/r/components/Hero.tsx'), bash('pnpm build')])).last.decision, 'would_block');
  const ok = stop(session([human('x'), edit('/r/components/Hero.tsx'), bash('pnpm build'), bash('curl -s localhost:3000 | head')]));
  assert.strictEqual(ok.last.why, 'verified');
});
t('background tasks running: allow', () => {
  const r = stop(session([human('x'), edit('/r/src/a.js')]), { background_tasks: [{ id: 'b1' }] }, BLOCK);
  assert.strictEqual(r.last.why, 'background tasks');
});
t('max 2 blocks per edit set, then allow', () => {
  const s = session([human('x'), edit('/r/src/a.js')]);
  assert.strictEqual(stop(s, {}, BLOCK).last.decision, 'block');
  s.append([human('continue')]);
  s.append([edit('/r/src/a.js')]);
  assert.strictEqual(stop(s, {}, BLOCK).last.decision, 'block');
  s.append([human('continue')]);
  s.append([edit('/r/src/a.js')]);
  assert.strictEqual(stop(s, {}, BLOCK).last.why, 'block cap');
});
t('incremental: second stop reads only appended lines and still sees the check', () => {
  const s = session([human('x'), edit('/r/src/a.js')]);
  assert.strictEqual(stop(s).last.decision, 'would_block');
  s.append([bash('pnpm lint')]);
  assert.strictEqual(stop(s).last.why, 'verified');
});
t('missing transcript or bad input: exit 0, allow', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vgate-home-'));
  for (const input of ['{not json', JSON.stringify({ transcript_path: '/nope.jsonl' })]) {
    const r = spawnSync('node', [SCRIPT], { input, encoding: 'utf8', env: { ...process.env, HOME: home, ...BLOCK } });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, '');
  }
});

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exit(failed ? 1 : 0);
