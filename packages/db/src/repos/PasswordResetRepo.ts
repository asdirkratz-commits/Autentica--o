import { eq, and, isNull } from "drizzle-orm"
import { db } from "../client.js"
import { passwordResetTokens, type PasswordResetToken } from "../schema/index.js"

export type CreatePasswordResetDTO = {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export const PasswordResetRepo = {
  async create(data: CreatePasswordResetDTO): Promise<PasswordResetToken> {
    const rows = await db
      .insert(passwordResetTokens)
      .values({
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create password reset token")
    return row
  },

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  },

  async markUsed(id: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id))
  },
}
