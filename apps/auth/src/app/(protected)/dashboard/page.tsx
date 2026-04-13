import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { UserRepo, TenantRepo } from "@repo/db"
import Link from "next/link"

export default async function DashboardPage() {
  const hdrs = headers()
  const userId = hdrs.get("x-user-id")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"
  const tenantId = hdrs.get("x-tenant-id")
  const role = hdrs.get("x-user-role")

  if (!userId) redirect("/login")

  const user = await UserRepo.findById(userId)
  if (!user) redirect("/login")

  // Buscar empresa ativa (se houver)
  const tenant = tenantId ? await TenantRepo.findById(tenantId) : null

  const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3002"

  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    user: "Usuário",
  }
  const roleLabel = isMasterGlobal ? "Master Global" : (role ? (roleLabels[role] ?? role) : "Usuário")

  return (
    <div className="max-w-2xl">
      {/* Boas vindas */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Olá, {user.fullName.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Bem-vindo ao Portal do ecossistema Konto.
        </p>
      </div>

      {/* Card do usuário */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 flex items-center gap-4">
        <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.fullName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-brand-700 uppercase">{user.fullName.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{user.fullName}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
          isMasterGlobal ? "bg-amber-100 text-amber-700" : "bg-brand-100 text-brand-700"
        }`}>
          {roleLabel}
        </span>
      </div>

      {/* Empresa ativa */}
      {tenant && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Empresa ativa</p>
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt={tenant.name} className="h-9 object-contain rounded" />
            ) : (
              <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-gray-500 uppercase">{tenant.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="font-medium text-gray-900">{tenant.name}</p>
              <p className="text-xs text-gray-400 font-mono">{tenant.slug}</p>
            </div>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              tenant.status === "ativo" ? "bg-green-100 text-green-700" :
              tenant.status === "inadimplente" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {tenant.status}
            </span>
          </div>
          {(role === "owner" || role === "admin") && (
            <Link
              href="/users"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Gerenciar usuários
            </Link>
          )}
        </div>
      )}

      {/* Ações rápidas — Master Global */}
      {isMasterGlobal && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3">Administração da plataforma</p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={adminUrl}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors"
            >
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Painel Admin</p>
                <p className="text-xs text-gray-400">Empresas e usuários</p>
              </div>
            </a>
            <a
              href={`${adminUrl}/audit`}
              className="flex items-center gap-2 px-4 py-3 bg-white border border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors"
            >
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Auditoria</p>
                <p className="text-xs text-gray-400">Trilha de eventos</p>
              </div>
            </a>
          </div>
        </div>
      )}

      {/* Acesso rápido ao perfil */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Conta</p>
        <Link
          href="/profile"
          className="flex items-center justify-between py-2 text-sm text-gray-700 hover:text-brand-600 transition-colors"
        >
          <span>Alterar senha</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
