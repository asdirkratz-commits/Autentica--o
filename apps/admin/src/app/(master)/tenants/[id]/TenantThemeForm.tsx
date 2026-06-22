"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Theme = { primary: string; secondary: string; accent: string }
type Brand = { primary: string | null; secondary: string | null; accent: string | null }

// Padrão = marca Konto (ciano). Usado quando a empresa ainda não tem cor definida.
const DEFAULTS: Theme = {
  primary:   "#0d2d3a",
  secondary: "#00b4d8",
  accent:    "#48cae4",
}

function initBrand(b: Brand | null): Theme {
  return {
    primary:   b?.primary   ?? DEFAULTS.primary,
    secondary: b?.secondary ?? DEFAULTS.secondary,
    accent:    b?.accent    ?? DEFAULTS.accent,
  }
}

export default function TenantThemeForm({
  tenantId,
  currentBrand,
}: {
  tenantId: string
  currentBrand: Brand | null
}) {
  const router = useRouter()
  const [theme, setTheme] = useState<Theme>(initBrand(currentBrand))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleColor(key: keyof Theme, value: string) {
    setTheme((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      })

      const data = (await res.json()) as { message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao salvar tema")
        return
      }

      setSuccess(true)
      router.refresh()
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const colorFields: { key: keyof Theme; label: string }[] = [
    { key: "primary",   label: "Cor primária" },
    { key: "secondary", label: "Cor secundária" },
    { key: "accent",    label: "Cor de destaque" },
  ]

  return (
    <div className="card">
      <p className="portal-section-label">Cores da marca</p>

      {/* Preview das cores */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
        {colorFields.map(({ key, label }) => (
          <div key={key} style={{ flex: 1, textAlign: "center" }}>
            <div className="swatch" style={{ backgroundColor: theme[key], marginBottom: 4 }} />
            <p style={{ fontSize: 11, color: "#6b7280" }}>{label}</p>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        {colorFields.map(({ key, label }) => (
          <div key={key} className="form-field" style={{ flexDirection: "row", alignItems: "flex-end", gap: "var(--space-3)" }}>
            <input
              type="color"
              value={theme[key]}
              onChange={(e) => handleColor(key, e.target.value)}
              className="color-input"
              aria-label={label}
            />
            <div style={{ flex: 1 }}>
              <label className="label">{label}</label>
              <input
                type="text"
                value={theme[key]}
                onChange={(e) => handleColor(key, e.target.value)}
                placeholder="#000000"
                pattern="^#[0-9a-fA-F]{6}$"
                className="input input--mono"
              />
            </div>
          </div>
        ))}

        {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-3)" }}>Tema atualizado com sucesso.</div>}

        <button type="submit" disabled={loading} className="btn btn--primary btn--block">
          {loading ? "Salvando..." : "Salvar tema"}
        </button>
      </form>
    </div>
  )
}
