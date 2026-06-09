import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode, parseTenantTheme } from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/tenants/[id]/theme
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response
  const userId = guard.userId

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
