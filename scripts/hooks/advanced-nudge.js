#!/usr/bin/env node
/**
 * SessionStart hook: surface ONE underused advanced capability per session.
 * "Trained from telemetry" — ranks the deep/recursive caps by how rarely they
 * appear in telemetry.jsonl, then nudges the least-used one. Silent on failure.
 *
 * This is how the red-tier capabilities (workflows, evolve, overnight, eval-loops)
 * get proactively recommended instead of forgotten.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

const HOME = os.homedir()
const TELEMETRY = path.join(HOME, '.claude', 'telemetry.jsonl')

// The advanced capabilities we want to keep in rotation, with a one-line pitch.
const CAPS = [
  { key: 'parallel-review', pitch: 'Workflow `parallel-review` — claude + security + codex review a diff, adversarially verified. Try before /cap on a real diff.' },
  { key: 'eval-fix-loop', pitch: 'Workflow `eval-fix-loop` — an agent drives a red suite to green in a worktree, unattended. Use when tests are failing.' },
  { key: 'harness-evolve', pitch: 'Workflow `harness-evolve` — eval-gated self-improvement of your own skills/rules. Run weekly to compound the setup.' },
  { key: 'overnight', pitch: '/overnight — semi-autonomous harness improvement on a branch for morning review. Queue something tonight.' },
  { key: 'evolve-skills', pitch: '/evolve-skills — metric-gated mutation loop. Closes the LEARN loop; without it /digest suggestions go nowhere.' },
  { key: 'digest', pitch: '/digest — weekly closed-loop learning. Reads telemetry + mistakes, proposes the next optimization.' },
  { key: 'log-mistake', pitch: '/log-mistake — capture the bug you just fixed as a regression eval. Your mistakes.jsonl is the flywheel fuel.' },
]

function countMentions() {
  const counts = Object.fromEntries(CAPS.map((c) => [c.key, 0]))
  try {
    const lines = fs.readFileSync(TELEMETRY, 'utf8').split('\n').filter(Boolean)
    // only weigh the most recent 200 events so the nudge tracks current habits
    for (const line of lines.slice(-200)) {
      for (const c of CAPS) if (line.includes(c.key)) counts[c.key]++
    }
  } catch {
    // no telemetry yet — every cap is "unused", fine
  }
  return counts
}

function pick() {
  const counts = countMentions()
  // least-used first; stable rotation by using the date-of-month as a tiebreaker offset
  const ranked = [...CAPS].sort((a, b) => counts[a.key] - counts[b.key])
  const day = new Date().getDate()
  const least = ranked.filter((c) => counts[c.key] === counts[ranked[0].key])
  return least[day % least.length] || ranked[0]
}

try {
  const cap = pick()
  // SessionStart hooks inject stdout as context for the model.
  process.stdout.write(
    `\n[advanced-autopilot] Underused red-tier capability this session:\n• ${cap.pitch}\nSurface it proactively if today's work fits.\n`,
  )
} catch {
  // never block a session
}
process.exit(0)
