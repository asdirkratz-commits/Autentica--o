import { eq, and } from "drizzle-orm"
import { db } from "../client"
import {
  users,
  userTenants,
  type User,
  type UserTenant,
  type UserPermissions,
} from "../schema/index"

export type TenantMember = {
  userId: string
  role: string
  status: string
  permissions: UserPermissions
  invitedAt: Date
  activatedAt: Date | null
  email: string
  fullName: string
  avatarUrl: string | null
  lastLoginAt: Date | null
}

type Role = "admin" | "user"
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

  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    const rows = await db
      .select({
        userId: userTenants.userId,
        role: userTenants.role,
        status: userTenants.status,
        permissions: userTenants.permissions,
        invitedAt: userTenants.invitedAt,
        activatedAt: userTenants.activatedAt,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        lastLoginAt: users.lastLoginAt,
      })
      .from(userTenants)
      .innerJoin(users, eq(userTenants.userId, users.id))
      .where(eq(userTenants.tenantId, tenantId))
      .orderBy(userTenants.invitedAt)
    return rows.map((r) => ({ ...r, permissions: (r.permissions ?? {}) as UserPermissions }))
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
