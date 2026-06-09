"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

type Member = {
  userId: string
  email: string
  fullName: string
  role: string
  status: string
  permissions: Record<string, boolean>
  lastLoginAt: string | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  user: "Usuário",
}

const PERMISSIONS = [
  { key: "can_invite_users", label: "Convidar usuários" },
  { key: "can_manage_users", label: "Gerenciar usuários" },
  { key: "can_view_reports", label: "Ver relatórios" },
  { key: "can_export_data", label: "Exportar dados" },
]

export default function ManageUserPage() {
  const params = useParams()
  const userId = params.id as string

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const res = await fetch("/api/tenant/users")
      const data = (await res.json()) as { data?: Member[] }
      const found = data.data?.find((m) => m.userId === userId)
      if (found) {
        setMember(found)
        setPermissions(found.permissions ?? {})
      }
    } catch {
      setError("Erro ao carregar dados do usuário.")
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(status: "active" | "inactive") {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/tenant/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        setError(data.message ?? "Erro ao alterar status.")
        return
      }

      setMember((prev) => (prev ? { ...prev, status } : null))
      setSuccess("Status atualizado com sucesso.")
    } catch {
      setError("Erro de conexão.")
    } finally {
      setSaving(false)
    }
  }

  async function handlePermissionsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/tenant/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        setError(data.message ?? "Erro ao salvar permissões.")
        return
      }

      setSuccess("Permissões salvas com sucesso.")
    } catch {
      setError("Erro de conexão.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-12)" }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--k-color-secondary)", borderTopColor: "transparent" }} />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="auth-status" style={{ paddingTop: "var(--space-12)" }}>
        <p className="portal-greeting-sub">Usuário não encontrado.</p>
        <Link href="/users" className="auth-link">Voltar</Link>
      </div>
    )
  }

  const statusBadge = member.status === "active" ? "badge--success" : member.status === "pending" ? "badge--warning" : "badge--neutral"
  const statusLabel = member.status === "active" ? "Ativo" : member.status === "pending" ? "Pendente" : "Inativo"

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Link href="/users" className="portal-link" aria-label="Voltar">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="portal-greeting">{member.fullName}</h1>
          <p className="portal-greeting-sub">{member.email}</p>
        </div>
      </div>

      {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-4)" }}>{success}</div>}
      {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}

      {/* Info + Status */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <p className="portal-section-label">Informações</p>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <div className="info-row">
            <span className="info-row__label">Função</span>
            <span style={{ color: "var(--k-foreground)" }}>{ROLE_LABELS[member.role] ?? member.role}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">Status</span>
            <span className={`badge ${statusBadge}`}>{statusLabel}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">Último acesso</span>
            <span style={{ color: "var(--k-foreground)" }}>
              {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", paddingTop: "var(--space-4)", borderTop: "1px solid #f3f4f6" }}>
          {member.status !== "active" && (
            <button onClick={() => void handleStatusChange("active")} disabled={saving} className="btn btn--success btn--sm">
              Ativar
            </button>
          )}
          {member.status === "active" && (
            <button onClick={() => void handleStatusChange("inactive")} disabled={saving} className="btn btn--danger btn--sm">
              Inativar
            </button>
          )}
        </div>
      </div>

      {/* Permissões (apenas para role=user) */}
      {member.role === "user" && (
        <div className="card">
          <p className="portal-section-label">Permissões</p>
          <form onSubmit={(e) => void handlePermissionsSubmit(e)}>
            <div style={{ marginBottom: "var(--space-4)" }}>
              {PERMISSIONS.map((perm) => (
                <label key={perm.key} className="check-row">
                  <input
                    type="checkbox"
                    checked={permissions[perm.key] === true}
                    onChange={(e) => setPermissions((prev) => ({ ...prev, [perm.key]: e.target.checked }))}
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
            <button type="submit" disabled={saving} className="btn btn--primary btn--sm">
              {saving ? "Salvando..." : "Salvar permissões"}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
