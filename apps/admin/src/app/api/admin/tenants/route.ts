import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

// POST /api/admin/tenants — criar nova empresa (master_global only)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  let body: { name?: string; slug?: string; plan?: string; logoUrl?: string; internalNotes?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { name, slug, plan, logoUrl, internalNotes } = body

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "name e slug são obrigatórios", 400).error,
      { status: 400 }
    )
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "slug deve conter apenas letras minúsculas, números e hífens", 400).error,
      { status: 400 }
    )
  }

  const existing = await TenantRepo.findBySlug(slug)
  if (existing) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Slug já em uso por outra empresa", 409).error,
      { status: 409 }
    )
  }

  const tenant = await TenantRepo.create({ name, slug, plan, logoUrl, internalNotes })

  await AuditRepo.log({
    userId,
    action: "tenant.created",
    targetType: "tenant",
    targetId: tenant.id,
    metadata: { name, slug, plan },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ id: tenant.id, ok: true }, { status: 201 })
}
