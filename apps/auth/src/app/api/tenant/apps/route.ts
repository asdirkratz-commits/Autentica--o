import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { AppRepo, UserAppAccessRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { cache } from "@/lib/redis"

// GET /api/tenant/apps — apps disponíveis para o usuário atual
//
// Regras:
//   admin e master_global → todos os apps com assinatura ativa no tenant
//   user                  → apenas os apps em user_app_access (interseção com assinatura do tenant)
export async function GET(): Promise<NextResponse> {
  const hdrs = headers()
  const userId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const role = hdrs.get("x-user-role")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"

  if (!userId || !tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

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
