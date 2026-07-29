#!/usr/bin/env node
// run-evals.js — deterministic eval runner for the harness eval sets.
//
// Usage:
//   node evals/run-evals.js run [--set harness|tasks|all] [--label main] [--model sonnet] [--judge haiku] [--concurrency 4]
//   node evals/run-evals.js compare <resultsA.jsonl> <resultsB.jsonl>
//
// What it does (the previously-missing execution engine):
//   1. Loads evals/harness-evals.jsonl (grader:"model", one-line assert)
//      and evals/tasks/*.json (expected boolean map + weighted scoring).
//   2. Runs each case's prompt through headless `claude -p` (the CANDIDATE —
//      it loads whatever harness state is currently on disk, so A/B = run
//      once per branch/state with different --label).
//   3. Judges each response with a cheap model via `claude -p --model <judge>`,
//      forced to emit strict JSON. No self-grading: judge ≠ candidate session.
//   4. Writes evals/results/<label>-<stamp>.jsonl + prints a composite score.
//   5. `compare` prints per-case deltas + composite delta between two runs.
//
// Composite = 100 * (weighted points earned / weighted points possible).
//   harness-evals cases: pass=1/fail=0, weight 1 each.
//   tasks cases: fraction of expected-keys true, weight = sum(scoring values)/10.

'use strict'

const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const EVALS_DIR = __dirname
const RESULTS_DIR = path.join(EVALS_DIR, 'results')
const CASE_TIMEOUT_MS = 180_000

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1]
      i++
    } else {
      args._.push(argv[i])
    }
  }
  return args
}

function loadHarnessCases() {
  const file = path.join(EVALS_DIR, 'harness-evals.jsonl')
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .map((l) => {
      try {
        return { ...JSON.parse(l), _format: 'harness' }
      } catch {
        console.error(`[warn] skipping unparseable line in harness-evals.jsonl: ${l.slice(0, 60)}…`)
        return null
      }
    })
    .filter(Boolean)
}

function loadTaskCases() {
  const dir = path.join(EVALS_DIR, 'tasks')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return { ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), _format: 'task' }
      } catch {
        console.error(`[warn] skipping unparseable task file: ${f}`)
        return null
      }
    })
    .filter(Boolean)
}

function claude(prompt, { model, timeout = CASE_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'claude',
      ['-p', prompt, '--model', model, '--output-format', 'text'],
      { timeout, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`claude failed: ${err.message} ${String(stderr).slice(0, 200)}`))
        resolve(String(stdout).trim())
      }
    )
    child.on('error', reject)
  })
}

function extractJson(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error(`no JSON object in judge output: ${text.slice(0, 120)}…`)
  return JSON.parse(text.slice(start, end + 1))
}

async function judgeHarnessCase(kase, response, judgeModel) {
  const prompt = [
    'You are a strict eval judge. Output ONLY a JSON object, no prose, no fences.',
    `ASSERTION: ${kase.assert}`,
    'CANDIDATE RESPONSE:',
    '---',
    response.slice(0, 12_000),
    '---',
    'Does the response satisfy the assertion? Judge literally; partial credit is a fail.',
    'Output exactly: {"pass": true|false, "reason": "<one sentence>"}',
  ].join('\n')
  const verdict = extractJson(await claude(prompt, { model: judgeModel }))
  return { pass: !!verdict.pass, reason: String(verdict.reason || ''), earned: verdict.pass ? 1 : 0, possible: 1 }
}

async function judgeTaskCase(kase, response, judgeModel) {
  const keys = Object.keys(kase.expected || {})
  const prompt = [
    'You are a strict eval judge. Output ONLY a JSON object mapping every criterion key to true/false, no prose, no fences.',
    `TASK: ${kase.title}`,
    'CRITERIA (key: required outcome — true means the response demonstrably achieves it):',
    ...keys.map((k) => `- ${k}: ${kase.expected[k]}`),
    'CANDIDATE RESPONSE:',
    '---',
    response.slice(0, 12_000),
    '---',
    `Output exactly one JSON object with all ${keys.length} keys and boolean values. Judge literally; if unsure, false.`,
  ].join('\n')
  const verdict = extractJson(await claude(prompt, { model: judgeModel }))
  const results = Object.fromEntries(keys.map((k) => [k, verdict[k] === true]))
  const hit = keys.filter((k) => results[k]).length
  const weight = Object.values(kase.scoring || {}).reduce((a, b) => a + b, 0) / 10 || 1
  return {
    pass: hit === keys.length,
    reason: keys.filter((k) => !results[k]).join(', ') || 'all criteria met',
    criteria: results,
    earned: (hit / keys.length) * weight,
    possible: weight,
  }
}

