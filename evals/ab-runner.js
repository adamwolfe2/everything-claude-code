#!/usr/bin/env node
// ab-runner.js — isolated A/B runner for a harness mutation.
//
// Reads (never writes) the frozen set at ~/.claude/evals/harness-evals.jsonl.
// Baseline  = live harness state.
// Candidate = live harness state + the mutation's added rules text, injected
//             via --append-system-prompt (no global config mutation, no
//             credential copying, no rules-symlink flip).
//
// usage: node ab-runner.js --label main|cand [--append <file>] [--model sonnet] [--judge haiku]

'use strict'
const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

const FROZEN = '/Users/adamwolfe/.claude/evals/harness-evals.jsonl'
const OUT_DIR = path.join(__dirname, 'results')
const TIMEOUT = 240_000

function parseArgs(argv) {
  const a = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { a[argv[i].slice(2)] = argv[i + 1]; i++ } else a._.push(argv[i])
  }
  return a
}

function claude(prompt, model, extraArgs = []) {
  return new Promise((resolve, reject) => {
    execFile('claude', ['-p', prompt, '--model', model, '--output-format', 'text', ...extraArgs],
      { timeout: TIMEOUT, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => err
        ? reject(new Error(`claude failed: ${err.message} ${String(stderr).slice(0, 200)}`))
        : resolve(String(stdout).trim()))
  })
}

function extractJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s === -1 || e <= s) throw new Error(`no JSON in judge output: ${text.slice(0, 120)}`)
  return JSON.parse(text.slice(s, e + 1))
}

async function judge(kase, response, judgeModel) {
  const p = [
    'You are a strict eval judge. Output ONLY a JSON object, no prose, no fences.',
    `ASSERTION: ${kase.assert}`,
    'CANDIDATE RESPONSE:', '---', response.slice(0, 12_000), '---',
    'Does the response satisfy the assertion? Judge literally; partial credit is a fail.',
    'Output exactly: {"pass": true|false, "reason": "<one sentence>"}',
  ].join('\n')
  const v = extractJson(await claude(p, judgeModel))
  return { pass: !!v.pass, reason: String(v.reason || '') }
}

async function pool(items, worker, size) {
  const out = new Array(items.length)
  let next = 0
  const lane = async () => { while (next < items.length) { const i = next++; out[i] = await worker(items[i]) } }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, lane))
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const label = args.label || 'unlabeled'
  const model = args.model || 'sonnet'
  const judgeModel = args.judge || 'haiku'
  const extra = args.append ? ['--append-system-prompt', fs.readFileSync(args.append, 'utf8')] : []

  const cases = fs.readFileSync(FROZEN, 'utf8').split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('//')).map(l => JSON.parse(l))

  console.log(`[${label}] ${cases.length} cases · model=${model} judge=${judgeModel} append=${!!args.append}`)

  const results = await pool(cases, async (kase) => {
    const t0 = Date.now()
    try {
      const resp = await claude(kase.prompt, model, extra)
      const j = await judge(kase, resp, judgeModel)
      const r = { id: kase.id, ...j, earned: j.pass ? 1 : 0, possible: 1, ms: Date.now() - t0 }
      console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}${r.pass ? '' : ' — ' + r.reason.slice(0, 90)}`)
      return r
    } catch (err) {
      console.log(`  ERROR ${kase.id} — ${err.message.slice(0, 90)}`)
      return { id: kase.id, pass: false, earned: 0, possible: 1, reason: `RUNNER ERROR: ${err.message}`, ms: Date.now() - t0 }
    }
  }, Number(args.concurrency || 4))

  const earned = results.reduce((a, r) => a + r.earned, 0)
  const score = Math.round((earned / results.length) * 1000) / 10
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, `ab-${label}.jsonl`)
  fs.writeFileSync(file, [JSON.stringify({ _meta: true, label, composite: score, passes: earned, cases: results.length }),
    ...results.map(r => JSON.stringify(r))].join('\n') + '\n')
  console.log(`\n[${label}] Composite: ${score}/100 (${earned}/${results.length})\n[${label}] ${file}`)
}

main().catch(e => { console.error(e); process.exit(1) })
