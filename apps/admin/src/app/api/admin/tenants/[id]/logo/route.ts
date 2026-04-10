import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

// PATCH /api/admin/tenants/[id]/logo — atualizar logo da empresa
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

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  let body: { logoUrl?: string | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const logoUrl = body.logoUrl?.trim() || null

  await TenantRepo.updateLogo(id, logoUrl)

  await AuditRepo.log({
    tenantId: id,
    userId,
    action: "tenant.logo_updated",
    targetType: "tenant",
    targetId: id,
    metadata: { logoUrl },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true })
}
