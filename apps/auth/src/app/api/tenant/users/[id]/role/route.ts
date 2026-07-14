import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireActiveTenantMember, assertActorCanManageTarget } from "@/lib/api-guard"

// PATCH /api/tenant/users/[id]/role — muda o papel de um colaborador do tenant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { userId: actorId, tenantId, role: actorRole, isMasterGlobal } = guard.ctx

  const { id: targetUserId } = await params

  let body: { role?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 },
    )
  }
  const newRole = body.role
  if (newRole !== "admin" && newRole !== "user") {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, 'role deve ser "admin" ou "user"', 400).error,
      { status: 400 },
    )
  }

  // Só master global concede admin (admin do tenant não cria/promove admin).
  if (newRole === "admin" && !isMasterGlobal) {
    return NextResponse.json(
      err(ErrorCode.FORBIDDEN, "Apenas master global define admin", 403).error,
      { status: 403 },
    )
  }

  const target = await UserRepo.getUserRoleInTenant(targetUserId, tenantId)
  if (!target) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não pertence a esta empresa", 404).error,
      { status: 404 },
    )
  }

  // Status GLOBAL do alvo (não confiar só no papel de membership do tenant).
  const targetUser = await UserRepo.findByGoTrueId(targetUserId)
  const denied = assertActorCanManageTarget(
    { role: actorRole, isMasterGlobal },
    { role: target.role, isMasterGlobal: targetUser?.isMasterGlobal ?? false },
  )
  if (denied) return denied

  await UserRepo.updateRole(targetUserId, tenantId, newRole)

  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: "user.role_changed",
    targetType: "user",
    targetId: targetUserId,
    metadata: { role: newRole },
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
