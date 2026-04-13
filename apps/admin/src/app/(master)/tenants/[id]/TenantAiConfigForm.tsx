"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type Provider = "openai" | "gemini" | "claude"

type PublicConfig = {
  activeProvider: Provider
  providers: Partial<Record<Provider, { hasKey: boolean; enabled: boolean }>>
}

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI (ChatGPT)",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
}

const PROVIDER_PLACEHOLDERS: Record<Provider, string> = {
  openai: "sk-...",
  gemini: "AIza...",
  claude: "sk-ant-...",
}

export default function TenantAiConfigForm({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [activeProvider, setActiveProvider] = useState<Provider>("openai")
  const [keys, setKeys] = useState<Partial<Record<Provider, string>>>({})
  const [enabled, setEnabled] = useState<Partial<Record<Provider, boolean>>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${tenantId}/ai-config`)
        if (!res.ok) return
        const data = (await res.json()) as { config: PublicConfig | null }
        if (data.config) {
          setConfig(data.config)
          setActiveProvider(data.config.activeProvider)
          const initEnabled: Partial<Record<Provider, boolean>> = {}
          for (const [p, entry] of Object.entries(data.config.providers) as [Provider, { hasKey: boolean; enabled: boolean }][]) {
            initEnabled[p] = entry.enabled
          }
          setEnabled(initEnabled)
        }
      } finally {
        setFetching(false)
      }
    })()
  }, [tenantId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    // Montar o payload apenas com o que foi preenchido
    const providers: Partial<Record<Provider, { apiKey?: string; enabled?: boolean }>> = {}
    const allProviders: Provider[] = ["openai", "gemini", "claude"]
    for (const p of allProviders) {
      const hasNewKey = keys[p]?.trim()
      const hasEnabledChange = enabled[p] !== undefined
      if (hasNewKey || hasEnabledChange) {
        providers[p] = {
          ...(hasNewKey ? { apiKey: keys[p] } : {}),
          ...(hasEnabledChange ? { enabled: enabled[p] } : {}),
        }
      }
    }

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/ai-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider, providers }),
      })

      let data: { message?: string; config?: PublicConfig } = {}
      try {
        data = (await res.json()) as { message?: string; config?: PublicConfig }
      } catch { /* response não era JSON */ }

      if (!res.ok) {
        setError(data.message ?? `Erro ${res.status} ao salvar configuração`)
        return
      }

      if (data.config) setConfig(data.config)
      setKeys({}) // limpa campos de chave após salvar
      setSuccess(true)
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de conexão"
      setError(`Erro de conexão: ${msg}. Verifique o console do servidor.`)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Integrações de IA</h2>
      <p className="text-xs text-gray-400 mb-4">
        Pelo menos um provider é obrigatório. As chaves são armazenadas com criptografia.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {(["openai", "gemini", "claude"] as Provider[]).map((p) => {
          const existing = config?.providers[p]
          return (
            <div key={p} className="rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{PROVIDER_LABELS[p]}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-gray-500">Habilitado</span>
                  <input
                    type="checkbox"
                    checked={enabled[p] ?? existing?.enabled ?? false}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [p]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Chave de API
                  {existing?.hasKey && (
                    <span className="ml-1 text-green-600 font-medium">— configurada</span>
                  )}
                </label>
                <input
                  type="password"
                  value={keys[p] ?? ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [p]: e.target.value }))}
                  placeholder={existing?.hasKey ? "Deixe em branco para manter a atual" : PROVIDER_PLACEHOLDERS[p]}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
                  autoComplete="off"
                />
              </div>
            </div>
          )
        })}

        {/* Provider ativo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Provider ativo <span className="text-red-500">*</span>
          </label>
          <select
            value={activeProvider}
            onChange={(e) => setActiveProvider(e.target.value as Provider)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {(["openai", "gemini", "claude"] as Provider[]).map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Qual provider será usado por padrão nas integrações.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Configuração de IA salva com sucesso.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Salvando..." : "Salvar configuração de IA"}
        </button>
      </form>
    </div>
  )
}
