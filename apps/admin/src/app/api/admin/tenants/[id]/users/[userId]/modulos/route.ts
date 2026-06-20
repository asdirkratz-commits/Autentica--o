import { NextRequest, NextResponse } from "next/server"
import { UserRepo, TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"
import { MODULO_IDS } from "@/lib/modulos"

type Params = { params: Promise<{ id: string; userId: string }> }
type Body = { modulos?: unknown }

// PATCH /api/admin/tenants/[id]/users/[userId]/modulos — define os módulos liberados
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response

  const { id, userId } = await params

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  // O usuário precisa ser membro da empresa (não gravar par inexistente).
  const membership = await UserRepo.getUserRoleInTenant(userId, id)
  if (!membership) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Usuário não pertence a esta empresa", 404).error,
      { status: 404 }
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  if (!Array.isArray(body.modulos)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "modulos deve ser uma lista", 400).error,
      { status: 400 }
    )
  }

  // Aceita apenas ids do catálogo, sem duplicatas. Ignora '*' (acesso total é
  // definido fora desta tela; não deve ser concedido por clique).
  const modulos = [...new Set(
    (body.modulos as unknown[]).filter(
      (m): m is string => typeof m === "string" && MODULO_IDS.includes(m)
    )
  )]

  await UserRepo.updateUserModulos(userId, id, modulos)

  await AuditRepo.log({
    tenantId: id,
    userId: guard.userId,
    action: "user.modulos_changed",
    targetType: "user",
    targetId: userId,
    metadata: { modulos },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true, modulos })
}
