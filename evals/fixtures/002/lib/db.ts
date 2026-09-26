// Minimal fake db client — stands in for a real Postgres/Drizzle client so
// this fixture stays dependency-free. Same shape (tenant-scoped finders,
// idempotency table) a real service layer would expose.

export type Order = {
  id: string
  tenantId: string
  userId: string
  amount: number
  status: 'paid' | 'refunded' | 'partially_refunded'
}

const orders = new Map<string, Order>([
  ['ord_1', { id: 'ord_1', tenantId: 'tenant_a', userId: 'user_1', amount: 4200, status: 'paid' }],
  ['ord_2', { id: 'ord_2', tenantId: 'tenant_b', userId: 'user_2', amount: 9900, status: 'paid' }],
])

const idempotencyKeys = new Set<string>()

export const db = {
  orders: {
    async findById(tenantId: string, orderId: string): Promise<Order | null> {
      const order = orders.get(orderId)
      if (!order || order.tenantId !== tenantId) return null
      return order
    },
  },
  idempotency: {
    async has(key: string) {
      return idempotencyKeys.has(key)
    },
    async record(key: string) {
      idempotencyKeys.add(key)
    },
  },
}
