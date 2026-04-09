import { eq, and, isNull, lt } from "drizzle-orm"
import { db } from "../client.js"
import { refreshTokens, type RefreshToken, type NewRefreshToken } from "../schema/index.js"

export type CreateRefreshTokenDTO = {
  userId: string
  tenantId: string
  tokenHash: string
  expiresAt: Date
  userAgent?: string
  ipAddress?: string
}

export const RefreshTokenRepo = {
  async create(data: CreateRefreshTokenDTO): Promise<RefreshToken> {
    const rows = await db
      .insert(refreshTokens)
      .values({
        userId: data.userId,
        tenantId: data.tenantId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create refresh token")
    return row
  },

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  },

  async revoke(tokenHash: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash))
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt)
        )
      )
  },

  async revokeAllForTenant(tenantId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tenantId, tenantId),
          isNull(refreshTokens.revokedAt)
        )
      )
  },

  async deleteExpired(): Promise<number> {
    const result = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id })
    return result.length
  },
}
