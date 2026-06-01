#!/usr/bin/env node
// PreToolUse hook on Edit/Write. Reads the current slice spec (if any) and warns
// when edits stray outside the declared "Allowed scope". Never blocks — warns only.

const fs = require('fs')
const path = require('path')
const telemetry = require(path.join(__dirname, '..', 'lib', 'telemetry.js'))

function findCurrentSlice() {
  // Look up from cwd for a project root + .claude/specs/ with most-recent file
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    const specsDir = path.join(dir, '.claude', 'specs')
    if (fs.existsSync(specsDir)) {
      const files = fs.readdirSync(specsDir)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => ({ f, ts: fs.statSync(path.join(specsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.ts - a.ts)
      if (files.length > 0) return path.join(specsDir, files[0].f)
    }
    dir = path.dirname(dir)
  }
  return null
}

function parseAllowedScope(specPath) {
  try {
    const content = fs.readFileSync(specPath, 'utf8')
    const m = content.match(/Allowed scope:\s*\n([\s\S]*?)\n\s*\n/)
    if (!m) return []
    return m[1]
      .split('\n')
      .map(l => l.replace(/^[-*\s]+/, '').trim())
      .filter(Boolean)
      .filter(l => !l.startsWith('[') && !l.endsWith(']'))
  } catch {
    return []
  }
}

function isInScope(filePath, allowedPatterns) {
  if (allowedPatterns.length === 0) return true
  for (const pat of allowedPatterns) {
    if (filePath.includes(pat)) return true
    // simple glob: trailing slash means dir
    if (pat.endsWith('/') && filePath.includes(pat)) return true
    if (pat.endsWith('*')) {
      const prefix = pat.slice(0, -1)
      if (filePath.includes(prefix)) return true
    }
  }
  return false
}

let buf = ''
process.stdin.on('data', c => (buf += c))
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(buf)
    const filePath = input.tool_input?.file_path
    if (!filePath) return process.stdout.write(buf)

    const specPath = findCurrentSlice()
    if (!specPath) return process.stdout.write(buf)

    const allowed = parseAllowedScope(specPath)
    if (allowed.length === 0) return process.stdout.write(buf)

    if (!isInScope(filePath, allowed)) {
      process.stderr.write(`[scope] WARNING: ${filePath} is outside the slice's "Allowed scope"\n`)
      process.stderr.write(`[scope] Spec: ${specPath}\n`)
      process.stderr.write(`[scope] Allowed: ${allowed.join(', ')}\n`)
      process.stderr.write(`[scope] If this is legitimate scope growth, update the spec. If not, stop.\n`)
      telemetry.logEvent('scope.violation', { filePath, specPath, allowed })
    }
    process.stdout.write(buf)
  } catch {
    process.stdout.write(buf)
  }
})
