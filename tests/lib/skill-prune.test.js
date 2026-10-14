// skill-prune.js plan(): archive only unused, unreferenced, settled skills once 30 days of usage exist;
// restore archived skills loaded from /lib twice.
const assert = require('assert')
const path = require('path')
const { plan } = require(path.join(__dirname, '..', '..', 'scripts', 'skill-prune.js'))

const day = 86400 * 1000
const now = Date.parse('2026-12-01T00:00:00Z')
const old = now - 60 * day
const base = {
  active: [
    { name: 'unused', kind: 'skill', path: 'skills/unused', lastCommitMs: old },
    { name: 'used', kind: 'skill', path: 'skills/used', lastCommitMs: old },
    { name: 'referenced', kind: 'command', path: 'commands/referenced.md', lastCommitMs: old },
    { name: 'brand-new', kind: 'skill', path: 'skills/brand-new', lastCommitMs: now - 2 * day },
  ],
  archived: [
    { name: 'wanted', kind: 'skill', path: 'archive/skills/wanted' },
    { name: 'once', kind: 'skill', path: 'archive/skills/once' },
  ],
  usage: new Map([['used', 3]]),
  loads: new Map([['wanted', 2], ['once', 1]]),
  referenced: new Set(['referenced']),
  trackingSince: now - 45 * day,
  now,
}

let failed = 0
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`) } catch (error) { failed += 1; console.log(`  ✗ ${name}: ${error.message}`) }
}
const result = plan(base)
t('archives only the unused, unreferenced, settled skill', () => assert.deepStrictEqual(result.archive.map(s => s.name), ['unused']))
t('restores a skill loaded from the library twice', () => assert.deepStrictEqual(result.restore.map(s => s.name), ['wanted']))
t('archives nothing before 30 days of tracking, but still restores', () => {
  const early = plan({ ...base, trackingSince: now - 5 * day })
  assert.deepStrictEqual([early.archive.length, early.restore.length], [0, 1])
  assert.match(early.note, /waits for 30 days/)
})
t('archives nothing with no tracking at all', () => assert.strictEqual(plan({ ...base, trackingSince: null }).archive.length, 0))
console.log(`\nPassed: ${4 - failed}\nFailed: ${failed}`)
process.exit(failed ? 1 : 0)
