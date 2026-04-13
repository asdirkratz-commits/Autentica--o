"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Theme = { primary: string; secondary: string; accent: string }

const DEFAULTS: Theme = {
  primary:   "#2563eb",
  secondary: "#7c3aed",
  accent:    "#0891b2",
}

function parseTheme(raw: string | null): Theme {
  if (!raw) return { ...DEFAULTS }
  try {
    const t = JSON.parse(raw) as Partial<Theme>
    return {
      primary:   t.primary   ?? DEFAULTS.primary,
      secondary: t.secondary ?? DEFAULTS.secondary,
      accent:    t.accent    ?? DEFAULTS.accent,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export default function TenantThemeForm({
  tenantId,
  currentTheme,
}: {
  tenantId: string
  currentTheme: string | null
}) {
  const router = useRouter()
  const [theme, setTheme] = useState<Theme>(parseTheme(currentTheme))
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
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Tema / Cores</h2>

      {/* Preview das cores */}
      <div className="flex gap-2 mb-4">
        {colorFields.map(({ key, label }) => (
          <div key={key} className="flex-1 text-center">
            <div
              className="h-8 rounded-md mb-1 border border-gray-200"
              style={{ backgroundColor: theme[key] }}
            />
            <p className="text-xs text-gray-500 truncate">{label}</p>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        {colorFields.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <input
              type="color"
              value={theme[key]}
              onChange={(e) => handleColor(key, e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300 p-0.5"
            />
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
              <input
                type="text"
                value={theme[key]}
                onChange={(e) => handleColor(key, e.target.value)}
                placeholder="#000000"
                pattern="^#[0-9a-fA-F]{6}$"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        ))}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Tema atualizado com sucesso.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Salvando..." : "Salvar tema"}
        </button>
      </form>
    </div>
  )
}
