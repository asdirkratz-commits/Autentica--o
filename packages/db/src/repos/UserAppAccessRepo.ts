import { eq, and, inArray } from "drizzle-orm"
import { db } from "../client"
import { userAppAccess } from "../schema/user-app-access"

export const UserAppAccessRepo = {
  /** Retorna os app_ids liberados para um usuário em um tenant */
  async getUserApps(userId: string, tenantId: string): Promise<string[]> {
    const rows = await db
      .select({ appId: userAppAccess.appId })
      .from(userAppAccess)
      .where(
        and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, tenantId)
        )
      )
    return rows.map((r) => r.appId)
  },

  /** Verifica se um usuário tem acesso a um app específico */
  async hasAccess(userId: string, tenantId: string, appId: string): Promise<boolean> {
    const rows = await db
      .select({ appId: userAppAccess.appId })
      .from(userAppAccess)
      .where(
        and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, tenantId),
          eq(userAppAccess.appId, appId)
        )
      )
      .limit(1)
    return rows.length > 0
  },

  /** Libera um app para o usuário */
  async grantApp(
    userId: string,
    tenantId: string,
    appId: string,
    grantedBy: string
  ): Promise<void> {
    await db
      .insert(userAppAccess)
      .values({ userId, tenantId, appId, grantedBy })
      .onConflictDoNothing()
  },

  /** Revoga acesso a um app */
  async revokeApp(userId: string, tenantId: string, appId: string): Promise<void> {
    await db
      .delete(userAppAccess)
      .where(
        and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, tenantId),
          eq(userAppAccess.appId, appId)
        )
      )
  },

  /**
   * Define exatamente quais apps o usuário pode acessar (substitui a lista atual).
   * Se appIds for vazio, revoga todos.
   */
  async setUserApps(
    userId: string,
    tenantId: string,
    appIds: string[],
    grantedBy: string
  ): Promise<void> {
    await db
      .delete(userAppAccess)
      .where(
        and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, tenantId)
        )
      )

    if (appIds.length === 0) return

    await db.insert(userAppAccess).values(
      appIds.map((appId) => ({ userId, tenantId, appId, grantedBy }))
    )
  },

  /** Remove todos os acessos do usuário no tenant (ao remover o usuário) */
  async revokeAll(userId: string, tenantId: string): Promise<void> {
    await db
      .delete(userAppAccess)
      .where(
        and(
          eq(userAppAccess.userId, userId),
          eq(userAppAccess.tenantId, tenantId)
        )
      )
  },
}
