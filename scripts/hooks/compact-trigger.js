#!/usr/bin/env node
// PostToolUse hook on Bash (git push). When a push completes and the latest commit
// matches a known slice spec, signal that the slice is done and suggest /compact next.
// We can't auto-compact (no API); we surface a strong recommendation.

const fs = require('fs')
const path = require('path')
const telemetry = require(path.join(__dirname, '..', 'lib', 'telemetry.js'))

let buf = ''
process.stdin.on('data', c => (buf += c))
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(buf)
    const cmd = input.tool_input?.command || ''
    if (!/git push/.test(cmd)) return process.stdout.write(buf)

    // Look for an in-progress slice spec near the cwd
    let dir = process.cwd()
    let specsDir = null
    while (dir !== path.dirname(dir)) {
      const candidate = path.join(dir, '.claude', 'specs')
      if (fs.existsSync(candidate)) {
        specsDir = candidate
        break
      }
      dir = path.dirname(dir)
    }
    if (!specsDir) return process.stdout.write(buf)

    const specs = fs.readdirSync(specsDir)
      .filter(f => f.endsWith('.md') && f !== 'README.md')
      .map(f => path.join(specsDir, f))

    let inProgress = null
    for (const s of specs) {
      const content = fs.readFileSync(s, 'utf8')
      if (/Status:\s*building/.test(content)) {
        inProgress = s
        break
      }
    }

    if (inProgress) {
      process.stderr.write(`\n[compact] Slice "${path.basename(inProgress)}" is marked building — push complete.\n`)
      process.stderr.write(`[compact] If the slice is done: update Status: shipped in the spec, then run /compact.\n`)
      process.stderr.write(`[compact] If more work remains: keep going.\n\n`)
      telemetry.logEvent('compact.suggested', { spec: inProgress, reason: 'git push after slice in progress' })
    } else {
      // Generic suggestion at clean boundary
      process.stderr.write(`[compact] Push complete. Clean boundary — consider /compact before the next task.\n`)
      telemetry.logEvent('compact.suggested', { reason: 'generic push boundary' })
    }
    process.stdout.write(buf)
  } catch {
    process.stdout.write(buf)
  }
})
