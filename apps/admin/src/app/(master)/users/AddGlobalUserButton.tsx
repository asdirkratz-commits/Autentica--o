"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type TenantOption = { id: string; name: string }

const EMPTY = { tenantId: "", email: "", fullName: "", password: "", role: "user" as "user" | "admin" }

/**
 * Botão + modal para o Master cadastrar um usuário a partir da lista global.
 * Como todo usuário pertence a um escritório, o modal exige escolher a empresa;
 * o POST vai para /api/admin/tenants/[empresa]/users (mesma rota da aba da empresa).
 */
export default function AddGlobalUserButton({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [creating, setCreating] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function setF<K extends keyof typeof form>(key: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tenantId) {
      setErro("Selecione a empresa.")
      return
    }
    setCreating(true)
    setErro(null)
    try {
      const res = await fetch(`/api/admin/tenants/${form.tenantId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          role: form.role,
        }),
      })
      const d = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setErro(d?.message ?? "Erro ao cadastrar usuário.")
        return
      }
      setOpen(false)
      setForm({ ...EMPTY })
      router.refresh()
    } catch {
      setErro("Erro de conexão.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={() => { setOpen(true); setErro(null) }}>
        + Adicionar usuário
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => !creating && setOpen(false)}
        >
          <div className="card" style={{ width: 440, maxWidth: "100%" }} onClick={(e) => e.stopPropagation()}>
            <p className="portal-section-label">Adicionar usuário</p>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: "var(--space-4)" }}>
              O usuário é criado e ativado na empresa escolhida. Informe a senha inicial e compartilhe com ele.
            </p>

            <form onSubmit={(e) => void handleCreate(e)}>
              <div className="form-field">
                <label className="label">Empresa *</label>
                <select className="input" required value={form.tenantId} onChange={(e) => setF("tenantId", e.target.value)}>
                  <option value="">Selecione…</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="label">E-mail *</label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setF("email", e.target.value)} placeholder="usuario@empresa.com" />
              </div>
              <div className="form-field">
                <label className="label">Nome completo *</label>
                <input className="input" required value={form.fullName} onChange={(e) => setF("fullName", e.target.value)} placeholder="Nome do usuário" />
              </div>
              <div className="form-field">
                <label className="label">Senha inicial *</label>
                <input className="input" type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setF("password", e.target.value)} placeholder="••••••••" />
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo.
                </p>
              </div>
              <div className="form-field">
                <label className="label">Papel</label>
                <select className="input" value={form.role} onChange={(e) => setF("role", e.target.value as "user" | "admin")}>
                  <option value="user">Colaborador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {erro && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{erro}</div>}

              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                <button type="submit" className="btn btn--primary" disabled={creating}>
                  {creating ? "Cadastrando…" : "Cadastrar usuário"}
                </button>
                <button type="button" className="btn" onClick={() => setOpen(false)} disabled={creating}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
