// Plain node:assert test (no test-runner dependency) — pattern for the new
// refund route's test to follow. Run with: node --loader ts-node/esm this
// file, or treat as a reading reference; the point of this fixture is the
// pattern, not making this exact file executable without deps.

import assert from 'node:assert'
import { POST } from '../app/api/orders/[id]/charge/route'

async function run() {
  const req = new Request('http://localhost/api/orders/ord_1/charge', {
    method: 'POST',
    headers: { 'x-tenant-id': 'tenant_a', 'x-user-id': 'user_1' },
    body: JSON.stringify({ orderId: 'ord_1', amount: 4200, idempotencyKey: 'k1' }),
  })
  const res = await POST(req)
  assert.strictEqual(res.status, 200)

  // Replaying the same idempotency key must not double-charge.
  const dupe = await POST(req)
  assert.strictEqual(dupe.status, 409)

  console.log('orders.charge.spec: PASS')
}

run()
