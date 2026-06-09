import { requireMasterGlobal } from "@/lib/admin-guard"
import AdminSidebarActiveLink from "./AdminSidebarActiveLink"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/tenants", label: "Empresas", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/users", label: "Usuários", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/apps", label: "Apps", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { href: "/audit", label: "Auditoria", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
]

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireMasterGlobal()
  const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"
  const userInitial = user.fullName.charAt(0).toUpperCase()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* ── Marca ── */}
        <div className="sidebar__brand">
          <span className="sidebar__brand-icon">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </span>
          <span className="sidebar__brand-text">
            <span className="sidebar__brand-title">Admin</span>
            <span className="sidebar__brand-sub">Master Global</span>
          </span>
        </div>

        {/* ── Navegação ── */}
        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <AdminSidebarActiveLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </AdminSidebarActiveLink>
          ))}

          {/* Voltar ao portal do usuário */}
          <div className="sidebar__section">
            <span className="sidebar__section-label">Portal</span>
            <a href={`${authUrl}/profile`} className="sidebar__link">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Voltar ao Portal
            </a>
          </div>
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
          <a href={`${authUrl}/api/auth/logout`} className="sidebar__logout">
            Sair
          </a>
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
