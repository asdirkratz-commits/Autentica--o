import type { CSSProperties } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UserRepo, TenantRepo } from "@repo/db"
import Link from "next/link"
import SidebarActiveLink from "./SidebarActiveLink"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hdrs = headers()
  const userId = hdrs.get("x-user-id")
  const role = hdrs.get("x-user-role")
  const tenantId = hdrs.get("x-tenant-id")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"

  // master_global sem tenant no header é válido — só redireciona se não é master
  if (!userId) redirect("/login")
  if (!tenantId && !isMasterGlobal) redirect("/select-tenant")

  const user = await UserRepo.findById(userId)
  if (!user) redirect("/login")

  // Tema visual do tenant
  const tenant = tenantId ? await TenantRepo.findById(tenantId) : null
  type ThemeJson = { primary?: string; secondary?: string; accent?: string }
  let themeJson: ThemeJson | null = null
  if (tenant?.theme) {
    try { themeJson = JSON.parse(tenant.theme) as ThemeJson } catch { /* usa defaults */ }
  }
  // CSS vars que sobrescrevem os padrões de :root para refletir a identidade do tenant.
  // brand-600 = cor principal (botões, link ativo)
  // brand-700 = hover / variante mais escura
  // brand-500 = destaque / focus ring
  const themeStyle = themeJson
    ? ({
        "--k-brand-600": themeJson.primary,
        "--k-brand-700": themeJson.secondary ?? themeJson.primary,
        "--k-brand-500": themeJson.accent ?? themeJson.secondary ?? themeJson.primary,
        "--k-color-primary":   themeJson.primary,
        "--k-color-secondary": themeJson.secondary ?? themeJson.primary,
        "--k-color-highlight": themeJson.accent ?? themeJson.secondary,
      } as CSSProperties)
    : undefined

  const canManageUsers = role === "admin" || isMasterGlobal
  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002"

  // Itens visíveis para todos os usuários autenticados
  const baseNavItems = [
    {
      href: "/dashboard",
      label: "Início",
      icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    },
    {
      href: "/profile",
      label: "Perfil",
      icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    },
  ]

  // Itens exclusivos de owner/admin
  const adminNavItems =
    canManageUsers && tenantId
      ? [
          {
            href: "/users",
            label: "Usuários",
            icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
          },
        ]
      : []

  const navItems = [...baseNavItems, ...adminNavItems]

  // Label de role para exibição
  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    user: "Usuário",
  }
  const roleLabel = isMasterGlobal ? "Master Global" : (role ? (roleLabels[role] ?? role) : "Usuário")

  return (
    <div className="flex h-screen bg-gray-100" style={themeStyle}>
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 flex flex-col shrink-0">
        {/* Header da sidebar */}
        <div className="px-6 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {tenant?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="w-8 h-8 object-contain rounded-lg shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">
                {tenant?.name ?? "Portal"}
              </p>
              <p className="text-gray-400 text-xs truncate">{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Navegação principal */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <SidebarActiveLink key={item.href} href={item.href} icon={item.icon}>
              {item.label}
            </SidebarActiveLink>
          ))}

          {/* Seção exclusiva do Master Global */}
          {isMasterGlobal && (
            <div className="pt-3 mt-3 border-t border-gray-700">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Administração
              </p>
              <a
                href={adminUrl}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-amber-400 hover:bg-gray-800 hover:text-amber-300 transition-colors text-sm"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Painel Admin
              </a>

              {tenantId && (
                <Link
                  href="/select-tenant"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Trocar empresa
                </Link>
              )}
            </div>
          )}

          {/* Trocar empresa para usuários comuns com múltiplos tenants */}
          {!isMasterGlobal && tenantId && (
            <div className="pt-3 mt-3 border-t border-gray-700">
              <Link
                href="/select-tenant"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors text-sm"
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Trocar empresa
              </Link>
            </div>
          )}
        </nav>

        {/* Rodapé com usuário + logout */}
        <div className="px-4 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center shrink-0">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-gray-300 uppercase">
                  {user.fullName.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full text-xs text-gray-400 hover:text-white transition-colors text-left px-1 py-0.5"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
