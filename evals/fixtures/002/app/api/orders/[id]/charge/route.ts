// Existing Tier-1 endpoint — the pattern to reuse for the new refund route:
// tenant isolation, idempotency key, server-side amount validation, audit log.
// Do not copy-paste this file for the refund route; extract what's shared
// into lib/services if the refund route needs the same checks.

import { db } from '../../../../../lib/db'
import { writeAuditLog } from '../../../../../lib/audit'

type ChargeBody = { orderId: string; amount: number; idempotencyKey: string }

export async function POST(req: Request) {
  const tenantId = req.headers.get('x-tenant-id')
  const actorId = req.headers.get('x-user-id')
  if (!tenantId || !actorId) {
    return new Response(JSON.stringify({ error: 'missing tenant/actor' }), { status: 401 })
  }

  const body = (await req.json()) as ChargeBody
  if (!body.idempotencyKey) {
    return new Response(JSON.stringify({ error: 'idempotencyKey required' }), { status: 400 })
  }
  if (await db.idempotency.has(body.idempotencyKey)) {
    return new Response(JSON.stringify({ error: 'duplicate request' }), { status: 409 })
  }

  const order = await db.orders.findById(tenantId, body.orderId)
  if (!order) {
    return new Response(JSON.stringify({ error: 'order not found' }), { status: 404 })
  }

  // Never trust a client-supplied amount — re-derive/validate server-side.
  if (typeof body.amount !== 'number' || body.amount <= 0 || body.amount > order.amount) {
    return new Response(JSON.stringify({ error: 'invalid amount' }), { status: 400 })
  }

  await db.idempotency.record(body.idempotencyKey)
  await writeAuditLog({
    actorId,
    tenantId,
    action: 'order.charge',
    targetId: order.id,
    meta: { amount: body.amount },
  })

  return new Response(JSON.stringify({ ok: true, orderId: order.id }), { status: 200 })
}
