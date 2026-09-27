// ui-gate.js contract: throwaway repo + temp projects.json + static server with seeded-bug and clean pages.
// Browser cases need `npm ci --prefix vendor`; without it they are skipped (reported, not passed).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'hooks', 'ui-gate.js');
const FIX = path.join(ROOT, 'tests', 'fixtures', 'ui-gate');
const HAVE_AB = fs.existsSync(path.join(ROOT, 'vendor', 'node_modules', '.bin', 'agent-browser'));
let passed = 0;
let failed = 0;
const t = (name, fn, needsBrowser) => {
  if (needsBrowser && !HAVE_AB) { console.log(`  - skipped (no vendor/node_modules): ${name}`); return; }
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`); }
};

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'uigate-test-')));
const servers = [];
function serve(dir, port) {
  const p = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
  servers.push(p);
  for (let i = 0; i < 50; i += 1) {
    if (spawnSync('curl', ['-s', '-o', '/dev/null', `http://127.0.0.1:${port}/`]).status === 0) return;
    spawnSync('sleep', ['0.1']);
  }
  throw new Error(`server on ${port} did not start`);
}

let n = 0;
function setup({ packs = ['ui-gate'], conventions, url, file = 'app/page.tsx' } = {}) {
  n += 1;
  const repo = path.join(tmp, `repo${n}`);
  const g = (...a) => execFileSync('git', ['-C', repo, ...a], { stdio: 'ignore' });
  fs.mkdirSync(path.join(repo, 'app'), { recursive: true });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, 'README.md'), 'x\n');
  g('add', '-A'); g('commit', '-qm', 'init');
  if (file) fs.writeFileSync(path.join(repo, file), `export default () => null // ${n}\n`);
  if (url) { fs.mkdirSync(path.join(repo, '.claude')); fs.writeFileSync(path.join(repo, '.claude', 'dev-url'), url); }
  const projects = path.join(tmp, `projects${n}.json`);
  fs.writeFileSync(projects, JSON.stringify({ projects: [{ id: `p${n}`, path: repo, packs, conventions }], packs: {} }));
  return { repo, projects, state: path.join(tmp, `state${n}`) };
}
function stop(s, extra = {}, env = {}) {
  const r = spawnSync('node', [SCRIPT], {
    input: JSON.stringify({ session_id: 's', cwd: s.repo, stop_hook_active: false, ...extra }),
    encoding: 'utf8', timeout: 120000,
    env: { ...process.env, UIGATE_PROJECTS: s.projects, UIGATE_STATE: s.state, ...env },
  });
  assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
  const lines = fs.readFileSync(path.join(s.state, 'uigate.jsonl'), 'utf8').trim().split('\n');
  return { out: r.stdout.trim(), last: JSON.parse(lines[lines.length - 1]) };
}

console.log('ui-gate.js:');
try {
  serve(path.join(FIX, 'bad'), 8941);
  serve(path.join(FIX, 'clean'), 8942);
  const BAD = 'http://127.0.0.1:8941/';
  const CLEAN = 'http://127.0.0.1:8942/';

  t('pack not listed: allow without rendering', () => {
    assert.strictEqual(stop(setup({ packs: [], url: BAD })).last.why, 'pack off');
  });
  t('no UI files changed: allow', () => {
    assert.strictEqual(stop(setup({ file: null, url: BAD })).last.why, 'no ui changes');
  });
  t('stop_hook_active: allow', () => {
    assert.strictEqual(stop(setup({ url: BAD }), { stop_hook_active: true }).last.why, 'stop_hook_active');
  });
  t('dev server not answering: allow', () => {
    assert.strictEqual(stop(setup({ url: 'http://127.0.0.1:8949/' })).last.why, 'no dev server');
  });
  // One mutable site so the URL (the baseline key) stays fixed while the page changes under it.
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  const page = (which) => fs.copyFileSync(path.join(FIX, which, 'index.html'), path.join(site, 'index.html'));
  page('clean');
  serve(site, 8943);
  const SITE = 'http://127.0.0.1:8943/';
  const edit = (s, k) => fs.writeFileSync(path.join(s.repo, 'app', 'page.tsx'), `export default () => null // edit ${k}\n`);

  t('first render records a baseline and never blocks, even on a buggy page', () => {
    const r = stop(setup({ url: BAD }));
    assert.strictEqual(r.last.why, 'baseline recorded');
    assert.strictEqual(r.out, '');
    assert.ok(r.last.total > 0, 'baseline should still log what it saw');
  }, true);
  t('clean baseline, then seeded bugs: blocks with each new defect; drops sr-only; under 1K tokens', () => {
    page('clean');
    const s = setup({ url: SITE });
    assert.strictEqual(stop(s).last.why, 'baseline recorded');
    page('bad');
    edit(s, 1);
    const r = stop(s);
    const j = JSON.parse(r.out);
    assert.strictEqual(j.decision, 'block');
    for (const want of ['390px:', 'horizontal scroll: div.wide', 'tap targets too small: a.tiny', 'dark background', 'emoji in UI copy', 'non-Lucide icons', 'color-contrast']) {
      assert.ok(j.reason.includes(want), `missing "${want}" in:\n${j.reason}`);
    }
    assert.ok(!/sr-only/.test(j.reason), 'sr-only element reported');
    assert.ok(!/1440px:.*tap targets/.test(j.reason), 'tap targets reported at desktop width');
    assert.ok(j.reason.length <= 3500, `reason ${j.reason.length} chars`);
    const again = stop(s);
    assert.strictEqual(again.last.why, 'diff already checked');
    assert.strictEqual(again.out, '');
    edit(s, 2);
    const same = stop(s);
    assert.strictEqual(same.last.why, 'no new findings', 'pre-existing defects must not re-block');
    assert.strictEqual(same.out, '');
  }, true);
  t('clean page stays clean across edits', () => {
    page('clean');
    const s = setup({ url: SITE });
    stop(s);
    edit(s, 3);
    const r = stop(s);
    assert.strictEqual(r.last.why, 'no new findings', r.last.findings);
    assert.strictEqual(r.last.total, 0, 'clean fixture should produce zero findings');
  }, true);
  t('dark-by-design project: no dark-background finding; UIGATE_MODE=log never blocks', () => {
    page('clean');
    const s = setup({ url: SITE, conventions: ['DARK/GOLD by design'] });
    stop(s);
    page('bad');
    edit(s, 4);
    const r = stop(s, {}, { UIGATE_MODE: 'log' });
    assert.strictEqual(r.last.decision, 'would_block');
    assert.strictEqual(r.out, '');
    assert.ok(!/dark background/.test(r.last.findings), r.last.findings);
  }, true);
} finally {
  for (const p of servers) p.kill();
}

console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
process.exit(failed ? 1 : 0);
