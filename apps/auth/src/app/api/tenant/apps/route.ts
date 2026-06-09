import { NextResponse } from "next/server"
import { AppRepo, UserAppAccessRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { requireActiveTenantMember } from "@/lib/api-guard"
import { cache } from "@/lib/redis"

// GET /api/tenant/apps — apps disponíveis para o usuário atual
//
// Regras:
//   admin e master_global → todos os apps com assinatura ativa no tenant
//   user                  → apenas os apps em user_app_access (interseção com assinatura do tenant)
export async function GET(): Promise<NextResponse> {
  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { userId, tenantId, role, isMasterGlobal } = guard.ctx

  // Buscar todos os apps com assinatura ativa no tenant
  const subscriptions = await AppRepo.getSubscriptionsForTenant(tenantId)

  // admin e master_global veem tudo
  if (role === "admin" || isMasterGlobal) {
    const data = subscriptions.map((sub) => ({
      appId: sub.appId,
      name: sub.app.name,
      displayName: sub.app.displayName,
      description: sub.app.description,
      baseUrl: sub.app.baseUrl,
      iconUrl: sub.app.iconUrl,
      parentAppId: sub.app.parentAppId,
      active: sub.active,
      expiresAt: sub.expiresAt,
    }))
    return NextResponse.json({ ok: true, data })
  }

  // role === "user": filtrar pelos apps liberados individualmente
  let userAppIds = await cache.getUserApps(userId, tenantId)

  if (!userAppIds) {
    // Cache miss — buscar do banco e cachear
    userAppIds = await UserAppAccessRepo.getUserApps(userId, tenantId)
    await cache.setUserApps(userId, tenantId, userAppIds)
  }

  const allowedSet = new Set(userAppIds)
  const data = subscriptions
    .filter((sub) => allowedSet.has(sub.appId))
    .map((sub) => ({
      appId: sub.appId,
      name: sub.app.name,
      displayName: sub.app.displayName,
      description: sub.app.description,
      baseUrl: sub.app.baseUrl,
      iconUrl: sub.app.iconUrl,
      parentAppId: sub.app.parentAppId,
      active: sub.active,
      expiresAt: sub.expiresAt,
    }))

  return NextResponse.json({ ok: true, data })
}
