import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

// PATCH /api/tenant/users/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const hdrs = await headers()
  const actorId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")
  const actorRole = hdrs.get("x-user-role")

  if (!actorId || !tenantId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  if (actorRole !== "owner" && actorRole !== "admin") {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Acesso negado", 403).error,
      { status: 403 }
    )
  }

  const { id: targetUserId } = await params

  let body: { status?: "active" | "inactive" }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { status } = body

  if (!status || !["active", "inactive"].includes(status)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, 'status deve ser "active" ou "inactive"', 400).error,
      { status: 400 }
    )
  }

  // Verificar hierarquia: não pode alterar usuário com role >= próprio
  const targetMembership = await UserRepo.getUserRoleInTenant(targetUserId, tenantId)
  if (!targetMembership) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado neste tenant", 404).error,
      { status: 404 }
    )
  }

  const ROLE_LEVEL: Record<string, number> = { owner: 2, admin: 1, user: 0 }
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0
  const targetLevel = ROLE_LEVEL[targetMembership.role] ?? 0

  if (actorLevel <= targetLevel) {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Sem permissão para alterar este usuário", 403).error,
      { status: 403 }
    )
  }

  await UserRepo.setUserStatusInTenant(targetUserId, tenantId, status)

  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: status === "active" ? "user.activated" : "user.deactivated",
    targetType: "user",
    targetId: targetUserId,
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
