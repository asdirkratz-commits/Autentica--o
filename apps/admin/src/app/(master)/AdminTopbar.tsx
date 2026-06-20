"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/tenants", label: "Empresas", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/users", label: "Usuários", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/apps", label: "Apps", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { href: "/audit", label: "Auditoria", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0] ?? ""
  const last = parts[parts.length - 1] ?? ""
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase()
}

export default function AdminTopbar({
  userName,
  userEmail,
  avatarUrl,
  authUrl,
}: {
  userName: string
  userEmail: string
  avatarUrl: string | null
  authUrl: string
}) {
  const pathname = usePathname()

  return (
    <header className="app-topbar">
      {/* ── Marca ── */}
      <div className="app-topbar__brand">
        <span className="app-topbar__brand-icon">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </span>
        <span className="app-topbar__brand-text">
          <span className="app-topbar__brand-title">Administração</span>
          <span className="app-topbar__brand-sub">Master Global</span>
        </span>
      </div>

      {/* ── Navegação (ícone + rótulo) ── */}
      <nav className="app-topbar__nav" aria-label="Navegação da administração">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-topbar__item${active ? " app-topbar__item--active" : ""}`}
              {...(active ? { "aria-current": "page" as const } : {})}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="app-topbar__item-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Ações (direita) ── */}
      <div className="app-topbar__actions">
        <a href={`${authUrl}/profile`} className="app-topbar__link">Voltar ao Portal</a>

        <div className="app-topbar__user" title={userEmail}>
          <span className="app-topbar__avatar">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={userName} />
            ) : (
              initials(userName)
            )}
          </span>
          <div className="app-topbar__user-info">
            <span className="app-topbar__user-name">{userName}</span>
            <span className="app-topbar__user-role">Master</span>
          </div>
        </div>

        <form action={`${authUrl}/api/auth/logout`} method="POST">
          <button type="submit" className="app-topbar__logout">Sair</button>
        </form>
      </div>
    </header>
  )
}
