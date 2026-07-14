import { NextRequest, NextResponse } from "next/server"
import { UserRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireActiveTenantMember, assertActorCanManageTarget } from "@/lib/api-guard"
import { MODULO_IDS } from "@/lib/modulos"

// PATCH /api/tenant/users/[id]/modulos — libera módulos de um colaborador do tenant
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

  let body: { modulos?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 },
    )
  }
  if (!Array.isArray(body.modulos)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "modulos deve ser uma lista", 400).error,
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

  // Status GLOBAL do alvo (não confiar só no papel de membership do tenant).
  const targetUser = await UserRepo.findByGoTrueId(targetUserId)
  const denied = assertActorCanManageTarget(
    { role: actorRole, isMasterGlobal },
    { role: target.role, isMasterGlobal: targetUser?.isMasterGlobal ?? false },
  )
  if (denied) return denied

  // Aceita apenas ids do catálogo, sem duplicatas. Ignora '*' (acesso total não
  // se concede por clique).
  const modulos = [...new Set(
    (body.modulos as unknown[]).filter(
      (m): m is string => typeof m === "string" && MODULO_IDS.includes(m),
    ),
  )]

  await UserRepo.updateUserModulos(targetUserId, tenantId, modulos)

  await AuditRepo.log({
    tenantId,
    userId: actorId,
    action: "user.modulos_changed",
    targetType: "user",
    targetId: targetUserId,
    metadata: { modulos },
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true, modulos })
}
