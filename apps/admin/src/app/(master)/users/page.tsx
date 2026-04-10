import { db, users } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"

export default async function UsersPage() {
  await requireMasterGlobal()

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      isMasterGlobal: users.isMasterGlobal,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Usuários</h1>
        <p className="text-sm text-gray-500 mt-1">{allUsers.length} usuário(s) cadastrado(s)</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Último acesso</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            )}
            {allUsers.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-gray-600 uppercase">
                        {u.fullName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{u.fullName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {u.isMasterGlobal ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                      Master Global
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Usuário comum</span>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString("pt-BR")
                    : "Nunca"}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
