import { NextRequest, NextResponse } from "next/server"
import { TenantRepo, AuditRepo } from "@repo/db"
import {
  err, ErrorCode,
  encryptApiKey, serializeAiConfig, deserializeAiConfig, toPublicAiConfig,
  type AiProvider, type AiConfig,
} from "@repo/auth-shared"

type Params = { params: Promise<{ id: string }> }

type Body = {
  activeProvider?: AiProvider
  providers?: Partial<Record<AiProvider, { apiKey?: string; enabled?: boolean }>>
}

const VALID_PROVIDERS: AiProvider[] = ["openai", "gemini", "claude"]

// PATCH /api/admin/tenants/[id]/ai-config — salva configuração de IA (criptografada)
export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const userId = request.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json(
      err(ErrorCode.UNAUTHORIZED, "Não autenticado", 401).error,
      { status: 401 }
    )
  }

  const encKey = process.env.AI_ENCRYPTION_KEY
  if (!encKey || encKey.length !== 64) {
    console.error("AI_ENCRYPTION_KEY ausente ou inválida (deve ter 64 chars hex / 256 bits)")
    return NextResponse.json(
      err(ErrorCode.INTERNAL_ERROR, "Configuração do servidor incompleta", 500).error,
      { status: 500 }
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

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Body inválido", 400).error,
      { status: 400 }
    )
  }

  const { activeProvider, providers } = body

  if (activeProvider && !VALID_PROVIDERS.includes(activeProvider)) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, `activeProvider deve ser um de: ${VALID_PROVIDERS.join(", ")}`, 400).error,
      { status: 400 }
    )
  }

  // Carregar config existente (para não sobrescrever chaves não alteradas)
  let existingConfig: AiConfig | null = null
  if (tenant.aiConfig) {
    existingConfig = await deserializeAiConfig(tenant.aiConfig, encKey)
  }

  const mergedProviders: AiConfig["providers"] = { ...(existingConfig?.providers ?? {}) }

  // Mesclar atualizações — criptografar apenas as chaves novas/alteradas
  for (const [provider, update] of Object.entries(providers ?? {}) as [AiProvider, { apiKey?: string; enabled?: boolean }][]) {
    if (!VALID_PROVIDERS.includes(provider)) continue
    if (!update) continue

    const existing = mergedProviders[provider]
    const newEntry = {
      keyEncrypted: existing?.keyEncrypted ?? "",
      enabled: update.enabled ?? existing?.enabled ?? false,
    }

    // Criptografar apenas se foi fornecida uma nova chave
    if (update.apiKey?.trim()) {
      newEntry.keyEncrypted = await encryptApiKey(update.apiKey.trim(), encKey)
      newEntry.enabled = update.enabled ?? true
    }

    // Só salva se tem chave ou se está atualizando o status de enable
    if (newEntry.keyEncrypted || update.enabled !== undefined) {
      mergedProviders[provider] = newEntry
    }
  }

  // Validar que ao menos um provider está habilitado com chave
  const hasAtLeastOne = Object.values(mergedProviders).some(
    (p) => p && p.enabled && p.keyEncrypted
  )
  if (!hasAtLeastOne) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, "Pelo menos um provider de IA deve estar habilitado com chave configurada", 400).error,
      { status: 400 }
    )
  }

  const resolvedProvider = activeProvider ?? existingConfig?.activeProvider ?? "openai"

  // Validar que o activeProvider tem chave configurada
  const activeEntry = mergedProviders[resolvedProvider]
  if (!activeEntry?.keyEncrypted) {
    return NextResponse.json(
      err(ErrorCode.VALIDATION_ERROR, `O provider ativo (${resolvedProvider}) não possui chave configurada`, 400).error,
      { status: 400 }
    )
  }

  const newConfig: AiConfig = {
    activeProvider: resolvedProvider,
    providers: mergedProviders,
  }

  const serialized = await serializeAiConfig(newConfig, encKey)
  await TenantRepo.updateAiConfig(id, serialized)

  await AuditRepo.log({
    userId,
    action: "tenant.ai_config_updated",
    targetType: "tenant",
    targetId: id,
    // Log intencionalmente sem as chaves
    metadata: {
      activeProvider: resolvedProvider,
      providersConfigured: Object.keys(mergedProviders),
    },
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
  })

  return NextResponse.json({ ok: true, config: toPublicAiConfig(newConfig) })
}

// GET /api/admin/tenants/[id]/ai-config — retorna config pública (sem chaves)
export async function GET(_request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params

  const tenant = await TenantRepo.findById(id)
  if (!tenant) {
    return NextResponse.json(
      err(ErrorCode.NOT_FOUND, "Empresa não encontrada", 404).error,
      { status: 404 }
    )
  }

  if (!tenant.aiConfig) {
    return NextResponse.json({ config: null })
  }

  const encKey = process.env.AI_ENCRYPTION_KEY
  if (!encKey) return NextResponse.json({ config: null })

  const config = await deserializeAiConfig(tenant.aiConfig, encKey)
  if (!config) return NextResponse.json({ config: null })

  return NextResponse.json({ config: toPublicAiConfig(config) })
}
