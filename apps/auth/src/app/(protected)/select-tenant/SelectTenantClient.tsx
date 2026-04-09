"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Tenant = {
  tenantId: string
  role: string
  name: string
  slug: string
  status: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  user: "Usuário",
}

export default function SelectTenantClient({
  tenants,
  returnTo,
}: {
  tenants: Tenant[]
  returnTo: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function selectTenant(tenantId: string) {
    setLoading(tenantId)
    setError(null)

    try {
      const res = await fetch("/api/auth/select-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        setError(data.message ?? "Erro ao selecionar empresa")
        return
      }

      router.push(returnTo)
    } catch {
      setError("Erro de conexão. Tente novamente.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {tenants.map((t) => (
          <button
            key={t.tenantId}
            onClick={() => void selectTenant(t.tenantId)}
            disabled={loading !== null}
            className="w-full flex items-center gap-4 px-4 py-4 border border-gray-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-brand-700 font-semibold text-sm uppercase">
                {t.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
              <p className="text-xs text-gray-400">{t.slug}</p>
            </div>
            <span className="text-xs text-gray-500 shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
              {ROLE_LABELS[t.role] ?? t.role}
            </span>
            {loading === t.tenantId && (
              <svg
                className="animate-spin w-4 h-4 text-brand-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
