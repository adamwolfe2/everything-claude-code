const crypto = require('node:crypto')

// Verifies an HMAC-SHA256 signature, e.g. a payment provider's webhook header.
function verifySignature(payload, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const sigBuf = Buffer.from(signature || '')
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(expBuf, sigBuf)
}

module.exports = { verifySignature }
