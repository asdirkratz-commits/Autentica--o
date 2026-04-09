import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import Link from "next/link"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const hasToken = cookieStore.has("access_token")

  if (!hasToken) {
    redirect("/login")
  }

  const hdrs = await headers()
  const role = hdrs.get("x-user-role")
  const tenantStatus = hdrs.get("x-tenant-status")
  const canManageUsers = role === "owner" || role === "admin"

  return (
    <div className="min-h-screen bg-gray-50">
      {tenantStatus === "inadimplente" && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Pagamento pendente.</span>{" "}
              Regularize sua conta para evitar a suspensão do serviço.
            </p>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">Auth</span>
            </Link>

            {canManageUsers && (
              <Link href="/users" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Usuários
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Perfil
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>
    </div>
  )
}
