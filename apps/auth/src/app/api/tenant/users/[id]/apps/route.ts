import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { UserRepo, UserAppAccessRepo, AppRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { cache } from "@/lib/redis"

// GET /api/tenant/users/[id]/apps — lista apps liberados para o usuário
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const hdrs = headers()
  const actorId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const actorRole = hdrs.get("x-user-role")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"

  if (!actorId || !tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  if (actorRole !== "admin" && !isMasterGlobal) {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  const { id: targetUserId } = await params

  const membership = await UserRepo.getUserRoleInTenant(targetUserId, tenantId)
  if (!membership) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado neste tenant", 404).error,
      { status: 404 }
    )
  }

  const appIds = await UserAppAccessRepo.getUserApps(targetUserId, tenantId)
  return NextResponse.json({ ok: true, data: { appIds } })
}

// PUT /api/tenant/users/[id]/apps — define a lista completa de apps do usuário
// Substitui o conjunto atual. Enviar [] revoga todos os acessos.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const hdrs = headers()
  const actorId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const actorRole = hdrs.get("x-user-role")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"

  if (!actorId || !tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  if (actorRole !== "admin" && !isMasterGlobal) {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  const { id: targetUserId } = await params

  let body: { appIds?: string[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { appIds } = body
  if (!Array.isArray(appIds)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "appIds deve ser um array", 400).error,
      { status: 400 }
    )
  }

  // Verificar se o usuário alvo pertence ao tenant
  const membership = await UserRepo.getUserRoleInTenant(targetUserId, tenantId)
  if (!membership) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado neste tenant", 404).error,
      { status: 404 }
    )
  }

  // Admin só pode gerenciar usuários com role "user"
  if (actorRole === "admin" && membership.role !== "user") {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Sem permissão para alterar este usuário", 403).error,
      { status: 403 }
    )
  }

  // Validar que todos os appIds existem
  if (appIds.length > 0) {
    const allApps = await AppRepo.listAll()
    const validIds = new Set(allApps.map((a) => a.id))
    const invalid = appIds.filter((id) => !validIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, `appIds inválidos: ${invalid.join(", ")}`, 400).error,
        { status: 400 }
      )
    }
  }

  await UserAppAccessRepo.setUserApps(targetUserId, tenantId, appIds, actorId)

  // Invalidar cache do usuário
  await cache.invalidateUserApps(targetUserId, tenantId)

  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: "user.permissions_changed",
    targetType: "user",
    targetId: targetUserId,
    metadata: { appIds },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
