#!/usr/bin/env node
// Stop hook — scans modified files at session end for taste violations.
// Warns only. Reports: emojis, console.log, `as any`, `@ts-ignore`, obvious mutation patterns,
// catch{}, hardcoded secrets (heuristic), TODO/FIXME without ticket.

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const telemetry = require(path.join(__dirname, '..', 'lib', 'telemetry.js'))

function safe(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

function modifiedFiles() {
  const out = safe('git diff --name-only HEAD')
  if (!out) return []
  return out
    .split('\n')
    .filter(f => /\.(ts|tsx|js|jsx)$/.test(f) && fs.existsSync(f))
}

const RULES = [
  {
    name: 'emoji',
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    severity: 'low',
    message: 'Emoji found',
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

function scanFile(filePath) {
  const findings = []
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          file: filePath,
          line: idx + 1,
          rule: rule.name,
          severity: rule.severity,
          message: rule.message,
          excerpt: line.trim().slice(0, 100),
        })
      }
    }
  })
  return findings
}

let buf = ''
process.stdin.on('data', c => (buf += c))
process.stdin.on('end', () => {
  // Only run in git repos
  if (!safe('git rev-parse --git-dir')) {
    return process.stdout.write(buf)
  }
  const files = modifiedFiles()
  if (files.length === 0) return process.stdout.write(buf)

  const allFindings = []
  for (const f of files) {
    try {
      allFindings.push(...scanFile(f))
    } catch {}
  }

  if (allFindings.length === 0) {
    process.stdout.write(buf)
    return
  }

  const bySeverity = { critical: 0, high: 0, med: 0, low: 0 }
  for (const f of allFindings) bySeverity[f.severity]++

  process.stderr.write(`\n[taste] ${allFindings.length} finding(s) across ${files.length} modified file(s):\n`)
  process.stderr.write(`[taste]   critical: ${bySeverity.critical}  high: ${bySeverity.high}  med: ${bySeverity.med}  low: ${bySeverity.low}\n`)
  for (const f of allFindings.slice(0, 15)) {
    process.stderr.write(`[taste]   [${f.severity}] ${f.file}:${f.line} — ${f.message}\n`)
  }
  if (allFindings.length > 15) {
    process.stderr.write(`[taste]   ... ${allFindings.length - 15} more\n`)
  }
  process.stderr.write(`[taste] WARN ONLY — session continues. Fix before /cap.\n\n`)
  telemetry.logEvent('taste.findings', { count: allFindings.length, bySeverity, files: files.length })
  process.stdout.write(buf)
})
