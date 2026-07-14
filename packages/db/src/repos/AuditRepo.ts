/**
 * AuditRepo — Supabase (public.audit_logs)
 * Migrado do Neon na P3. user_id agora é GoTrue UUID (nullable).
 */
import { supabase } from "../supabase-client"

export type AuditAction =
  | "tenant.created"
  | "tenant.status_changed"
  | "tenant.info_updated"
  | "tenant.blocked"
  | "tenant.logo_updated"
  | "tenant.theme_updated"
  | "tenant.ai_config_updated"
  | "tenant.certificate_uploaded"
  | "tenant.certificate_removed"
  | "user.created"
  | "user.invited"
  | "user.activated"
  | "user.deactivated"
  | "user.role_changed"
  | "user.permissions_changed"
  | "user.modulos_changed"
  | "user.password_reset"
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
  | "auth.password_changed"
  | "master.action"

export type AuditTargetType = "user" | "tenant" | "app" | "session" | "webhook"

export type AuditEntry = {
  tenantId?: string
  userId?: string
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

type AuditLogRow = {
  id: number
  tenant_id: string | null
  user_id: string | null
  action: string
  target_type: string
  target_id: string
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export type AuditLog = {
  id: number
  tenantId: string | null
  userId: string | null
  action: string
  targetType: string
  targetId: string
  metadata: Record<string, unknown>
  ipAddress: string | null
  createdAt: Date
}

function fromRow(r: AuditLogRow): AuditLog {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    metadata: r.metadata,
    ipAddress: r.ip_address,
    createdAt: new Date(r.created_at),
  }
}

export const AuditRepo = {
  async log(entry: AuditEntry): Promise<void> {
    await supabase.from<AuditLogRow>("audit_logs").insert({
      tenant_id: entry.tenantId ?? null,
      user_id: entry.userId ?? null,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      metadata: entry.metadata ?? {},
      ip_address: entry.ipAddress ?? null,
    })
  },

  async list(filters: AuditFilters = {}): Promise<AuditLog[]> {
    const parts: string[] = []
    if (filters.tenantId) parts.push(`tenant_id=eq.${filters.tenantId}`)
    if (filters.userId)   parts.push(`user_id=eq.${filters.userId}`)
    if (filters.action)   parts.push(`action=eq.${encodeURIComponent(filters.action)}`)
    if (filters.from)     parts.push(`created_at=gte.${filters.from.toISOString()}`)
    if (filters.to)       parts.push(`created_at=lte.${filters.to.toISOString()}`)
    parts.push(`order=created_at.desc`)
    parts.push(`limit=${filters.limit ?? 100}`)
    if (filters.offset) parts.push(`offset=${filters.offset}`)
    const rows = await supabase.from<AuditLogRow>("audit_logs").select(parts.join("&"))
    return rows.map(fromRow)
  },
}
