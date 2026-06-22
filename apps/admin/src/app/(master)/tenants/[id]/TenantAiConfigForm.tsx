"use client"

import { useState, useEffect } from "react"

type Provider = "openai" | "gemini" | "claude"

const PROVIDERS: { id: Provider; label: string; placeholder: string }[] = [
  { id: "openai", label: "OpenAI (ChatGPT)", placeholder: "sk-..." },
  { id: "gemini", label: "Google Gemini", placeholder: "AIza..." },
  { id: "claude", label: "Anthropic Claude", placeholder: "sk-ant-..." },
]

export default function TenantAiConfigForm({ tenantId }: { tenantId: string }) {
  const [provider, setProvider] = useState<Provider>("openai")
  const [apiKey, setApiKey] = useState("")
  const [hasKey, setHasKey] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/admin/tenants/${tenantId}/ai-config`)
        if (!res.ok) return
        const d = (await res.json()) as { provider: Provider | null; hasKey: boolean }
        if (d.provider) setProvider(d.provider)
        setHasKey(!!d.hasKey)
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
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/ai-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: apiKey.trim() || undefined }),
      })
      const d = (await res.json().catch(() => null)) as { message?: string; hasKey?: boolean } | null
      if (!res.ok) {
        setError(d?.message ?? "Erro ao salvar configuração de IA.")
        return
      }
      setApiKey("")
      setHasKey(!!d?.hasKey)
      setSuccess(true)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const current = PROVIDERS.find((p) => p.id === provider)!

  if (fetching) {
    return (
      <div className="card">
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Carregando…</p>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="portal-section-label" style={{ marginBottom: "var(--space-1)" }}>Integração de IA</p>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: "var(--space-4)" }}>
        Provider e chave usados pela IA do KontoHub. A chave é guardada criptografada e nunca é exibida de volta.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="form-field">
          <label className="label">Provider</label>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="label">
            Chave de API
            {hasKey && <span style={{ color: "var(--k-success, #16a34a)", fontWeight: 500 }}> — configurada</span>}
          </label>
          <input
            className="input input--mono"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? "Deixe em branco para manter a atual" : current.placeholder}
          />
        </div>

        {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-3)" }}>Configuração de IA salva.</div>}

        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          {loading ? "Salvando…" : "Salvar configuração de IA"}
        </button>
      </form>
    </div>
  )
}
