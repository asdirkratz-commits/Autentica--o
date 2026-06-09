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
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13, color: "#9ca3af" }}>
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
    <div className="card">
      <p className="portal-section-label" style={{ marginBottom: "var(--space-1)" }}>Integrações de IA</p>
      <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: "var(--space-4)" }}>
        Pelo menos um provider é obrigatório. As chaves são armazenadas com criptografia.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        {(["openai", "gemini", "claude"] as Provider[]).map((p) => {
          const existing = config?.providers[p]
          return (
            <div key={p} style={{ border: "1px solid #e5e7eb", borderRadius: "var(--radius-md)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--k-foreground)" }}>{PROVIDER_LABELS[p]}</span>
                <label className="check-row">
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Habilitado</span>
                  <input
                    type="checkbox"
                    checked={enabled[p] ?? existing?.enabled ?? false}
                    onChange={(e) => setEnabled((prev) => ({ ...prev, [p]: e.target.checked }))}
                  />
                </label>
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor={`aikey-${p}`} className="label">
                  Chave de API{existing?.hasKey && <span style={{ color: "var(--k-success)", fontWeight: 500 }}> — configurada</span>}
                </label>
                <input
                  id={`aikey-${p}`}
                  type="password"
                  value={keys[p] ?? ""}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [p]: e.target.value }))}
                  placeholder={existing?.hasKey ? "Deixe em branco para manter a atual" : PROVIDER_PLACEHOLDERS[p]}
                  className="input input--mono"
                  autoComplete="off"
                />
              </div>
            </div>
          )
        })}

        <div className="form-field">
          <label htmlFor="ai-active" className="label">Provider ativo <span className="required">*</span></label>
          <select id="ai-active" value={activeProvider} onChange={(e) => setActiveProvider(e.target.value as Provider)} className="select">
            {(["openai", "gemini", "claude"] as Provider[]).map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
          <p className="auth-hint">Qual provider será usado por padrão nas integrações.</p>
        </div>

        {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-3)" }}>Configuração de IA salva com sucesso.</div>}

        <button type="submit" disabled={loading} className="btn btn--primary btn--block">
          {loading ? "Salvando..." : "Salvar configuração de IA"}
        </button>
      </form>
    </div>
  )
}
