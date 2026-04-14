import { eq, and, isNull } from "drizzle-orm"
import { db } from "../client"
import { inviteTokens, type InviteToken } from "../schema/index"
import type { UserPermissions } from "../schema/user-tenants"

type Role = "admin" | "user"

export type CreateInviteTokenDTO = {
  email: string
  tenantId: string
  role: Role
  permissions: UserPermissions
  invitedBy: string
  tokenHash: string
  expiresAt: Date
}

export const InviteTokenRepo = {
  async create(data: CreateInviteTokenDTO): Promise<InviteToken> {
    const rows = await db
      .insert(inviteTokens)
      .values({
        email: data.email,
        tenantId: data.tenantId,
        role: data.role,
        permissions: data.permissions,
        invitedBy: data.invitedBy,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create invite token")
    return row
  },

  async findByHash(tokenHash: string): Promise<InviteToken | null> {
    const rows = await db
      .select()
      .from(inviteTokens)
      .where(
        and(
          eq(inviteTokens.tokenHash, tokenHash),
          isNull(inviteTokens.usedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  },

  async markUsed(id: string): Promise<void> {
    await db
      .update(inviteTokens)
      .set({ usedAt: new Date() })
      .where(eq(inviteTokens.id, id))
  },
}
