import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UserRepo } from "@repo/db"
import Link from "next/link"
import InviteUserButton from "./InviteUserButton"

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  user: "Usuário",
}

const STATUS_BADGE: Record<string, string> = {
  active: "badge--success",
  inactive: "badge--neutral",
  pending: "badge--warning",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Pendente",
}

export default async function TenantUsersPage() {
  const hdrs = await headers()
  const tenantId = hdrs.get("x-tenant-id")
  const actorRole = hdrs.get("x-user-role")
  const actorId = hdrs.get("x-user-id")

  if (!tenantId || !actorId) redirect("/login")
  // Restrito ao admin do tenant — mesma fronteira das rotas de mutação
  // /api/tenant/users/[id]/status|permissions (admin-only). Master global
  // gerencia usuários pelo painel admin, não por aqui (evita ver ações que dariam 403).
  if (actorRole !== "admin") redirect("/")

  const members = await UserRepo.getTenantMembers(tenantId)
  const canManageUsers = actorRole === "admin"
  const ROLE_LEVEL: Record<string, number> = { admin: 1, user: 0 }
  const actorLevel = ROLE_LEVEL[actorRole ?? ""] ?? 0

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="portal-greeting">Usuários</h1>
          <p className="portal-greeting-sub">{members.length} membro(s) nesta empresa.</p>
        </div>
        {canManageUsers && <InviteUserButton />}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Função</th>
              <th>Status</th>
              <th>Último acesso</th>
              {canManageUsers && <th />}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="table__empty">Nenhum usuário encontrado.</td>
              </tr>
            )}
            {members.map((m) => {
              const isActorSelf = m.userId === actorId
              const memberLevel = ROLE_LEVEL[m.role] ?? 0
              const canManage = !isActorSelf && actorLevel > memberLevel

              return (
                <tr key={m.userId} className="table__row--hover">
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <span className="portal-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                        {m.fullName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p style={{ fontWeight: 500, color: "var(--k-foreground)" }}>{m.fullName}</p>
                        <p style={{ fontSize: 12, color: "#9ca3af" }}>{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "#4b5563" }}>{ROLE_LABELS[m.role] ?? m.role}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[m.status] ?? "badge--neutral"}`}>
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td style={{ color: "#6b7280" }}>
                    {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                  </td>
                  {canManageUsers && (
                    <td style={{ textAlign: "right" }}>
                      {canManage && (
                        <Link href={`/users/${m.userId}`} className="portal-link">Gerenciar</Link>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
