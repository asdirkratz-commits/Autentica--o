import { AppRepo, UserAppAccessRepo } from "@repo/db"
import { cache } from "@/lib/redis"

export type AccessibleApp = {
  appId: string
  name: string
  displayName: string
  description: string | null
  baseUrl: string
  iconUrl: string | null
  parentAppId: string | null
  active: boolean
  expiresAt: Date | null
}

type Ctx = {
  userId: string
  tenantId: string
  role: string | null
  isMasterGlobal: boolean
}

/**
 * Fonte ÚNICA de gating de apps por tenant — usada pela rota /api/tenant/apps
 * E pelo portal (server). Mantê-las idênticas evita divergência que vazaria um
 * app não-contratado numa superfície enquanto a outra esconde.
 *
 * Regras:
 *  - só apps com assinatura ATIVA no tenant (getSubscriptionsForTenant já filtra);
 *  - admin e master_global veem todos os apps assinados do tenant;
 *  - role "user" vê apenas a interseção com user_app_access (liberação individual).
 */
export async function getAccessibleApps(ctx: Ctx): Promise<AccessibleApp[]> {
  const { userId, tenantId, role, isMasterGlobal } = ctx

  const subscriptions = await AppRepo.getSubscriptionsForTenant(tenantId)
  const toApp = (sub: (typeof subscriptions)[number]): AccessibleApp => ({
    appId: sub.appId,
    name: sub.app.name,
    displayName: sub.app.displayName,
    description: sub.app.description,
    baseUrl: sub.app.baseUrl,
    iconUrl: sub.app.iconUrl,
    parentAppId: sub.app.parentAppId,
    active: sub.active,
    expiresAt: sub.expiresAt,
  })

  if (role === "admin" || isMasterGlobal) {
    return subscriptions.map(toApp)
  }

  // role "user": interseção com os apps liberados individualmente
  let userAppIds = await cache.getUserApps(userId, tenantId)
  if (!userAppIds) {
    userAppIds = await UserAppAccessRepo.getUserApps(userId, tenantId)
    await cache.setUserApps(userId, tenantId, userAppIds)
  }
  const allowed = new Set(userAppIds)
  return subscriptions.filter((s) => allowed.has(s.appId)).map(toApp)
}
