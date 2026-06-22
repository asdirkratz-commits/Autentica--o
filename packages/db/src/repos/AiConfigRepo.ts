/**
 * AiConfigRepo — configuração de IA por empresa (tabela tenant_ai_config no Supabase).
 *
 * É a MESMA tabela que o KontoHub usa para chamar a IA. O admin grava aqui o
 * provider + a chave cifrada (cofre AES-256-GCM, COFRE_SECRET_KEY) e o KontoHub
 * lê/descriptografa no runtime. A chave NUNCA é devolvida ao frontend.
 *
 * O admin acessa via service_role (bypassa a RLS por empresa da tabela), então
 * pode ler/gravar a config de qualquer tenant — coerente com o painel Master.
 */
import { supabase } from "../supabase-client"

export type TenantAiProvider = "openai" | "gemini" | "claude"

export type AiConfigPublic = { provider: TenantAiProvider | null; hasKey: boolean }

type AiRow = {
  tenant_id: string
  ia_provider: TenantAiProvider | null
  ia_chave: string | null
  ia_chave_iv: string | null
  updated_at: string
}

function enc(v: string): string {
  return encodeURIComponent(v)
}

export const AiConfigRepo = {
  /** Provider + se há chave configurada (sem expor a chave). */
  async get(tenantId: string): Promise<AiConfigPublic> {
    const rows = await supabase
      .from<AiRow>("tenant_ai_config")
      .select(`select=ia_provider,ia_chave&tenant_id=eq.${enc(tenantId)}&limit=1`)
    const row = rows[0]
    return { provider: row?.ia_provider ?? null, hasKey: !!row?.ia_chave }
  },

  /**
   * Upsert do provider + (opcionalmente) a chave já cifrada.
   * - iaChave === undefined → mantém a chave atual (só troca o provider).
   * - iaChave === null      → remove a chave.
   */
  async upsert(
    tenantId: string,
    data: { provider: TenantAiProvider; iaChave?: string | null; iaChaveIv?: string | null },
  ): Promise<void> {
    const patch: Partial<AiRow> = {
      ia_provider: data.provider,
      updated_at: new Date().toISOString(),
    }
    if (data.iaChave !== undefined) {
      patch.ia_chave = data.iaChave
      patch.ia_chave_iv = data.iaChave === null ? null : (data.iaChaveIv ?? null)
    }

    const existing = await supabase
      .from<AiRow>("tenant_ai_config")
      .select(`select=tenant_id&tenant_id=eq.${enc(tenantId)}&limit=1`)

    if (existing[0]) {
      await supabase.from<AiRow>("tenant_ai_config").update(`tenant_id=eq.${enc(tenantId)}`, patch)
    } else {
      await supabase.from<AiRow>("tenant_ai_config").insert({ tenant_id: tenantId, ...patch } as Partial<AiRow>)
    }
  },
}
