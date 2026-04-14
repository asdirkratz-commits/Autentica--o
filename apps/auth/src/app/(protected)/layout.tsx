import type { CSSProperties } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UserRepo, TenantRepo } from "@repo/db"
import SidebarActiveLink from "./SidebarActiveLink"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hdrs          = headers()
  const userId        = hdrs.get("x-user-id")
  const role          = hdrs.get("x-user-role")
  const tenantId      = hdrs.get("x-tenant-id")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"

  if (!userId) redirect("/login")
  if (!tenantId && !isMasterGlobal) redirect("/select-tenant")

  const user = await UserRepo.findById(userId)
  if (!user) redirect("/login")

  const tenant = tenantId ? await TenantRepo.findById(tenantId) : null

  // Tema visual do tenant — sobrescreve as CSS vars padrão
  type ThemeJson = { primary?: string; secondary?: string; accent?: string }
  let themeJson: ThemeJson | null = null
  if (tenant?.theme) {
    try { themeJson = JSON.parse(tenant.theme) as ThemeJson } catch { /* usa defaults */ }
  }
  const themeStyle = themeJson
    ? ({
        "--k-color-primary":   themeJson.primary,
        "--k-color-secondary": themeJson.secondary ?? themeJson.primary,
        "--k-color-highlight": themeJson.accent ?? themeJson.secondary ?? themeJson.primary,
      } as CSSProperties)
    : undefined

  const isAdmin       = role === "admin" || isMasterGlobal
  const adminUrl      = process.env.NEXT_PUBLIC_ADMIN_URL    ?? "http://localhost:3002"
  const kontohubUrl   = process.env.NEXT_PUBLIC_KONTOHUB_URL ?? "http://localhost:3000"

  const userInitial   = user.fullName.charAt(0).toUpperCase()

  return (
    <div className="app-shell" style={themeStyle}>
      <aside className="sidebar">

        {/* ── Logo / Nome do tenant ── */}
        <div className="sidebar__brand">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="sidebar__logo"
            />
          ) : (
            <span>{tenant?.name ?? "KontoHub"}</span>
          )}
        </div>

        {/* ── Navegação ── */}
        <nav className="sidebar__nav">

          {/* Início → KontoHub */}
          <a href={kontohubUrl} className="sidebar__link">
            Início
          </a>

          {/* Perfil */}
          <SidebarActiveLink href="/profile">
            Perfil
          </SidebarActiveLink>

          {/* Usuários — admin e master global */}
          {isAdmin && tenantId && (
            <SidebarActiveLink href="/users">
              Usuários
            </SidebarActiveLink>
          )}

          {/* Seção Administração — master global */}
          {isMasterGlobal && (
            <div className="sidebar__section">
              <span className="sidebar__section-label">Administração</span>
              <a href={adminUrl} className="sidebar__link sidebar__link--master">
                Painel Admin
              </a>
              {tenantId && (
                <SidebarActiveLink href="/select-tenant">
                  Trocar empresa
                </SidebarActiveLink>
              )}
            </div>
          )}

          {/* Trocar empresa — usuários comuns */}
          {!isMasterGlobal && tenantId && (
            <div className="sidebar__section">
              <SidebarActiveLink href="/select-tenant">
                Trocar empresa
              </SidebarActiveLink>
            </div>
          )}

        </nav>

        {/* ── Rodapé com usuário + logout ── */}
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.fullName} />
              ) : (
                userInitial
              )}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user.fullName}</span>
              <span className="sidebar__user-email">{user.email}</span>
            </div>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="sidebar__logout">
              Sair
            </button>
          </form>
        </div>

      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="main-content">
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  )
}
