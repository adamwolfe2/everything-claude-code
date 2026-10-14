// correction-rate.js buckets autopilot.prompt events by week and ignores everything else.
const assert = require('assert')
const path = require('path')
const { weeklyRates } = require(path.join(__dirname, '..', '..', 'scripts', 'correction-rate.js'))

const now = Date.parse('2026-10-14T12:00:00Z')
const day = 86400 * 1000
const ev = (daysAgo, isCorrection) => JSON.stringify({ ts: new Date(now - daysAgo * day).toISOString(), type: 'autopilot.prompt', isCorrection })
const lines = [
  ev(1, true), ev(2, false), ev(3, false), ev(6, false), // this week: 1 of 4
  ev(8, true), ev(9, true), // last week: 2 of 2
  ev(40, true), // older than the window
  '{"type":"taste.findings","count":4}',
  '{torn line',
]

let failed = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`) } catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`) }
}
const rates = weeklyRates(lines, 4, now)
t('this week is 1 correction in 4 prompts', () => assert.deepStrictEqual([rates[3].corrections, rates[3].prompts], [1, 4]))
t('last week is 2 of 2', () => assert.strictEqual(rates[2].rate, 1))
t('weeks with no prompts have no rate', () => assert.strictEqual(rates[0].rate, null))
t('other events, old events and torn lines are ignored', () => assert.strictEqual(rates.reduce((n, b) => n + b.prompts, 0), 6))
console.log(`\nPassed: ${4 - failed}\nFailed: ${failed}`)
process.exit(failed ? 1 : 0)
