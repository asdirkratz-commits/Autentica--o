import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, parseTenantTheme } from "@repo/auth-shared"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/tenants/[id]/theme
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
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

  let body: { primary?: string; secondary?: string; accent?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  // parseTenantTheme valida e sanitiza cada cor — valores inválidos recebem o padrão
  const theme = parseTenantTheme(body)

  await TenantRepo.updateTheme(id, JSON.stringify(theme))

  await AuditRepo.log({
    userId,
    action: "tenant.theme_updated",
    targetType: "tenant",
    targetId: id,
    metadata: { theme },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true, theme })
}
