import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireActiveTenantMember, assertActorCanManageTarget } from "@/lib/api-guard"

// PATCH /api/tenant/users/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { userId: actorId, tenantId, role: actorRole, isMasterGlobal } = guard.ctx

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

  // Alvo membro deste tenant + hierarquia (master gerencia todos; admin só user;
  // ninguém não-master mexe em master global). Ver assertActorCanManageTarget.
  const targetMembership = await UserRepo.getUserRoleInTenant(targetUserId, tenantId)
  if (!targetMembership) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não encontrado neste tenant", 404).error,
      { status: 404 }
    )
  }

  const targetUser = await UserRepo.findByGoTrueId(targetUserId)
  const denied = assertActorCanManageTarget(
    { role: actorRole, isMasterGlobal },
    { role: targetMembership.role, isMasterGlobal: targetUser?.isMasterGlobal ?? false },
  )
  if (denied) return denied

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
