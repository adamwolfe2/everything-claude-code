import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core'

// ~5M rows in prod. Any ALTER on this table needs the batched-backfill
// approach in .claude/knowledge/decisions/db-migrations-large-tables.md.
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  customerEmail: text('customer_email').notNull(),
  amountCents: integer('amount_cents').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
