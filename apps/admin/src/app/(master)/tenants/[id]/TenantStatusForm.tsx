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
    <div className="card">
      <p className="portal-section-label">Alterar status</p>

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ marginBottom: "var(--space-3)" }}>
          {STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`radio-card${status === opt.value ? " radio-card--active" : ""}${opt.danger ? " radio-card--danger" : ""}`}
            >
              <input
                type="radio"
                name="status"
                value={opt.value}
                checked={status === opt.value}
                onChange={() => setStatus(opt.value)}
              />
              <span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--k-foreground)" }}>{opt.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "#9ca3af" }}>{opt.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="form-field">
          <label htmlFor="status-notes" className="label">Notas (opcional)</label>
          <textarea
            id="status-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo da alteração..."
            className="textarea"
          />
        </div>

        {error && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{error}</div>}
        {success && <div className="alert alert--success" style={{ marginBottom: "var(--space-3)" }}>Status atualizado com sucesso.</div>}

        <button type="submit" disabled={loading || status === currentStatus} className="btn btn--primary btn--block">
          {loading ? "Salvando..." : "Salvar alteração"}
        </button>
      </form>
    </div>
  )
}
