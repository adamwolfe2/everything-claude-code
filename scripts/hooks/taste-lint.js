#!/usr/bin/env node
// Stop hook: scans lines ADDED in the working tree (tracked diff vs HEAD + untracked files) for
// taste violations and tells Claude about serious ones (critical/high) via additionalContext.
// Stop output on a plain exit 0 never reaches the model, so this hook speaks JSON.
// Guards against loops and noise: skips when stop_hook_active, reports each unique finding set
// once per session, and ignores pre-existing lines (only what this work added).

const { execFileSync } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const telemetry = require(path.join(__dirname, '..', 'lib', 'telemetry.js'))

const STATE_DIR = path.join(os.homedir(), '.claude', 'state', 'taste-lint')
const REPORT = new Set(['critical', 'high'])
const CODE = /\.(ts|tsx|js|jsx)$/

function git(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    return null // not a repo / no HEAD: caller treats as nothing to scan
  }
}

/** Map of file -> [{line, text}] for lines added relative to HEAD, plus all lines of new files. */
function addedLines(cwd) {
  const out = new Map()
  const diff = git(cwd, ['diff', '-U0', '--no-color', 'HEAD', '--', '*.ts', '*.tsx', '*.js', '*.jsx']) || ''
  let file = null
  let lineNo = 0
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { file = l.slice(4).replace(/^b\//, ''); continue }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/)
    if (h) { lineNo = Number(h[1]); continue }
    if (file && file !== '/dev/null' && l.startsWith('+')) {
      out.set(file, [...(out.get(file) || []), { line: lineNo, text: l.slice(1) }])
      lineNo += 1
    }
  }
  const untracked = (git(cwd, ['ls-files', '--others', '--exclude-standard']) || '').split('\n').filter(f => CODE.test(f))
  for (const f of untracked) {
    const abs = path.join(cwd, f)
    if (!fs.existsSync(abs) || fs.statSync(abs).size > 512 * 1024) continue
    out.set(f, fs.readFileSync(abs, 'utf8').split('\n').map((text, i) => ({ line: i + 1, text })))
  }
  return out
}

const RULES = [
  {
    name: 'emoji',
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    severity: 'high',
    message: 'Emoji (hard rule: Lucide icons, no emojis)',
  },
  {
    name: 'console.log',
    pattern: /console\.log\s*\(/,
    severity: 'med',
    message: 'console.log',
  },
  {
    name: 'as-any',
    pattern: /\bas\s+any\b/,
    severity: 'high',
    message: '`as any` — avoid forcing types',
  },
  {
    name: 'ts-ignore',
    pattern: /@ts-ignore|@ts-nocheck/,
    severity: 'high',
    message: '@ts-ignore / @ts-nocheck',
  },
  {
    name: 'empty-catch',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: 'high',
    message: 'Empty catch block — swallowed error',
  },
  {
    name: 'hardcoded-secret',
    pattern: /(sk-(proj-)?[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["'][A-Za-z0-9-_]{20,})/,
    severity: 'critical',
    message: 'Possible hardcoded secret',
  },
  {
    name: 'fixme-no-ticket',
    pattern: /(TODO|FIXME)(?!.*\b(?:#|JIRA|TASK|GH)-?\d+\b)/i,
    severity: 'low',
    message: 'TODO/FIXME without ticket reference',
  },
  {
    name: 'array-mutation',
    pattern: /\b(\w+)\.(push|pop|shift|unshift|splice)\s*\(/,
    severity: 'low',
    message: 'Array mutation (consider spread/immutable)',
  },
]

function scanLines(file, lines) {
  const findings = []
  for (const { line, text } of lines) {
    const t = text.trim()
    if (t.startsWith('//') || t.startsWith('*')) continue
    for (const rule of RULES) {
      if (rule.pattern.test(text)) {
        findings.push({ file, line, rule: rule.name, severity: rule.severity, message: rule.message })
      }
    }
  }
  return findings
}

let buf = ''
process.stdin.on('data', c => (buf += c))
process.stdin.on('end', () => {
  let input
  try { input = JSON.parse(buf) } catch (error) {
    process.stderr.write(`[taste] bad hook input: ${error.message}\n`)
    return
  }
  if (input.stop_hook_active) return
  const cwd = input.cwd || process.cwd()
  if (!git(cwd, ['rev-parse', '--git-dir'])) return

  const all = [...addedLines(cwd)].flatMap(([file, lines]) => scanLines(file, lines))
  if (all.length === 0) return
  const bySeverity = { critical: 0, high: 0, med: 0, low: 0 }
  for (const f of all) bySeverity[f.severity]++
  telemetry.logEvent('taste.findings', { count: all.length, bySeverity })

  const serious = all.filter(f => REPORT.has(f.severity))
  if (serious.length === 0) return
  const key = crypto.createHash('sha1').update(serious.map(f => `${f.file}:${f.line}:${f.rule}`).join('|')).digest('hex')
  const stateFile = path.join(STATE_DIR, `${input.session_id || 'unknown'}.json`)
  const seen = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : []
  if (seen.includes(key)) return
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(stateFile, JSON.stringify([...seen, key]))

  const lines = serious.slice(0, 10).map(f => `- [${f.severity}] ${f.file}:${f.line} ${f.message}`)
  const more = serious.length > 10 ? `\n- ... ${serious.length - 10} more` : ''
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: `[taste] ${serious.length} serious finding(s) in lines added to ${cwd}:\n${lines.join('\n')}${more}\nFix them, or say in one line why each is intentional. Do not claim done with these open.`,
    },
  }))
})
