import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { UserRepo, TenantRepo } from "@repo/db"
import { AppIcon } from "@repo/ui"
import { getAccessibleApps } from "@/lib/accessible-apps"

export default async function DashboardPage() {
  const hdrs = headers()
  const userId = hdrs.get("x-user-id")
  const tenantId = hdrs.get("x-tenant-id")

  if (!userId) redirect("/login")

  // x-user-id = GoTrue UUID (JWT sub) → buscar por gotrue_id, não por users.id (id Neon).
  const user = await UserRepo.findByGoTrueId(userId)
  if (!user) redirect("/login")

  // Papel e flag master VIVOS (do banco), não o snapshot do JWT — mantém o portal
  // consistente com o gating da API e evita exibir links de apps de um papel já
  // rebaixado durante a vida do token.
  const isMasterGlobal = user.isMasterGlobal
  const membership = tenantId ? await UserRepo.getUserRoleInTenant(userId, tenantId) : null
  const role = membership?.role ?? null

  const tenant = tenantId ? await TenantRepo.findById(tenantId) : null
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002"

  // Apps liberados — mesma fonte de gating da API (só contratados/ativos aparecem)
  const apps = tenantId
    ? await getAccessibleApps({ userId, tenantId, role, isMasterGlobal })
    : []

  const roleLabel = isMasterGlobal
    ? "Master Global"
    : role === "admin"
      ? "Administrador"
      : "Usuário"
  const isAdmin = role === "admin" || isMasterGlobal

  const tenantStatusClass =
    tenant?.status === "ativo" ? "badge--success" :
    tenant?.status === "inadimplente" ? "badge--warning" : "badge--danger"

  return (
    <div className="portal">
      {/* Boas-vindas */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="portal-greeting">Olá, {user.fullName.split(" ")[0]} 👋</h1>
        <p className="portal-greeting-sub">Bem-vindo ao Portal do ecossistema Konto.</p>
      </div>

      {/* Card do usuário */}
      <div className="card portal-row" style={{ marginBottom: "var(--space-4)" }}>
        <div className="portal-avatar">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.fullName} />
          ) : (
            user.fullName.charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, color: "var(--k-foreground)" }}>{user.fullName}</p>
          <p style={{ fontSize: 13, color: "#6b7280" }}>{user.email}</p>
        </div>
        <span className={`badge ${isMasterGlobal ? "badge--master" : "badge--brand"}`}>{roleLabel}</span>
      </div>

      {/* Empresa ativa */}
      {tenant && (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <p className="portal-section-label">Empresa ativa</p>
          <div className="portal-row">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.name} style={{ height: 36, objectFit: "contain", borderRadius: "var(--radius-sm)" }} />
            ) : (
              <div className="portal-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                {tenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p style={{ fontWeight: 500, color: "var(--k-foreground)" }}>{tenant.name}</p>
              <p style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>{tenant.slug}</p>
            </div>
            <span className={`badge ${tenantStatusClass}`} style={{ marginLeft: "auto" }}>{tenant.status}</span>
          </div>
          {isAdmin && tenantId && (
            <Link href="/users" className="portal-link" style={{ marginTop: "var(--space-3)" }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Gerenciar usuários
            </Link>
          )}
        </div>
      )}

      {/* Apps disponíveis (gated por assinatura) */}
      {tenant && (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <p className="portal-section-label">Apps disponíveis</p>
          {apps.length > 0 ? (
            <div className="app-grid">
              {apps.map((app) => (
                <AppIcon
                  key={app.appId}
                  name={app.name}
                  displayName={app.displayName}
                  baseUrl={app.baseUrl}
                  iconUrl={app.iconUrl}
                  active={app.active}
                />
              ))}
            </div>
          ) : (
            <p className="portal-empty">Nenhum app disponível para esta empresa.</p>
          )}
        </div>
      )}

      {/* Administração — Master Global */}
      {isMasterGlobal && (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <p className="portal-section-label">Administração da plataforma</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            <a href={adminUrl} className="portal-link">Painel Admin</a>
            <a href={`${adminUrl}/audit`} className="portal-link">Auditoria</a>
          </div>
        </div>
      )}

      {/* Conta */}
      <div className="card">
        <p className="portal-section-label">Conta</p>
        <Link href="/profile" className="portal-link">Perfil e senha</Link>
      </div>
    </div>
  )
}
