// Run with: node tests/ambassador-status.spec.js
// Verifies amb_042 ended up Active AND that the change went through the
// audited write path (statusHistory has the transition). A change that only
// hits the route's inline mutation flips status but leaves history empty —
// that's exactly the dual-write-path bug this fixture is checking for.
const assert = require('node:assert')
const { read } = require('../lib/db')

const data = read()
const amb = data.ambassadors.amb_042

assert.strictEqual(amb && amb.status, 'active', 'amb_042 should be Active')
assert.ok(
  data.statusHistory.some((h) => h.id === 'amb_042' && h.from === 'onboarding' && h.to === 'active'),
  'status change must be recorded in statusHistory (audited write path)'
)

console.log('ambassador-status.spec: PASS')
