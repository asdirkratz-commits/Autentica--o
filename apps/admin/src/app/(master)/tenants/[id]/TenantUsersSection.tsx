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

  return (
    <div className="card card--flush">
      <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid #f3f4f6" }}>
        <span className="portal-section-label" style={{ marginBottom: 0 }}>
          Usuários e módulos liberados
        </span>
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
    </div>
  )
}
