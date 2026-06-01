// Telemetry library — single source of truth for everything-claude-code observability.
// Schema-less for portability: pure JSON-line append at ~/.claude/telemetry.jsonl
// (SQLite would require a native dependency; JSONL is dependency-free and tail-friendly).

const fs = require('fs')
const path = require('path')
const os = require('os')

const CLAUDE_DIR = path.join(os.homedir(), '.claude')
const TELEMETRY_FILE = path.join(CLAUDE_DIR, 'telemetry.jsonl')
const SESSION_FILE = path.join(CLAUDE_DIR, 'current-session.json')

function ensureDir() {
  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true })
}

function now() {
  return new Date().toISOString()
}

function detectProject() {
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return path.basename(dir)
    dir = path.dirname(dir)
  }
  return 'unknown'
}

function logEvent(type, data = {}) {
  try {
    ensureDir()
    const event = {
      ts: now(),
      type,
      project: detectProject(),
      cwd: process.cwd(),
      ...data,
    }
    fs.appendFileSync(TELEMETRY_FILE, JSON.stringify(event) + '\n')
    return event
  } catch (err) {
    // Telemetry must never break the user's work.
    process.stderr.write(`[telemetry] ${err.message}\n`)
    return null
  }
}

function readEvents({ since, until, type, project, limit = 10000 } = {}) {
  try {
    if (!fs.existsSync(TELEMETRY_FILE)) return []
    const lines = fs.readFileSync(TELEMETRY_FILE, 'utf8').split('\n').filter(Boolean)
    const events = []
    for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
      try {
        const e = JSON.parse(lines[i])
        if (since && new Date(e.ts) < new Date(since)) continue
        if (until && new Date(e.ts) > new Date(until)) continue
        if (type && e.type !== type) continue
        if (project && e.project !== project) continue
        events.push(e)
      } catch {}
    }
    return events.reverse()
  } catch {
    return []
  }
}

function startSession({ sessionId } = {}) {
  ensureDir()
  const session = {
    sessionId: sessionId || `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: now(),
    project: detectProject(),
    cwd: process.cwd(),
  }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))
  logEvent('session.start', { sessionId: session.sessionId })
  return session
}

function endSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
    logEvent('session.end', {
      sessionId: session.sessionId,
      durationMs: new Date().getTime() - new Date(session.startedAt).getTime(),
    })
    fs.unlinkSync(SESSION_FILE)
  } catch {}
}

function currentSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
  } catch {
    return null
  }
}

// Aggregations
function summarize({ since } = {}) {
  const events = readEvents({ since })
  const byType = {}
  const byProject = {}
  const byCommand = {}
  const bySkill = {}
  const failures = []
  let sessions = 0

  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1
    byProject[e.project] = (byProject[e.project] || 0) + 1
    if (e.type === 'command.run' && e.command) byCommand[e.command] = (byCommand[e.command] || 0) + 1
    if (e.type === 'skill.fire' && e.skill) bySkill[e.skill] = (bySkill[e.skill] || 0) + 1
    if (e.type === 'session.start') sessions++
    if (e.type === 'command.fail' || e.type === 'cap.blocked' || e.type === 'ship.fail') failures.push(e)
  }

  return { sessions, byType, byProject, byCommand, bySkill, failures, totalEvents: events.length }
}

module.exports = {
  logEvent,
  readEvents,
  startSession,
  endSession,
  currentSession,
  summarize,
  TELEMETRY_FILE,
  SESSION_FILE,
}
