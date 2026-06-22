import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, CertRepo, AuditRepo, storage } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin } from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"

type Params = { params: Promise<{ id: string; certId: string }> }

const BUCKET = "hub-documentos"

// DELETE /api/admin/tenants/[id]/certificados/[certId] — remove certificado + arquivo cifrado
export async function DELETE(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response
  const userId = guard.userId

  const { id, certId } = await params
  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error, { status: 404 })
  }

  try {
    const storagePath = await CertRepo.removeById(certId, id)
    if (storagePath) {
      // Apaga o arquivo cifrado; se falhar, o registro já saiu — loga e segue.
      await storage.remove(BUCKET, storagePath).catch((e) => {
        console.error("[admin/tenants/certificados DELETE] falha ao remover arquivo do storage", e)
      })
    }

    await AuditRepo.log({
      userId,
      tenantId: id,
      action: "tenant.certificate_removed",
      targetType: "tenant",
      targetId: id,
      metadata: { certId },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[admin/tenants/certificados DELETE]", e)
    return NextResponse.json(err(ErrorCode.INTERNAL_ERROR, "Erro interno.", 500).error, { status: 500 })
  }
}
