import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { UserRepo } from "@repo/db"
import Link from "next/link"
import InviteUserButton from "./InviteUserButton"

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  user: "Usuário",
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
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

  if (!tenantId || !actorId) {
    redirect("/login")
  }

  if (actorRole !== "owner" && actorRole !== "admin") {
    redirect("/")
  }

  const members = await UserRepo.getTenantMembers(tenantId)

  const canInvite = actorRole === "owner" || actorRole === "admin"

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">
            {members.length} membro(s) nesta empresa
          </p>
        </div>
        {canInvite && <InviteUserButton actorRole={actorRole} />}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Função
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Último acesso
              </th>
              {canInvite && (
                <th className="px-6 py-3" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {members.map((m) => {
              const isActorSelf = m.userId === actorId
              const ROLE_LEVEL: Record<string, number> = { owner: 2, admin: 1, user: 0 }
              const actorLevel = ROLE_LEVEL[actorRole] ?? 0
              const memberLevel = ROLE_LEVEL[m.role] ?? 0
              const canManage = !isActorSelf && actorLevel > memberLevel

              return (
                <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-brand-700 uppercase">
                          {m.fullName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{m.fullName}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-600">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABELS[m.status] ?? m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {m.lastLoginAt
                      ? new Date(m.lastLoginAt).toLocaleString("pt-BR")
                      : "Nunca"}
                  </td>
                  {canInvite && (
                    <td className="px-6 py-4 text-right">
                      {canManage && (
                        <Link
                          href={`/users/${m.userId}`}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          Gerenciar
                        </Link>
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
