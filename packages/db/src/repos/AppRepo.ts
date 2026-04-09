import { eq, and } from "drizzle-orm"
import { db } from "../client.js"
import {
  apps,
  appSubscriptions,
  type App,
  type NewApp,
  type AppSubscription,
} from "../schema/index.js"

export type CreateAppDTO = {
  name: string
  displayName: string
  description?: string
  baseUrl: string
  iconUrl?: string
}

export const AppRepo = {
  async findById(id: string): Promise<App | null> {
    const rows = await db
      .select()
      .from(apps)
      .where(eq(apps.id, id))
      .limit(1)
    return rows[0] ?? null
  },

  async findByName(name: string): Promise<App | null> {
    const rows = await db
      .select()
      .from(apps)
      .where(eq(apps.name, name))
      .limit(1)
    return rows[0] ?? null
  },

  async listAll(): Promise<App[]> {
    return db.select().from(apps).orderBy(apps.name)
  },

  async listActive(): Promise<App[]> {
    return db.select().from(apps).where(eq(apps.active, true)).orderBy(apps.name)
  },

  async create(data: CreateAppDTO): Promise<App> {
    const rows = await db
      .insert(apps)
      .values({
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        baseUrl: data.baseUrl,
        iconUrl: data.iconUrl,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error("Failed to create app")
    return row
  },

  async setActive(id: string, active: boolean): Promise<void> {
    await db.update(apps).set({ active }).where(eq(apps.id, id))
  },

  async getSubscriptionsForTenant(tenantId: string): Promise<(AppSubscription & { app: App })[]> {
    const rows = await db
      .select({
        tenantId: appSubscriptions.tenantId,
        appId: appSubscriptions.appId,
        active: appSubscriptions.active,
        expiresAt: appSubscriptions.expiresAt,
        createdAt: appSubscriptions.createdAt,
        app: apps,
      })
      .from(appSubscriptions)
      .innerJoin(apps, eq(appSubscriptions.appId, apps.id))
      .where(
        and(
          eq(appSubscriptions.tenantId, tenantId),
          eq(appSubscriptions.active, true)
        )
      )
    return rows.map((r) => ({
      tenantId: r.tenantId,
      appId: r.appId,
      active: r.active,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      app: r.app,
    }))
  },

  async subscribeToApp(tenantId: string, appId: string, expiresAt?: Date): Promise<void> {
    await db
      .insert(appSubscriptions)
      .values({ tenantId, appId, active: true, expiresAt })
      .onConflictDoUpdate({
        target: [appSubscriptions.tenantId, appSubscriptions.appId],
        set: { active: true, expiresAt },
      })
  },

  async unsubscribeFromApp(tenantId: string, appId: string): Promise<void> {
    await db
      .update(appSubscriptions)
      .set({ active: false })
      .where(
        and(
          eq(appSubscriptions.tenantId, tenantId),
          eq(appSubscriptions.appId, appId)
        )
      )
  },
}
