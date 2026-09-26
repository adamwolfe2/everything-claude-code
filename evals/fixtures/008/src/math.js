// Customers report checkout totals are wrong.
// Bug: discount is applied, then applied again to the already-discounted
// amount (should apply once, to the pre-discount subtotal).
function calcTotal(items, discountPct) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const discounted = subtotal - subtotal * (discountPct / 100)
  const total = discounted - discounted * (discountPct / 100) // BUG: applied twice
  return Math.round(total * 100) / 100
}

module.exports = { calcTotal }
