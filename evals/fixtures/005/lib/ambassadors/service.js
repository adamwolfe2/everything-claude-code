const { read, write } = require('../db')

// The intended single write path for a status change — records history.
// Everything that changes ambassador status should call this.
function setStatus(id, to) {
  const data = read()
  const amb = data.ambassadors[id]
  if (!amb) throw new Error('not found')
  const from = amb.status
  amb.status = to
  data.statusHistory.push({ id, from, to })
  write(data)
  return amb
}

module.exports = { setStatus }
