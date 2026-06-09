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
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="portal-greeting">Usuários</h1>
        <p className="portal-greeting-sub">{allUsers.length} usuário(s) cadastrado(s).</p>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Tipo</th>
              <th>Último acesso</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.length === 0 && (
              <tr><td colSpan={4} className="table__empty">Nenhum usuário cadastrado.</td></tr>
            )}
            {allUsers.map((u) => (
              <tr key={u.id} className="table__row--hover">
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span className="portal-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                      {u.fullName.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p style={{ fontWeight: 500, color: "var(--k-foreground)" }}>{u.fullName}</p>
                      <p style={{ fontSize: 12, color: "#9ca3af" }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td>
                  {u.isMasterGlobal
                    ? <span className="badge badge--master">Master Global</span>
                    : <span style={{ fontSize: 13, color: "#6b7280" }}>Usuário comum</span>}
                </td>
                <td style={{ color: "#6b7280" }}>
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}
                </td>
                <td style={{ color: "#6b7280" }}>{new Date(u.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
