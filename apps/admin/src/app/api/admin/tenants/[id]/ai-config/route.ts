import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AiConfigRepo, AuditRepo, type TenantAiProvider } from "@repo/db"
import { err, ErrorCode, enforceSameOrigin, cofreEncryptString } from "@repo/auth-shared"
import { requireMasterGlobalApi } from "@/lib/api-guard"

type Params = { params: Promise<{ id: string }> }

const PROVIDERS: TenantAiProvider[] = ["openai", "gemini", "claude"]

// GET /api/admin/tenants/[id]/ai-config — provider + se há chave (sem expor a chave)
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const guard = await requireMasterGlobalApi()
  if (!guard.ok) return guard.response

  const { id } = await params
  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error, { status: 404 })
  }

  const config = await AiConfigRepo.get(id)
  return NextResponse.json(config)
}

// PATCH /api/admin/tenants/[id]/ai-config — grava provider + chave cifrada (cofre).
// Escreve na MESMA tabela tenant_ai_config que o KontoHub lê no runtime.
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
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

  let body: { provider?: string; apiKey?: string | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json(err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error, { status: 400 })
  }

  const provider = body.provider as TenantAiProvider | undefined
  if (!provider || !PROVIDERS.includes(provider)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, `provider deve ser um de: ${PROVIDERS.join(", ")}`, 400).error,
      { status: 400 },
    )
  }
  if (body.apiKey != null && (typeof body.apiKey !== "string" || body.apiKey.length > 512)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "apiKey inválida.", 400).error,
      { status: 400 },
    )
  }

  try {
    const newKey = body.apiKey?.trim()
    if (newKey) {
      const { cifrado, iv } = await cofreEncryptString(newKey, cofreKey)
      await AiConfigRepo.upsert(id, { provider, iaChave: cifrado, iaChaveIv: iv })
    } else {
      // Só troca o provider; mantém a chave atual.
      await AiConfigRepo.upsert(id, { provider })
    }

    await AuditRepo.log({
      userId,
      tenantId: id,
      action: "tenant.ai_config_updated",
      targetType: "tenant",
      targetId: id,
      metadata: { provider, keyChanged: !!newKey },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    })

    const config = await AiConfigRepo.get(id)
    return NextResponse.json({ ok: true, ...config })
  } catch (e) {
    console.error("[admin/tenants/ai-config PATCH]", e)
    return NextResponse.json(err(ErrorCode.INTERNAL_ERROR, "Erro ao salvar configuração de IA.", 500).error, { status: 500 })
  }
}
