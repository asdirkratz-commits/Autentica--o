import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { UserRepo } from "@repo/db"
import ChangePasswordForm from "./ChangePasswordForm"

export default async function ProfilePage() {
  const hdrs = headers()
  const userId = hdrs.get("x-user-id")
  const role = hdrs.get("x-user-role")

  if (!userId) redirect("/login")

  const user = await UserRepo.findById(userId)
  if (!user) redirect("/login")

  // Flag master viva (do banco); rótulo de papel é cosmético (admin/user)
  const isMasterGlobal = user.isMasterGlobal
  const roleLabel = isMasterGlobal
    ? "Master Global"
    : role === "admin"
      ? "Administrador"
      : "Usuário"

  return (
    <div className="portal" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="portal-greeting">Perfil</h1>
        <p className="portal-greeting-sub">Gerencie as configurações da sua conta.</p>
      </div>

      {/* Dados do usuário */}
      <div className="card" style={{ marginBottom: "var(--space-4)" }}>
        <div className="portal-row">
          <div className="portal-avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.fullName} />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, color: "var(--k-foreground)" }}>{user.fullName}</p>
            <p style={{ fontSize: 13, color: "#6b7280" }}>{user.email}</p>
          </div>
          <span className={`badge ${isMasterGlobal ? "badge--master" : "badge--neutral"}`}>{roleLabel}</span>
        </div>

        <dl style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <dt style={{ color: "#6b7280" }}>Membro desde</dt>
            <dd style={{ color: "var(--k-foreground)" }}>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</dd>
          </div>
          {user.lastLoginAt && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <dt style={{ color: "#6b7280" }}>Último acesso</dt>
              <dd style={{ color: "var(--k-foreground)" }}>{new Date(user.lastLoginAt).toLocaleString("pt-BR")}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Alterar senha (Client Component) */}
      <ChangePasswordForm />
    </div>
  )
}
