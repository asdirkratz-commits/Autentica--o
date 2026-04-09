"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type TenantStatus = "ativo" | "inativo" | "inadimplente" | "bloqueado"

const STATUS_OPTIONS: { value: TenantStatus; label: string; description: string; danger?: boolean }[] = [
  { value: "ativo", label: "Ativo", description: "Acesso liberado normalmente" },
  { value: "inadimplente", label: "Inadimplente", description: "Acesso com aviso de cobrança" },
  { value: "inativo", label: "Inativo", description: "Conta encerrada" },
  { value: "bloqueado", label: "Bloqueado", description: "Acesso completamente bloqueado", danger: true },
]

export default function TenantStatusForm({
  tenantId,
  currentStatus,
  adminUserId,
}: {
  tenantId: string
  currentStatus: string
  adminUserId: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState<TenantStatus>(currentStatus as TenantStatus)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === currentStatus) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      })

      const data = (await res.json()) as { message?: string }

      if (!res.ok) {
        setError(data.message ?? "Erro ao atualizar status")
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
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Alterar Status</h2>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-2">
          {STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                status === opt.value
                  ? opt.danger
                    ? "border-red-300 bg-red-50"
                    : "border-brand-400 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="status"
                value={opt.value}
                checked={status === opt.value}
                onChange={() => setStatus(opt.value)}
                className="mt-0.5 accent-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Notas (opcional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo da alteração..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Status atualizado com sucesso.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || status === currentStatus}
          className="w-full py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Salvando..." : "Salvar alteração"}
        </button>
      </form>
    </div>
  )
}
