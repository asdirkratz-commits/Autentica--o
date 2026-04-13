import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import { err, ErrorCode } from "@repo/auth-shared"

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/tenants/[id]/logo — upload de arquivo de logo
 * Aceita multipart/form-data com campo "file" (imagem) ou JSON com "logoUrl".
 *
 * Estratégia de armazenamento:
 *   - Se BLOB_READ_WRITE_TOKEN estiver configurado → Vercel Blob
 *   - Caso contrário → salva como Data URL (base64) — apenas para desenvolvimento
 *
 * Em produção configure: BLOB_READ_WRITE_TOKEN (Vercel Blob)
 * ou substitua pelo seu provider de object storage (S3, R2, etc.)
 */
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
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

  let logoUrl: string

  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    // ── Upload de arquivo ────────────────────────────────────────────────────
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "FormData inválido", 400).error,
        { status: 400 }
      )
    }

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "Campo 'file' ausente ou inválido", 400).error,
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, `Tipo de arquivo não permitido. Use: ${ALLOWED_TYPES.join(", ")}`, 400).error,
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "Arquivo muito grande. Tamanho máximo: 2 MB", 400).error,
        { status: 400 }
      )
    }

    // Tentar Vercel Blob se disponível
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (blobToken) {
      try {
        const { put } = await import("@vercel/blob")
        const filename = `logos/${id}-${Date.now()}.${file.name.split(".").pop() ?? "png"}`
        const blob = await put(filename, file, {
          access: "public",
          token: blobToken,
        })
        logoUrl = blob.url
      } catch (e) {
        console.error("Vercel Blob upload failed:", e)
        return NextResponse.json(
          err(ErrorCode.INTERNAL_ERROR, "Falha no upload da imagem", 500).error,
          { status: 500 }
        )
      }
    } else {
      // Desenvolvimento: salvar como Data URL (base64) — NÃO usar em produção
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      logoUrl = `data:${file.type};base64,${base64}`
    }
  } else {
    // ── URL manual (manter compatibilidade) ──────────────────────────────────
    let body: { logoUrl?: string | null }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json(
        err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
        { status: 400 }
      )
    }
    logoUrl = body.logoUrl?.trim() ?? ""
  }

  await TenantRepo.updateLogo(id, logoUrl || null)

  await AuditRepo.log({
    tenantId: id,
    userId,
    action: "tenant.logo_updated",
    targetType: "tenant",
    targetId: id,
    metadata: { hasLogo: Boolean(logoUrl) },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true, logoUrl: logoUrl || null })
}

// PATCH mantido para compatibilidade (URL manual)
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
