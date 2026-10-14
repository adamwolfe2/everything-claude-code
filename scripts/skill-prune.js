#!/usr/bin/env node
// Keeps the always-loaded skill list to what Adam actually uses. Archived skills stay one
// `/lib <query>` away (autopilot mod), so archiving is cheap and reversible.
//   archive: a tracked skill/command with no use in 30 days, referenced nowhere, unchanged for 30 days
//   restore: an archived one loaded from /lib twice in 30 days
// Usage comes from autopilot.skill telemetry events. Dry run unless --apply (which git mv's, no commit).
// Usage: node scripts/skill-prune.js [--apply]

const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DAY_MS = 86400 * 1000
const WINDOW_MS = 30 * DAY_MS
const RESTORE_LOADS = 2
const ROOT = path.join(__dirname, '..')

/** Pure: what to archive and restore. */
function plan({ active, archived, usage, loads, referenced, trackingSince, now }) {
  const isTracked = trackingSince !== null && now - trackingSince >= WINDOW_MS
  const archive = isTracked
    ? active.filter(s => !usage.get(s.name) && !referenced.has(s.name) && now - s.lastCommitMs >= WINDOW_MS)
    : []
  const restore = archived.filter(s => (loads.get(s.name) || 0) >= RESTORE_LOADS)
  const note = isTracked
    ? ''
    : `Usage tracking ${trackingSince === null ? 'has no events yet' : `started ${new Date(trackingSince).toISOString().slice(0, 10)}`}; archiving waits for 30 days of it.`
  return { archive, restore, note }
}

module.exports = { plan }

function git(args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' })
}

function entries(kind) {
  const tracked = git(['ls-files', kind === 'skill' ? 'skills/*/SKILL.md' : 'commands/*.md']).split('\n').filter(Boolean)
  return tracked.map(file => {
    const name = kind === 'skill' ? file.split('/')[1] : path.basename(file, '.md')
    const own = kind === 'skill' ? `skills/${name}` : file
    return { name, kind, path: own, lastCommitMs: Number(git(['log', '-1', '--format=%ct', '--', own]).trim() || 0) * 1000 }
  })
}

function archivedEntries() {
  const out = []
  for (const kind of ['skill', 'command']) {
    const dir = path.join(ROOT, 'archive', kind === 'skill' ? 'skills' : 'commands')
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      const name = kind === 'skill' ? f : f.replace(/\.md$/, '')
      out.push({ name, kind, path: path.relative(ROOT, path.join(dir, f)) })
    }
  }
  return out
}

function usageFromTelemetry(now) {
  const file = path.join(os.homedir(), '.claude', 'telemetry.jsonl')
  const usage = new Map()
  const loads = new Map()
  let trackingSince = null
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : []
  for (const line of lines) {
    if (!line.includes('"autopilot.skill"')) continue
    let event
    try {
      event = JSON.parse(line)
    } catch (error) {
      continue // a torn line from a concurrent append
    }
    const at = Date.parse(event.ts)
    trackingSince = trackingSince === null ? at : Math.min(trackingSince, at)
    if (now - at > WINDOW_MS) continue
    const map = event.source === 'library' ? loads : usage
    map.set(event.name, (map.get(event.name) || 0) + 1)
  }
  return { usage, loads, trackingSince }
}

/** Names mentioned by routing, hooks, mods, scripts, CLAUDE.md or another skill/command. */
function references(names) {
  const files = git(['ls-files'])
    .split('\n')
    .filter(f => /\.(md|json|js|mjs|ts|tsx|sh)$/.test(f) && !f.startsWith('archive/') && /^(skills|commands|scripts|mods|config|routing)/.test(f))
  const texts = files.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')])
  texts.push(['~/.claude/CLAUDE.md', fs.readFileSync(path.join(os.homedir(), '.claude', 'CLAUDE.md'), 'utf8')])
  const referenced = new Set()
  for (const name of names) {
    const re = new RegExp(`(?<![\\w-])/?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
    const own = [`skills/${name}/`, `commands/${name}.md`]
    if (texts.some(([f, t]) => !own.some(o => f.startsWith(o)) && re.test(t))) referenced.add(name)
  }
  return referenced
}

if (require.main === module) {
  const now = Date.now()
  const active = [...entries('skill'), ...entries('command')]
  const archived = archivedEntries()
  const { usage, loads, trackingSince } = usageFromTelemetry(now)
  const result = plan({ active, archived, usage, loads, referenced: references(active.map(s => s.name)), trackingSince, now })
  if (result.note) console.log(result.note)
  console.log(`archive (${result.archive.length}): ${result.archive.map(s => s.name).join(', ') || 'none'}`)
  console.log(`restore (${result.restore.length}): ${result.restore.map(s => s.name).join(', ') || 'none'}`)
  if (process.argv.includes('--apply')) {
    for (const s of result.archive) {
      const to = s.kind === 'skill' ? `archive/skills/${s.name}` : `archive/commands/${s.name}.md`
      fs.mkdirSync(path.join(ROOT, path.dirname(to)), { recursive: true })
      git(['mv', s.path, to])
    }
    for (const s of result.restore) git(['mv', s.path, s.kind === 'skill' ? `skills/${s.name}` : `commands/${s.name}.md`])
    console.log('Applied with git mv; review and commit.')
  } else {
    console.log('Dry run. Re-run with --apply to move them.')
  }
}
