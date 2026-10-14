#!/usr/bin/env node
// How often Adam corrects Claude, per week: autopilot.prompt events in ~/.claude/telemetry.jsonl
// (written by the autopilot mod for every typed prompt). Lower is better.
// Usage: node scripts/correction-rate.js [weeks=4] [telemetry file]

const fs = require('fs')
const os = require('os')
const path = require('path')

const WEEK_MS = 7 * 86400 * 1000

/** [{ weekStart, prompts, corrections, rate }] for the last `weeks` weeks ending at `now`, oldest first. */
function weeklyRates(lines, weeks, now) {
  const buckets = Array.from({ length: weeks }, (_, i) => ({ weekStart: new Date(now - (weeks - i) * WEEK_MS), prompts: 0, corrections: 0 }))
  for (const line of lines) {
    if (!line.includes('"autopilot.prompt"')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch (error) {
      continue // a torn line from a concurrent append; the rest of the file still counts
    }
    const age = now - Date.parse(event.ts)
    const index = weeks - 1 - Math.floor(age / WEEK_MS)
    if (age < 0 || index < 0) continue
    buckets[index].prompts += 1
    if (event.isCorrection) buckets[index].corrections += 1
  }
  return buckets.map(b => ({ ...b, rate: b.prompts ? b.corrections / b.prompts : null }))
}

module.exports = { weeklyRates }

if (require.main === module) {
  const weeks = Number(process.argv[2]) || 4
  const file = process.argv[3] || path.join(os.homedir(), '.claude', 'telemetry.jsonl')
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : []
  for (const b of weeklyRates(lines, weeks, Date.now())) {
    const rate = b.rate === null ? 'no prompts logged' : `${(b.rate * 100).toFixed(1)}% (${b.corrections}/${b.prompts})`
    console.log(`week of ${b.weekStart.toISOString().slice(0, 10)}: ${rate}`)
  }
}
