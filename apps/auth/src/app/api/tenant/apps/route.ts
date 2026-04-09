import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { AppRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

// GET /api/tenant/apps — apps disponíveis para o tenant atual
export async function GET(): Promise<NextResponse> {
  const hdrs = await headers()
  const tenantId = hdrs.get("x-tenant-id")

  if (!tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  const subscriptions = await AppRepo.getSubscriptionsForTenant(tenantId)

  const data = subscriptions.map((sub) => ({
    appId: sub.appId,
    name: sub.app.name,
    displayName: sub.app.displayName,
    description: sub.app.description,
    baseUrl: sub.app.baseUrl,
    iconUrl: sub.app.iconUrl,
    active: sub.active,
    expiresAt: sub.expiresAt,
  }))

  return NextResponse.json({ ok: true, data })
}
