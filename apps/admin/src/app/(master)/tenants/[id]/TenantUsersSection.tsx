"use client"

import { useState } from "react"
import { MODULOS_KONTOHUB } from "@/lib/modulos"

export type TenantMemberView = {
  userId: string
  fullName: string
  email: string
  role: string
  status: string
  modulos: string[]
}

const EMPTY_FORM = { email: "", fullName: "", password: "", role: "user" as "user" | "admin" }

export default function TenantUsersSection({
  tenantId,
  initialMembers,
}: {
  tenantId: string
  initialMembers: TenantMemberView[]
}) {
  const [members, setMembers] = useState<TenantMemberView[]>(initialMembers)
  const [savingUser, setSavingUser] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  // Adicionar usuário
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  const [addErro, setAddErro] = useState<string | null>(null)

  async function reload() {
    const r = await fetch(`/api/admin/tenants/${tenantId}/users`)
    if (!r.ok) return
    const d = (await r.json()) as { members?: TenantMemberView[] }
    setMembers(d.members ?? [])
  }

  async function toggle(member: TenantMemberView, moduloId: string) {
    if (member.modulos.includes("*")) return
    const has = member.modulos.includes(moduloId)
    const next = has
      ? member.modulos.filter((m) => m !== moduloId)
      : [...member.modulos, moduloId]

    const previous = member.modulos
    setSavingUser(member.userId)
    setErro(null)
    // Otimista
    setMembers((prev) =>
      prev.map((m) => (m.userId === member.userId ? { ...m, modulos: next } : m))
    )

    try {
      const res = await fetch(
        `/api/admin/tenants/${tenantId}/users/${member.userId}/modulos`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modulos: next }),
        }
      )
      if (!res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === member.userId ? { ...m, modulos: previous } : m
          )
        )
        const d = (await res.json().catch(() => null)) as
          | { message?: string; error?: { message?: string } }
          | null
        setErro(d?.message ?? d?.error?.message ?? "Erro ao salvar módulos.")
      }
    } catch {
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === member.userId ? { ...m, modulos: previous } : m
        )
      )
      setErro("Erro de conexão.")
    } finally {
      setSavingUser(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setAddErro(null)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setAddErro(d?.message ?? "Erro ao cadastrar usuário.")
        return
      }
      setShowAdd(false)
      setForm({ ...EMPTY_FORM })
      await reload()
    } catch {
      setAddErro("Erro de conexão.")
    } finally {
      setCreating(false)
    }
  }

  function setF<K extends keyof typeof form>(key: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  return (
    <div className="card card--flush">
      <div
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
        }}
      >
        <span className="portal-section-label" style={{ marginBottom: 0 }}>
          Usuários e módulos liberados
        </span>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => { setShowAdd(true); setAddErro(null) }}>
          + Adicionar usuário
        </button>
      </div>

      {erro && (
        <div className="alert alert--danger" style={{ margin: "var(--space-3) var(--space-6)" }}>
          {erro}
        </div>
      )}

      {members.length === 0 ? (
        <p className="table__empty">Nenhum usuário nesta empresa.</p>
      ) : (
        members.map((m) => {
          const all = m.modulos.includes("*")
          return (
            <div
              key={m.userId}
              style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid #f3f4f6" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.fullName || m.email}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>{m.email}</span>
                </div>
                <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>
                  {m.role === "admin" ? "Administrador" : "Colaborador"}
                  {savingUser === m.userId ? " · salvando…" : ""}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "var(--space-3)" }}>
                {MODULOS_KONTOHUB.map((mod) => {
                  const on = all || m.modulos.includes(mod.id)
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      disabled={savingUser === m.userId || all}
                      onClick={() => void toggle(m, mod.id)}
                      title={all ? "Acesso a todos os módulos (*)" : undefined}
                      style={{
                        fontSize: 11,
                        padding: "3px 10px",
                        borderRadius: 100,
                        border: "none",
                        cursor: all || savingUser === m.userId ? "default" : "pointer",
                        background: on ? "var(--k-color-secondary)" : "#f0f0f0",
                        color: on ? "#fff" : "#555",
                        opacity: savingUser === m.userId ? 0.6 : 1,
                      }}
                    >
                      {mod.label}
                    </button>
                  )
                })}
              </div>

              {all && (
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                  Acesso a todos os módulos (*) — definido fora desta tela.
                </p>
              )}
            </div>
          )
        })
      )}

      {/* Modal: adicionar usuário */}
      {showAdd && (
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
          onClick={() => !creating && setShowAdd(false)}
        >
          <div className="card" style={{ width: 440, maxWidth: "100%" }} onClick={(e) => e.stopPropagation()}>
            <p className="portal-section-label">Adicionar usuário</p>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: "var(--space-4)" }}>
              O usuário é criado e ativado nesta empresa. Informe a senha inicial e compartilhe com ele.
            </p>

            <form onSubmit={(e) => void handleCreate(e)}>
              <div className="form-field">
                <label className="label">E-mail *</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setF("email", e.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </div>
              <div className="form-field">
                <label className="label">Nome completo *</label>
                <input
                  className="input"
                  required
                  value={form.fullName}
                  onChange={(e) => setF("fullName", e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>
              <div className="form-field">
                <label className="label">Senha inicial *</label>
                <input
                  className="input"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setF("password", e.target.value)}
                  placeholder="••••••••"
                />
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

              {addErro && <div className="alert alert--danger" style={{ marginBottom: "var(--space-3)" }}>{addErro}</div>}

              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                <button type="submit" className="btn btn--primary" disabled={creating}>
                  {creating ? "Cadastrando…" : "Cadastrar usuário"}
                </button>
                <button type="button" className="btn" onClick={() => setShowAdd(false)} disabled={creating}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
