// Run with: node tests/math.spec.js — currently RED (that's the bug).
const assert = require('node:assert')
const { calcTotal } = require('../src/math')

const items = [{ price: 100, qty: 2 }] // subtotal 200
// 10% off 200 = 180. Discount must apply once.
assert.strictEqual(calcTotal(items, 10), 180, 'discount should apply once to the subtotal')

console.log('math.spec: PASS')
