// Shared audit-log helper. Every Tier-1 mutation (money, state transitions)
// routes through this so there is one place that guarantees an entry exists —
// never re-implement audit writes inline in a route handler.

export type AuditEntry = {
  actorId: string
  tenantId: string
  action: string
  targetId: string
  meta?: Record<string, unknown>
}

const log: AuditEntry[] = []

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  log.push(entry)
}

export function _readAuditLogForTest(): AuditEntry[] {
  return log
}
