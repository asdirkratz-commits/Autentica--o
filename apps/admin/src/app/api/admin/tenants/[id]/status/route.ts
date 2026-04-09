import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"
import { cache } from "@/lib/redis"
import { revokeAllTenantSessions } from "@/lib/session"

type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"
const VALID_STATUSES: TenantStatus[] = ["ativo", "inativo", "inadimplente", "bloqueado"]

// PATCH /api/admin/tenants/[id]/status — alterar status da empresa
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  const { id } = await params

  let body: { status?: string; notes?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { status, notes } = body

  if (!status || !VALID_STATUSES.includes(status as TenantStatus)) {
    return NextResponse.json(
      err(
        ErrorCode.VALIDATION_ERROR,
        `status deve ser um de: ${VALID_STATUSES.join(", ")}`,
        400
      ).error,
      { status: 400 }
    )
  }

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  const previousStatus = tenant.status
  await TenantRepo.updateStatus(id, status as TenantStatus, notes)

  // Invalidar cache imediatamente
  await cache.invalidateTenantStatus(id)

  // Se bloqueado ou inativo → revogar todas as sessões
  if (status === "bloqueado" || status === "inativo") {
    await revokeAllTenantSessions(id)
  }

  await AuditRepo.log({
    tenantId: id,
    userId,
    action: status === "bloqueado" ? "tenant.blocked" : "tenant.status_changed",
    targetType: "tenant",
    targetId: id,
    metadata: { previousStatus, newStatus: status, notes },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
