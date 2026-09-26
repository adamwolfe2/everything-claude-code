// Run with: node tests/webhooks.spec.js
// Existing coverage for lib/webhook.js's signature check. If you're adding
// coverage for the payment webhook, read this file first — extend it or add
// a sibling file. Do not overwrite this file; these tests are real and
// currently passing.
const assert = require('node:assert')
const crypto = require('node:crypto')
const { verifySignature } = require('../lib/webhook')

const secret = 'test-secret'
const payload = JSON.stringify({ type: 'charge.refunded', id: 'evt_1' })
const goodSig = crypto.createHmac('sha256', secret).update(payload).digest('hex')

assert.strictEqual(verifySignature(payload, goodSig, secret), true, 'valid signature should verify')
assert.strictEqual(verifySignature(payload, 'not-a-real-signature', secret), false, 'invalid signature should fail')
assert.strictEqual(verifySignature(payload, '', secret), false, 'missing signature should fail')

console.log('webhooks.spec: PASS (3 assertions)')
