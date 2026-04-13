import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { UserRepo } from "@repo/db"
import ChangePasswordForm from "./ChangePasswordForm"

export default async function ProfilePage() {
  const hdrs = headers()
  const userId = hdrs.get("x-user-id")
  const isMasterGlobal = hdrs.get("x-master-global") === "true"
  const role = hdrs.get("x-user-role")
  const tenantId = hdrs.get("x-tenant-id")

  if (!userId) redirect("/login")

  const user = await UserRepo.findById(userId)
  if (!user) redirect("/login")

  const roleLabels: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    user: "Usuário",
  }
  const roleLabel = isMasterGlobal ? "Master Global" : (role ? (roleLabels[role] ?? role) : "Usuário")

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie as configurações da sua conta</p>
      </div>

      {/* Card de dados do usuário */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.fullName} className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-brand-700 uppercase">
                {user.fullName.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">{user.fullName}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isMasterGlobal
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {roleLabel}
              </span>
              {tenantId && (
                <span className="text-xs text-gray-400 truncate font-mono">{tenantId.slice(0, 8)}…</span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4">
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Membro desde</dt>
            <dd className="text-gray-700">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</dd>
          </div>
          {user.lastLoginAt && (
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Último acesso</dt>
              <dd className="text-gray-700">{new Date(user.lastLoginAt).toLocaleString("pt-BR")}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Form de alterar senha (Client Component) */}
      <ChangePasswordForm />
    </div>
  )
}
