/**
 * InviteTokenRepo — Supabase (public.invite_tokens)
 * Migrado do Neon na R3. invited_by armazena GoTrue UUID (= JWT sub).
 */
import { supabase } from "../supabase-client"
import type { UserPermissions } from "../schema/user-tenants"

type Role = "admin" | "user"

type InviteTokenRow = {
  id: string
  email: string
  tenant_id: string
  role: Role
  permissions: UserPermissions
  invited_by: string
  token_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export type InviteToken = {
  id: string
  email: string
  tenantId: string
  role: Role
  permissions: UserPermissions
  invitedBy: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export type CreateInviteTokenDTO = {
  email: string
  tenantId: string
  role: Role
  permissions: UserPermissions
  invitedBy: string
  tokenHash: string
  expiresAt: Date
}

function fromRow(r: InviteTokenRow): InviteToken {
  return {
    id: r.id,
    email: r.email,
    tenantId: r.tenant_id,
    role: r.role,
    permissions: r.permissions,
    invitedBy: r.invited_by,
    tokenHash: r.token_hash,
    expiresAt: new Date(r.expires_at),
    usedAt: r.used_at ? new Date(r.used_at) : null,
    createdAt: new Date(r.created_at),
  }
}

export const InviteTokenRepo = {
  async create(data: CreateInviteTokenDTO): Promise<InviteToken> {
    const rows = await supabase
      .from<InviteTokenRow>("invite_tokens")
      .insert({
        email: data.email,
        tenant_id: data.tenantId,
        role: data.role,
        permissions: data.permissions,
        invited_by: data.invitedBy,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt.toISOString(),
      })
    const row = rows[0]
    if (!row) throw new Error("Failed to create invite token")
    return fromRow(row)
  },

  async findByHash(tokenHash: string): Promise<InviteToken | null> {
    const rows = await supabase
      .from<InviteTokenRow>("invite_tokens")
      .select(
        `token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null&limit=1`,
      )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async markUsed(id: string): Promise<void> {
    await supabase
      .from<InviteTokenRow>("invite_tokens")
      .update(
        `id=eq.${encodeURIComponent(id)}`,
        { used_at: new Date().toISOString() } as Partial<InviteTokenRow>,
      )
  },
}
