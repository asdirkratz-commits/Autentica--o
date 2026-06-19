/**
 * RefreshTokenRepo — Supabase (public.refresh_tokens)
 * Migrado do Neon na P3. user_id agora é GoTrue UUID (auth.users.id).
 */
import { supabase } from "../supabase-client"

type RefreshTokenRow = {
  id: string
  user_id: string
  tenant_id: string | null
  token_hash: string
  expires_at: string
  revoked_at: string | null
  user_agent: string | null
  ip_address: string | null
  created_at: string
}

export type RefreshToken = {
  id: string
  userId: string
  tenantId: string | null
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  userAgent: string | null
  ipAddress: string | null
  createdAt: Date
}

export type CreateRefreshTokenDTO = {
  userId: string
  tenantId: string | null
  tokenHash: string
  expiresAt: Date
  userAgent?: string
  ipAddress?: string
}

function fromRow(r: RefreshTokenRow): RefreshToken {
  return {
    id: r.id,
    userId: r.user_id,
    tenantId: r.tenant_id,
    tokenHash: r.token_hash,
    expiresAt: new Date(r.expires_at),
    revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
    userAgent: r.user_agent,
    ipAddress: r.ip_address,
    createdAt: new Date(r.created_at),
  }
}

export const RefreshTokenRepo = {
  async create(data: CreateRefreshTokenDTO): Promise<RefreshToken> {
    const rows = await supabase.from<RefreshTokenRow>("refresh_tokens").insert({
      user_id: data.userId,
      tenant_id: data.tenantId ?? null,
      token_hash: data.tokenHash,
      expires_at: data.expiresAt.toISOString(),
      user_agent: data.userAgent ?? null,
      ip_address: data.ipAddress ?? null,
    })
    const row = rows[0]
    if (!row) throw new Error("Failed to create refresh token")
    return fromRow(row)
  },

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const rows = await supabase.from<RefreshTokenRow>("refresh_tokens").select(
      `token_hash=eq.${encodeURIComponent(tokenHash)}&revoked_at=is.null&limit=1`,
    )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async findAnyByHash(tokenHash: string): Promise<RefreshToken | null> {
    const rows = await supabase.from<RefreshTokenRow>("refresh_tokens").select(
      `token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`,
    )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async revoke(tokenHash: string): Promise<void> {
    await supabase.from<RefreshTokenRow>("refresh_tokens").update(
      `token_hash=eq.${encodeURIComponent(tokenHash)}`,
      { revoked_at: new Date().toISOString() } as Partial<RefreshTokenRow>,
    )
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await supabase.from<RefreshTokenRow>("refresh_tokens").update(
      `user_id=eq.${userId}&revoked_at=is.null`,
      { revoked_at: new Date().toISOString() } as Partial<RefreshTokenRow>,
    )
  },

  async revokeAllForUserExcept(userId: string, exceptTokenHash: string): Promise<void> {
    await supabase.from<RefreshTokenRow>("refresh_tokens").update(
      `user_id=eq.${userId}&revoked_at=is.null&token_hash=neq.${encodeURIComponent(exceptTokenHash)}`,
      { revoked_at: new Date().toISOString() } as Partial<RefreshTokenRow>,
    )
  },

  async revokeAllForTenant(tenantId: string): Promise<void> {
    await supabase.from<RefreshTokenRow>("refresh_tokens").update(
      `tenant_id=eq.${tenantId}&revoked_at=is.null`,
      { revoked_at: new Date().toISOString() } as Partial<RefreshTokenRow>,
    )
  },

  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString()
    const rows = await supabase.from<RefreshTokenRow>("refresh_tokens").delete(
      `expires_at=lt.${encodeURIComponent(now)}`,
    )
    return rows.length
  },
}
