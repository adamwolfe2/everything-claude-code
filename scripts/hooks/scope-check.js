#!/usr/bin/env node
// PreToolUse hook on Edit/Write/MultiEdit. Reads the current slice spec (if any) and warns
// Claude (via additionalContext) when an edit strays outside the declared "Allowed scope".
// Never blocks. Only specs touched in the last SPEC_FRESH_HOURS count as "current": an old
// spec in .claude/specs must not police unrelated work.

const fs = require('fs')
const path = require('path')
const telemetry = require(path.join(__dirname, '..', 'lib', 'telemetry.js'))

const SPEC_FRESH_HOURS = 24

function findCurrentSlice(startDir) {
  // Look up from cwd for a project root + .claude/specs/ with most-recent file
  let dir = startDir
  while (dir !== path.dirname(dir)) {
    const specsDir = path.join(dir, '.claude', 'specs')
    if (fs.existsSync(specsDir)) {
      const files = fs.readdirSync(specsDir)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => ({ f, ts: fs.statSync(path.join(specsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.ts - a.ts)
      const fresh = files.length > 0 && Date.now() - files[0].ts < SPEC_FRESH_HOURS * 3600 * 1000
      return fresh ? path.join(specsDir, files[0].f) : null
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
  } catch (error) {
    process.stderr.write(`[scope] cannot read spec ${specPath}: ${error.message}\n`)
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
  let input
  try { input = JSON.parse(buf) } catch (error) {
    process.stderr.write(`[scope] bad hook input: ${error.message}\n`)
    return
  }
  const filePath = input.tool_input?.file_path
  if (!filePath) return
  const specPath = findCurrentSlice(input.cwd || process.cwd())
  if (!specPath) return
  const allowed = parseAllowedScope(specPath)
  if (allowed.length === 0 || isInScope(filePath, allowed)) return

  telemetry.logEvent('scope.violation', { filePath, specPath, allowed })
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[scope] ${filePath} is outside the current slice's Allowed scope (${allowed.join(', ')}; spec ${specPath}). If this is legitimate scope growth, update the spec first. If not, stop and tell Adam.`,
    },
  }))
})
