"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
  owner: "Proprietário",
  admin: "Administrador",
  user: "Usuário",
}

export default function ManageUserPage() {
  const params = useParams()
  const router = useRouter()
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
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Usuário não encontrado.</p>
        <Link href="/users" className="mt-4 inline-block text-sm text-brand-600 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/users" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{member.fullName}</h1>
          <p className="text-sm text-gray-400">{member.email}</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Info + Status */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Informações</h2>
        <div className="space-y-3 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-gray-500">Função</span>
            <span className="text-gray-800">{ROLE_LABELS[member.role] ?? member.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                member.status === "active"
                  ? "bg-green-100 text-green-700"
                  : member.status === "pending"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {member.status === "active" ? "Ativo" : member.status === "pending" ? "Pendente" : "Inativo"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Último acesso</span>
            <span className="text-gray-800">
              {member.lastLoginAt
                ? new Date(member.lastLoginAt).toLocaleString("pt-BR")
                : "Nunca"}
            </span>
          </div>
        </div>

        {member.role !== "owner" && (
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            {member.status !== "active" && (
              <button
                onClick={() => void handleStatusChange("active")}
                disabled={saving}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Ativar
              </button>
            )}
            {member.status === "active" && (
              <button
                onClick={() => void handleStatusChange("inactive")}
                disabled={saving}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Inativar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Permissões (apenas para role=user) */}
      {member.role === "user" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Permissões</h2>
          <form onSubmit={(e) => void handlePermissionsSubmit(e)} className="space-y-3">
            {[
              { key: "can_invite_users", label: "Convidar usuários" },
              { key: "can_manage_users", label: "Gerenciar usuários" },
              { key: "can_view_reports", label: "Ver relatórios" },
              { key: "can_export_data", label: "Exportar dados" },
            ].map((perm) => (
              <label key={perm.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions[perm.key] === true}
                  onChange={(e) =>
                    setPermissions((prev) => ({ ...prev, [perm.key]: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-700">{perm.label}</span>
              </label>
            ))}

            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar permissões"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
