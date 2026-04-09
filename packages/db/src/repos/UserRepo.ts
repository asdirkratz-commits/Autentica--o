import { eq, and } from "drizzle-orm"
import { db } from "../client.js"
import {
  users,
  userTenants,
  type User,
  type NewUser,
  type UserTenant,
  type UserPermissions,
} from "../schema/index.js"

type Role = "owner" | "admin" | "user"
type UserStatus = "active" | "inactive" | "pending"

export type CreateUserDTO = {
  email: string
  passwordHash: string
  fullName: string
  isMasterGlobal?: boolean
  avatarUrl?: string
}

export const UserRepo = {
  async findById(id: string): Promise<User | null> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    return rows[0] ?? null
  },

  async findByEmail(email: string): Promise<User | null> {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    return rows[0] ?? null
  },

  async create(data: CreateUserDTO): Promise<User> {
    const rows = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        isMasterGlobal: data.isMasterGlobal ?? false,
        avatarUrl: data.avatarUrl,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create user")
    return row
  },

  async updatePassword(id: string, hash: string): Promise<void> {
    await db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.id, id))
  },

  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id))
  },

  async linkToTenant(
    userId: string,
    tenantId: string,
    role: Role,
    invitedBy?: string
  ): Promise<void> {
    await db
      .insert(userTenants)
      .values({
        userId,
        tenantId,
        role,
        status: "pending",
        invitedBy: invitedBy ?? null,
      })
      .onConflictDoNothing()
  },

  async getUserTenants(userId: string): Promise<UserTenant[]> {
    return db
      .select()
      .from(userTenants)
      .where(eq(userTenants.userId, userId))
  },

  async getUserRoleInTenant(
    userId: string,
    tenantId: string
  ): Promise<UserTenant | null> {
    const rows = await db
      .select()
      .from(userTenants)
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        )
      )
      .limit(1)
    return rows[0] ?? null
  },

  async setUserStatusInTenant(
    userId: string,
    tenantId: string,
    status: UserStatus
  ): Promise<void> {
    const values: Partial<typeof userTenants.$inferInsert> = { status }
    if (status === "active") values.activatedAt = new Date()

    await db
      .update(userTenants)
      .set(values)
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        )
      )
  },

  async updateUserPermissions(
    userId: string,
    tenantId: string,
    permissions: UserPermissions
  ): Promise<void> {
    await db
      .update(userTenants)
      .set({ permissions })
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        )
      )
  },

  async updateRole(
    userId: string,
    tenantId: string,
    role: Role
  ): Promise<void> {
    await db
      .update(userTenants)
      .set({ role })
      .where(
        and(
          eq(userTenants.userId, userId),
          eq(userTenants.tenantId, tenantId)
        )
      )
  },
}
