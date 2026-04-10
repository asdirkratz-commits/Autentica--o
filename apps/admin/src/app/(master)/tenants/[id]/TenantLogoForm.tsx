"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function TenantLogoForm({
  tenantId,
  currentLogoUrl,
}: {
  tenantId: string
  currentLogoUrl: string | null
}) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: logoUrl.trim() || null }),
      })

      const data = (await res.json()) as { message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao salvar logo")
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Logo Marca</h2>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* Preview */}
        <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-gray-300 bg-gray-50">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo da empresa"
              className="max-h-20 max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none"
              }}
            />
          ) : (
            <p className="text-xs text-gray-400">Sem logo cadastrada</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            URL da imagem
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value)
              setSuccess(false)
            }}
            placeholder="https://exemplo.com/logo.png"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-400">
            URL pública (PNG, JPG ou SVG). Deixe em branco para remover.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Logo atualizada com sucesso.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Salvando..." : "Salvar logo"}
        </button>
      </form>
    </div>
  )
}
