import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireActiveTenantMember, assertActorCanManageTarget } from "@/lib/api-guard"
import { validatePasswordStrength } from "@/lib/password"
import { updateGoTruePassword } from "@/lib/supabase-user-tenants"

// POST /api/tenant/users/[id]/reset-password — admin/master define nova senha
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireActiveTenantMember()
  if (!guard.ok) return guard.response
  const { userId: actorId, tenantId, role: actorRole, isMasterGlobal } = guard.ctx

  const { id: targetUserId } = await params

  let body: { password?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 },
    )
  }
  if (typeof body.password !== "string") {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "password é obrigatório", 400).error,
      { status: 400 },
    )
  }
  const strength = validatePasswordStrength(body.password)
  if (!strength.valid) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, strength.reason, 400).error,
      { status: 400 },
    )
  }

  // O alvo precisa ser membro DESTE tenant (isolamento — tenantId vem do token).
  const target = await UserRepo.getUserRoleInTenant(targetUserId, tenantId)
  if (!target) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não pertence a esta empresa", 404).error,
      { status: 404 },
    )
  }

  // Status GLOBAL do alvo — impede admin comum de resetar senha de um master
  // global vinculado ao tenant como colaborador (takeover). Ver auditoria #1.
  const targetUser = await UserRepo.findByGoTrueId(targetUserId)
  const denied = assertActorCanManageTarget(
    { role: actorRole, isMasterGlobal },
    { role: target.role, isMasterGlobal: targetUser?.isMasterGlobal ?? false },
  )
  if (denied) return denied

  // targetUserId = GoTrue id (user_tenants.user_id). O GoTrue faz o hash.
  const ok = await updateGoTruePassword(targetUserId, body.password)
  if (!ok) {
    return NextResponse.json(
      err(ErrorCode.INTERNAL_ERROR, "Falha ao atualizar a senha", 500).error,
      { status: 500 },
    )
  }

  // Nunca logar a senha — grava só o fato.
  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: "user.password_reset",
    targetType: "user",
    targetId: targetUserId,
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
