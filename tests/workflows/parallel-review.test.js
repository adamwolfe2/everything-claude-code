// parallel-review.js runs against stubbed agent()/pipeline(): a dead reviewer lane must surface as
// "unavailable" with a reason, never as an empty (clean-looking) findings array.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const t = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`); }
};

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'workflows', 'parallel-review.js'), 'utf8');
const body = src.replace(/^export const meta/m, 'const meta');
const AsyncFunction = (async () => {}).constructor;
const workflow = new AsyncFunction('args', 'agent', 'pipeline', 'parallel', 'phase', 'log', body);

async function run(respond) {
  const calls = [];
  const logs = [];
  const agent = async (prompt, opts = {}) => { calls.push({ prompt, opts }); return respond(opts.label || '', prompt, opts); };
  const parallel = (thunks) => Promise.all(thunks.map((f) => f().catch(() => null)));
  const pipeline = (items, ...stages) => Promise.all(items.map(async (item, i) => {
    let r;
    for (const [n, stage] of stages.entries()) {
      try { r = await (n === 0 ? stage(item, item, i) : stage(r, item, i)); } catch { return null; }
    }
    return r;
  }));
  const result = await workflow(undefined, agent, pipeline, parallel, () => {}, (m) => logs.push(m));
  return { result, calls, logs };
}

const finding = { severity: 'HIGH', file: 'a.js', line: '3', issue: 'x', fix: 'y' };

(async () => {
  console.log('workflows/parallel-review.js:');
  await t('codex lane prompt uses codex-lane, no shared /tmp file, no GNU timeout', async () => {
    const { calls } = await run((label) => (label.startsWith('verify') ? { isReal: true, confidence: 'high', reasoning: '' } : { status: 'ok', findings: [] }));
    const codex = calls.find((c) => c.opts.label === 'review:codex');
    assert.ok(codex.prompt.includes('codex-bridge/bin/codex-lane'), 'uses codex-lane');
    assert.ok(!codex.prompt.includes('/tmp/cx-review.txt'), 'no shared temp file');
    assert.ok(!/\btimeout \d/.test(codex.prompt), 'no GNU timeout');
    assert.deepStrictEqual(codex.opts.schema.required, ['status', 'findings']);
  });
  await t('unavailable codex lane and a dead reviewer are reported, not read as clean', async () => {
    const { result, logs } = await run((label) => {
      if (label === 'review:codex') return { status: 'unavailable', reason: 'UNAVAILABLE: codex CLI not found on PATH', findings: [] };
      if (label === 'review:security') return null;
      if (label === 'review:quality') return { findings: [finding] };
      return { isReal: true, confidence: 'high', reasoning: 'seen in code' };
    });
    const byLane = Object.fromEntries(result.lanes.map((l) => [l.lane, l]));
    assert.strictEqual(byLane.quality.status, 'ok');
    assert.strictEqual(byLane.codex.status, 'unavailable');
    assert.ok(byLane.codex.reason.includes('codex CLI not found'));
    assert.strictEqual(byLane.security.status, 'unavailable');
    assert.strictEqual(result.confirmed.length, 1);
    assert.ok(logs.some((m) => m.startsWith('UNAVAILABLE codex')), logs.join(' | '));
    assert.ok(logs.some((m) => m.includes('1/3 reviewers ran')), logs.join(' | '));
  });
  console.log(`\nPassed: ${passed}\nFailed: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
