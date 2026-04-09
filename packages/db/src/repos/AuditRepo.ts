import { eq, and, desc, gte, lte } from "drizzle-orm"
import { db } from "../client.js"
import { auditLogs, type AuditLog } from "../schema/index.js"

export type AuditAction =
  | "tenant.created"
  | "tenant.status_changed"
  | "tenant.blocked"
  | "user.created"
  | "user.invited"
  | "user.activated"
  | "user.deactivated"
  | "user.role_changed"
  | "user.permissions_changed"
  | "session.created"
  | "session.revoked"
  | "session.all_revoked"
  | "webhook.received"
  | "webhook.processed"
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.password_reset_requested"
  | "auth.password_reset_completed"
  | "master.action"

export type AuditTargetType = "user" | "tenant" | "app" | "session" | "webhook"

export type AuditEntry = {
  tenantId?: string
  userId: string
  action: AuditAction
  targetType: AuditTargetType
  targetId: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export type AuditFilters = {
  tenantId?: string
  userId?: string
  action?: AuditAction
  from?: Date
  to?: Date
  limit?: number
  offset?: number
}

export const AuditRepo = {
  async log(entry: AuditEntry): Promise<void> {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? {},
      ipAddress: entry.ipAddress,
    })
  },

  async list(filters: AuditFilters = {}): Promise<AuditLog[]> {
    const conditions = []

    if (filters.tenantId) conditions.push(eq(auditLogs.tenantId, filters.tenantId))
    if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId))
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action))
    if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from))
    if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to))

    return db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filters.limit ?? 100)
      .offset(filters.offset ?? 0)
  },
}
