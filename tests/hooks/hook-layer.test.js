// Hook layer contract: matchers can actually match, and guardrail hooks speak JSON Claude can see.
// Runs each hook against throwaway git repos with HOME pointed at a temp dir (no real state touched).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const LIVE = '/Users/adamwolfe/everything-claude-code/';
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'hooks.json'), 'utf8'));
let passed = 0;
let failed = 0;
const t = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`); }
};

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hooktest-home-'));
function repo(files, commitMsg = 'init') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooktest-repo-'));
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  g('add', '-A');
  g('commit', '-qm', commitMsg);
  return dir;
}
function run(script, input) {
  const r = spawnSync('node', [path.join(ROOT, 'scripts', 'hooks', script)], {
    input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, HOME: home },
  });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}
const ctx = (out) => JSON.parse(out).hookSpecificOutput.additionalContext;

console.log('config/hooks.json:');
t('every matcher is "*" or exact tool names', () => {
  for (const [ev, arr] of Object.entries(cfg.hooks)) {
    for (const e of arr) assert.ok(e.matcher === '*' || /^[A-Za-z0-9_|]+$/.test(e.matcher), `${ev}: ${e.matcher}`);
  }
});
t('every referenced script exists in the repo', () => {
  for (const arr of Object.values(cfg.hooks)) for (const e of arr) for (const h of e.hooks) {
    const m = h.command.match(/node "([^"]+)"/);
    if (m) assert.ok(fs.existsSync(path.join(ROOT, m[1].replace(LIVE, ''))), m[1]);
  }
});
t('mergeHooks: agent-nook kept, stale dropped, wanted added', () => {
  const current = {
    Stop: [{ matcher: 'tool == "x"', hooks: [] }, { agent_nook_event: 'stop', matcher: '', hooks: [] }],
    Notification: [{ agent_nook_event: 'notification', matcher: '', hooks: [] }],
    Old: [{ matcher: '*', hooks: [] }],
  };
  const wanted = { Stop: [{ matcher: '*', hooks: [{ command: 'x' }] }] };
  const src = `import { mergeHooks } from ${JSON.stringify(path.join(ROOT, 'scripts', 'apply-hooks.mjs'))};
    process.stdout.write(JSON.stringify(mergeHooks(${JSON.stringify(current)}, ${JSON.stringify(wanted)})));`;
  const merged = JSON.parse(execFileSync('node', ['--input-type=module', '-e', src], { encoding: 'utf8' }));
  assert.deepEqual(Object.keys(merged).sort(), ['Notification', 'Stop']);
  assert.equal(merged.Stop.length, 2);
  assert.equal(merged.Stop[1].agent_nook_event, 'stop');
});

console.log('\ntaste-lint.js:');
{
  const dir = repo({ 'src/a.ts': 'export const a = 1\n' });
  fs.appendFileSync(path.join(dir, 'src/a.ts'), 'try { run() } catch (e) {}\n');
  const input = { session_id: 's1', cwd: dir, stop_hook_active: false };
  const first = run('taste-lint.js', input);
  t('reports an added empty catch as JSON additionalContext', () => {
    assert.equal(first.code, 0);
    assert.match(ctx(first.out), /src\/a\.ts:2 .*Empty catch/);
  });
  t('same findings are not repeated in the same session', () => assert.equal(run('taste-lint.js', input).out, ''));
  t('silent when stop_hook_active', () => assert.equal(run('taste-lint.js', { ...input, session_id: 's2', stop_hook_active: true }).out, ''));
  const clean = repo({ 'src/b.ts': 'try { run() } catch (e) {}\n' });
  t('pre-existing lines are not reported', () => assert.equal(run('taste-lint.js', { session_id: 's3', cwd: clean }).out, ''));
}

console.log('\nmistake-log-nudge.js:');
{
  const dir = repo({ 'a.ts': 'x\n' }, 'fix: webhook retries');
  const input = { session_id: 'm1', cwd: dir, tool_name: 'Edit' };
  t('nudges once on a bug-fix signal, via JSON', () => assert.match(ctx(run('mistake-log-nudge.js', input).out), /\/log-mistake/));
  t('does not nudge twice in one session', () => assert.equal(run('mistake-log-nudge.js', input).out, ''));
  const plain = repo({ 'a.ts': 'x\n' }, 'feat: add page');
  t('silent without a signal', () => assert.equal(run('mistake-log-nudge.js', { session_id: 'm2', cwd: plain }).out, ''));
}

console.log('\nscope-check.js:');
{
  const dir = repo({ '.claude/specs/2026-09-26-x.md': '# x\n\nAllowed scope:\n- src/billing/\n\nNext\n', 'src/billing/a.ts': 'x\n' });
  t('warns Claude on an out-of-scope edit', () =>
    assert.match(ctx(run('scope-check.js', { cwd: dir, tool_input: { file_path: path.join(dir, 'src/ui/b.tsx') } }).out), /outside the current slice/));
  t('silent on an in-scope edit', () =>
    assert.equal(run('scope-check.js', { cwd: dir, tool_input: { file_path: path.join(dir, 'src/billing/a.ts') } }).out, ''));
  const old = new Date(Date.now() - 3 * 86400 * 1000);
  fs.utimesSync(path.join(dir, '.claude/specs/2026-09-26-x.md'), old, old);
  t('stale spec (>24h) does not police edits', () =>
    assert.equal(run('scope-check.js', { cwd: dir, tool_input: { file_path: path.join(dir, 'src/ui/b.tsx') } }).out, ''));
}

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exit(failed ? 1 : 0);
