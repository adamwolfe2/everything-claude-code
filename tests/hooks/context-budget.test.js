/**
 * Regression tests for the token-economy hooks.
 *
 *  - scripts/hooks/context-budget.js  — turn/size/cache_read gates
 *  - scripts/hooks/session-usage-log.js — session.usage record shape
 *
 * These lock the 2026-07-29 recalibration (SOFT_TURNS 800->400, HARD_TURNS 1500->700)
 * and the peak_context field, so a future edit cannot silently revert either.
 *
 * Run with: node tests/hooks/context-budget.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOKS = path.join(__dirname, '..', '..', 'scripts', 'hooks');
const CONTEXT_BUDGET = path.join(HOOKS, 'context-budget.js');
const SESSION_USAGE_LOG = path.join(HOOKS, 'session-usage-log.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

function runHook(script, payload, env) {
  const res = spawnSync('node', [script], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) },
    timeout: 60000,
  });
  return (res.stdout || '').trim();
}

/**
 * Write a synthetic transcript of `turns` assistant messages.
 * Per-turn context = input + cache_read + cache_creation, matching what the hook reads.
 */
function writeTranscript(file, { turns, perTurnContext, perTurnCacheRead }) {
  const cacheRead = perTurnCacheRead || 0;
  const creation = Math.max(0, perTurnContext - cacheRead - 10);
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      usage: {
        input_tokens: 10,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: creation,
        output_tokens: 100,
      },
      content: [{ type: 'tool_use', name: 'Read' }],
    },
  });
  fs.writeFileSync(file, new Array(turns).fill(line).join('\n') + '\n');
  return file;
}

/** Classify the hook's advisory as 'none' | 'soft' | 'hard'. */
function budgetLevel(transcriptPath) {
  const out = runHook(CONTEXT_BUDGET, { transcript_path: transcriptPath });
  if (!out) return 'none';
  const msg = JSON.parse(out).hookSpecificOutput.additionalContext || '';
  if (/STOP and tell Adam NOW/.test(msg)) return 'hard';
  if (/wrap up soon/.test(msg)) return 'soft';
  return 'none';
}

function withTranscript(opts, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxbudget-'));
  const file = writeTranscript(path.join(dir, 'transcript.jsonl'), opts);
  try {
    return fn(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('\n=== context-budget.js: turn gates (recalibrated 2026-07-29) ===');

test('stays silent on a short session', () => {
  withTranscript({ turns: 50, perTurnContext: 50000, perTurnCacheRead: 40000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'none');
  });
});

test('stays silent at 399 turns (just below SOFT_TURNS)', () => {
  withTranscript({ turns: 399, perTurnContext: 10000, perTurnCacheRead: 5000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'none');
  });
});

test('soft-nudges at 400 turns (SOFT_TURNS)', () => {
  withTranscript({ turns: 400, perTurnContext: 10000, perTurnCacheRead: 5000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'soft');
  });
});

test('still soft at 699 turns (just below HARD_TURNS)', () => {
  withTranscript({ turns: 699, perTurnContext: 10000, perTurnCacheRead: 5000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'soft');
  });
});

test('hard-stops at 700 turns (HARD_TURNS)', () => {
  withTranscript({ turns: 700, perTurnContext: 10000, perTurnCacheRead: 5000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'hard');
  });
});

test('hard-stops at 800 turns (was only a soft nudge before recalibration)', () => {
  withTranscript({ turns: 800, perTurnContext: 10000, perTurnCacheRead: 5000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'hard');
  });
});

console.log('\n=== context-budget.js: size gates (must be unchanged) ===');

test('soft-nudges at 300K context regardless of turn count', () => {
  withTranscript({ turns: 5, perTurnContext: 350000, perTurnCacheRead: 340000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'soft');
  });
});

test('hard-stops at 600K context regardless of turn count', () => {
  withTranscript({ turns: 5, perTurnContext: 650000, perTurnCacheRead: 640000 }, (f) => {
    assert.strictEqual(budgetLevel(f), 'hard');
  });
});

console.log('\n=== context-budget.js: robustness ===');

test('exits quietly when the transcript path is missing', () => {
  const out = runHook(CONTEXT_BUDGET, { transcript_path: '/nonexistent/transcript.jsonl' });
  assert.strictEqual(out, '');
});

test('exits quietly on malformed stdin', () => {
  const res = spawnSync('node', [CONTEXT_BUDGET], { input: 'not json', encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(res.status, 0);
  assert.strictEqual((res.stdout || '').trim(), '');
});

test('skips unparseable transcript lines without crashing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxbudget-'));
  const file = path.join(dir, 'transcript.jsonl');
  writeTranscript(file, { turns: 400, perTurnContext: 10000, perTurnCacheRead: 5000 });
  fs.appendFileSync(file, '{ not valid json\n');
  try {
    assert.strictEqual(budgetLevel(file), 'soft');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log('\n=== session-usage-log.js: session.usage record ===');

function logSession(transcriptPath) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sulhome-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  try {
    runHook(SESSION_USAGE_LOG, { transcript_path: transcriptPath, cwd: '/tmp/proj', session_id: 'abcdef123456' }, { HOME: home });
    const telemetry = path.join(home, '.claude', 'telemetry.jsonl');
    const lines = fs.readFileSync(telemetry, 'utf8').trim().split('\n');
    return JSON.parse(lines[lines.length - 1]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test('emits peak_context equal to the largest single-turn context', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sul-'));
  const file = path.join(dir, 'transcript.jsonl');
  const mk = (input, cacheRead, creation) =>
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', usage: { input_tokens: input, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: creation, output_tokens: 10 } },
    });
  // peak is the middle turn: 100 + 500000 + 20000 = 520100
  fs.writeFileSync(file, [mk(10, 1000, 500), mk(100, 500000, 20000), mk(50, 3000, 1000)].join('\n') + '\n');
  try {
    const rec = logSession(file);
    assert.strictEqual(rec.peak_context, 520100, `expected 520100, got ${rec.peak_context}`);
    assert.strictEqual(rec.turns, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('peak_context is 0 for a transcript with no usage blocks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sul-'));
  const file = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(file, JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }) + '\n');
  try {
    const rec = logSession(file);
    assert.strictEqual(rec.peak_context, 0);
    assert.strictEqual(rec.turns, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('keeps the full pre-existing record schema', () => {
  withTranscript({ turns: 3, perTurnContext: 10000, perTurnCacheRead: 5000 }, (f) => {
    const rec = logSession(f);
    for (const key of ['ts', 'type', 'project', 'session', 'turns', 'out_tokens', 'cache_create', 'cache_read', 'raw_in', 'tool_calls', 'top_tools']) {
      assert.ok(key in rec, `session.usage record lost field: ${key}`);
    }
    assert.strictEqual(rec.type, 'session.usage');
  });
});

test('peak_context is never below the per-turn average context', () => {
  withTranscript({ turns: 20, perTurnContext: 250000, perTurnCacheRead: 200000 }, (f) => {
    const rec = logSession(f);
    const avg = (rec.raw_in + rec.cache_read + rec.cache_create) / rec.turns;
    assert.ok(rec.peak_context >= avg, `peak ${rec.peak_context} < avg ${avg}`);
  });
});

console.log('\n=== Test Results ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
