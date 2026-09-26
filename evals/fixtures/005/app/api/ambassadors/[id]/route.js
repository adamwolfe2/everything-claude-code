const { read, write } = require('../../../../lib/db')

// PATCH /api/ambassadors/:id — quick-add route from an earlier sprint.
// BUG (the thing this fixture is testing whether you notice): this mutates
// status directly instead of calling lib/ambassadors/service.setStatus, so
// it never records statusHistory. Two write paths for the same field —
// anyone changing status through this route silently skips the audit trail
// that lib/ambassadors/service.js guarantees.
async function PATCH(req, { params }) {
  const body = await req.json()
  const data = read()
  const amb = data.ambassadors[params.id]
  if (!amb) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
  if (body.status) amb.status = body.status
  write(data)
  return new Response(JSON.stringify(amb), { status: 200 })
}

module.exports = { PATCH }
