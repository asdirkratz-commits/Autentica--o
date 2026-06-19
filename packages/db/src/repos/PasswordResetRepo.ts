/**
 * PasswordResetRepo — Supabase (public.password_reset_tokens)
 * Migrado do Neon na R3. user_id armazena GoTrue UUID (auth.users.id).
 */
import { supabase } from "../supabase-client"

type PasswordResetTokenRow = {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export type PasswordResetToken = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export type CreatePasswordResetDTO = {
  userId: string
  tokenHash: string
  expiresAt: Date
}

function fromRow(r: PasswordResetTokenRow): PasswordResetToken {
  return {
    id: r.id,
    userId: r.user_id,
    tokenHash: r.token_hash,
    expiresAt: new Date(r.expires_at),
    usedAt: r.used_at ? new Date(r.used_at) : null,
    createdAt: new Date(r.created_at),
  }
}

export const PasswordResetRepo = {
  async create(data: CreatePasswordResetDTO): Promise<PasswordResetToken> {
    const rows = await supabase
      .from<PasswordResetTokenRow>("password_reset_tokens")
      .insert({
        user_id: data.userId,
        token_hash: data.tokenHash,
        expires_at: data.expiresAt.toISOString(),
      })
    const row = rows[0]
    if (!row) throw new Error("Failed to create password reset token")
    return fromRow(row)
  },

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const rows = await supabase
      .from<PasswordResetTokenRow>("password_reset_tokens")
      .select(
        `token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null&limit=1`,
      )
    return rows[0] ? fromRow(rows[0]) : null
  },

  async markUsed(id: string): Promise<void> {
    await supabase
      .from<PasswordResetTokenRow>("password_reset_tokens")
      .update(
        `id=eq.${encodeURIComponent(id)}`,
        { used_at: new Date().toISOString() } as Partial<PasswordResetTokenRow>,
      )
  },
}
