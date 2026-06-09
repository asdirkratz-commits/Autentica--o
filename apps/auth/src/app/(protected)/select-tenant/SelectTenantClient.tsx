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
      {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}

      <div>
        {tenants.map((t) => (
          <button
            key={t.tenantId}
            type="button"
            onClick={() => void selectTenant(t.tenantId)}
            disabled={loading !== null}
            className="tenant-option"
          >
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
              <span className="portal-avatar" style={{ width: 36, height: 36, fontSize: 14, borderRadius: "var(--radius-md)" }}>
                {t.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="tenant-option__name">{t.name}</span>
                <span className="tenant-option__slug">{t.slug}</span>
              </span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span className="badge badge--neutral">{ROLE_LABELS[t.role] ?? t.role}</span>
              {loading === t.tenantId && (
                <svg className="animate-spin w-4 h-4 shrink-0" style={{ color: "var(--k-color-secondary)" }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