async function runCase(kase, opts) {
  const started = Date.now()
  try {
    const response = await claude(kase.prompt, { model: opts.model })
    const judged =
      kase._format === 'task'
        ? await judgeTaskCase(kase, response, opts.judge)
        : await judgeHarnessCase(kase, response, opts.judge)
    return { id: kase.id, format: kase._format, ...judged, ms: Date.now() - started, error: null }
  } catch (err) {
    return { id: kase.id, format: kase._format, pass: false, earned: 0, possible: kase._format === 'task' ? Object.values(kase.scoring || {}).reduce((a, b) => a + b, 0) / 10 || 1 : 1, reason: `RUNNER ERROR: ${err.message}`, ms: Date.now() - started, error: err.message }
  }
}

async function pool(items, worker, size) {
  const results = new Array(items.length)
  let next = 0
  async function lane() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))
  return results
}

function composite(results) {
  const earned = results.reduce((a, r) => a + r.earned, 0)
  const possible = results.reduce((a, r) => a + r.possible, 0)
  return possible ? Math.round((earned / possible) * 1000) / 10 : 0
}

async function cmdRun(args) {
  const opts = {
    set: args.set || 'all',
    label: args.label || 'unlabeled',
    model: args.model || 'sonnet',
    judge: args.judge || 'haiku',
    concurrency: Number(args.concurrency || 4),
  }
  let cases = []
  if (opts.set === 'harness' || opts.set === 'all') cases = cases.concat(loadHarnessCases())
  if (opts.set === 'tasks' || opts.set === 'all') cases = cases.concat(loadTaskCases())
  if (args.only) cases = cases.filter((c) => String(c.id) === args.only)
  if (!cases.length) {
    console.error('No eval cases found.')
    process.exit(1)
  }
  console.log(`Running ${cases.length} cases · candidate=${opts.model} judge=${opts.judge} label=${opts.label}`)

  const results = await pool(cases, async (kase) => {
    const r = await runCase(kase, opts)
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  (${Math.round(r.ms / 1000)}s)${r.pass ? '' : ` — ${r.reason.slice(0, 100)}`}`)
    return r
  }, opts.concurrency)

  const score = composite(results)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  fs.mkdirSync(RESULTS_DIR, { recursive: true })
  const outFile = path.join(RESULTS_DIR, `${opts.label}-${stamp}.jsonl`)
  const meta = { _meta: true, label: opts.label, stamp, composite: score, cases: results.length, passes: results.filter((r) => r.pass).length, opts }
  fs.writeFileSync(outFile, [JSON.stringify(meta), ...results.map((r) => JSON.stringify(r))].join('\n') + '\n')
  console.log(`\nComposite: ${score}/100  (${meta.passes}/${results.length} pass)`)
  console.log(`Results: ${outFile}`)
}

function loadResults(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return { meta: lines.find((l) => l._meta), cases: lines.filter((l) => !l._meta) }
}

function cmdCompare(fileA, fileB) {
  const a = loadResults(fileA)
  const b = loadResults(fileB)
  const byId = new Map(a.cases.map((c) => [c.id, c]))
  console.log(`A: ${a.meta.label} composite=${a.meta.composite}   B: ${b.meta.label} composite=${b.meta.composite}   Δ=${Math.round((b.meta.composite - a.meta.composite) * 10) / 10}`)
  for (const cb of b.cases) {
    const ca = byId.get(cb.id)
    if (!ca) { console.log(`  NEW   ${cb.id}: ${cb.pass ? 'PASS' : 'FAIL'}`); continue }
    if (ca.pass !== cb.pass) console.log(`  ${cb.pass ? 'FIXED ' : 'REGRESS'} ${cb.id}: ${ca.pass ? 'PASS' : 'FAIL'} → ${cb.pass ? 'PASS' : 'FAIL'}`)
  }
  console.log('Unchanged cases omitted.')
  process.exit(b.meta.composite < a.meta.composite ? 1 : 0)
}

const args = parseArgs(process.argv.slice(2))
const cmd = args._[0] || 'run'
if (cmd === 'run') cmdRun(args).catch((e) => { console.error(e); process.exit(1) })
else if (cmd === 'compare') {
  if (args._.length < 3) { console.error('usage: compare <resultsA.jsonl> <resultsB.jsonl>'); process.exit(1) }
  cmdCompare(args._[1], args._[2])
} else {
  console.error(`unknown command: ${cmd}`)
  process.exit(1)
}
