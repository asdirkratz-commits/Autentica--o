import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, CertRepo, AuditRepo, storage } from "@repo/db"
import {
  err,
  ErrorCode,
  enforceSameOrigin,
  cofreEncryptString,
  cofreEncryptBuffer,
} from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"

type Params = { params: Promise<{ id: string }> }

const BUCKET = "hub-documentos"

// GET /api/admin/tenants/[id]/certificados — lista metadados (sem dados sensíveis)
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response

  const { id } = await params
  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error, { status: 404 })
  }

  const certs = await CertRepo.listByEmpresa(id)
  return NextResponse.json(certs)
}

// POST /api/admin/tenants/[id]/certificados — upload de certificado e-CNPJ (multipart)
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response
  const userId = guard.userId

  const cofreKey = process.env.COFRE_SECRET_KEY
  if (!cofreKey || !/^[0-9a-fA-F]{64}$/.test(cofreKey)) {
    console.error("COFRE_SECRET_KEY ausente ou inválida (deve ter 64 chars hex / 256 bits)")
    return NextResponse.json(
      err(ErrorCode.INTERNAL_ERROR, "Configuração do servidor incompleta", 500).error,
      { status: 500 },
    )
  }

  const { id } = await params
  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error, { status: 404 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error, { status: 400 })
  }

  const arquivo = form.get("arquivo")
  const senha = form.get("senha")
  if (!(arquivo instanceof File) || typeof senha !== "string" || !senha) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Campos obrigatórios: arquivo, senha.", 400).error,
      { status: 400 },
    )
  }

  const cnpj = ((form.get("cnpj") as string | null) ?? "").replace(/\D/g, "")
  const emitidoPara = ((form.get("emitido_para") as string | null) ?? "").trim()
  const dataValidade = (form.get("data_validade") as string | null) ?? ""
  const tipo = ((form.get("tipo_certificado") as string | null) ?? "A1") as "A1" | "A3"
  const dataEmissao = (form.get("data_emissao") as string | null) || null
  const observacoes = (form.get("observacoes") as string | null) || null

  if (!cnpj || !emitidoPara || !dataValidade) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Campos obrigatórios: cnpj, emitido_para, data_validade.", 400).error,
      { status: 400 },
    )
  }
  if (!["A1", "A3"].includes(tipo)) {
    return NextResponse.json(err(ErrorCode.VALIDATION_ERROR, "tipo_certificado inválido.", 400).error, { status: 400 })
  }
  const ext = arquivo.name.split(".").pop()?.toLowerCase()
  if (!["pfx", "p12"].includes(ext ?? "")) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Apenas arquivos .pfx ou .p12 são aceitos.", 400).error,
      { status: 400 },
    )
  }
  // Um e-CNPJ .pfx tem alguns KB; 64KB é folgado. Evita bufferizar arquivo gigante na memória.
  const MAX_PFX_BYTES = 64 * 1024
  if (arquivo.size > MAX_PFX_BYTES) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Arquivo muito grande para um certificado (.pfx/.p12).", 400).error,
      { status: 400 },
    )
  }

  try {
    // 1. Criptografa arquivo + senha no formato do KontoHub (cofre AES-256-GCM)
    const fileBytes = new Uint8Array(await arquivo.arrayBuffer())
    const { cifrado: fileCifrado, ivBase64 } = await cofreEncryptBuffer(fileBytes, cofreKey)
    const { cifrado: senhaCifrada, iv: senhaIv } = await cofreEncryptString(senha, cofreKey)

    // 2. Upload do arquivo cifrado no bucket compartilhado (mesmo path pattern do KontoHub)
    const nomeSeguro = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${id}/ecac/${crypto.randomUUID()}_${nomeSeguro}.enc`
    await storage.upload(BUCKET, storagePath, fileCifrado, "application/octet-stream")

    // 3. Persiste metadados (rollback do arquivo se o insert falhar)
    let cert
    try {
      cert = await CertRepo.create({
        empresaId: id,
        cnpj,
        nomeArquivo: arquivo.name,
        emitidoPara,
        tipoCertificado: tipo,
        dataValidade: new Date(dataValidade).toISOString(),
        dataEmissao: dataEmissao ? new Date(dataEmissao).toISOString() : null,
        observacoes,
        storagePath,
        ivBase64,
        senhaCifrada,
        senhaIv,
      })
    } catch (e) {
      await storage.remove(BUCKET, storagePath).catch(() => {})
      throw e
    }

    await AuditRepo.log({
      userId,
      tenantId: id,
      action: "tenant.certificate_uploaded",
      targetType: "tenant",
      targetId: id,
      metadata: { cnpj, emitidoPara, tipo, dataValidade },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    })

    return NextResponse.json(cert, { status: 201 })
  } catch (e) {
    console.error("[admin/tenants/certificados POST]", e)
    return NextResponse.json(err(ErrorCode.INTERNAL_ERROR, "Erro interno.", 500).error, { status: 500 })
  }
}
