import { AppRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"

export default async function AppsPage() {
  await requireMasterGlobal()

  const allApps = await AppRepo.listAll()

  const topLevel = allApps.filter((a) => !a.parentAppId)
  const childrenByParent = new Map<string, typeof allApps>()
  for (const app of allApps) {
    if (app.parentAppId) {
      const list = childrenByParent.get(app.parentAppId) ?? []
      list.push(app)
      childrenByParent.set(app.parentAppId, list)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="portal-greeting">Apps</h1>
        <p className="portal-greeting-sub">Catálogo de aplicativos do ecossistema.</p>
      </div>

      {allApps.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "#9ca3af", padding: "var(--space-10)" }}>
          Nenhum app cadastrado. Execute o seed para inserir os apps iniciais.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {topLevel.map((app) => {
          const children = childrenByParent.get(app.id) ?? []
          return (
            <div key={app.id} className="card card--flush">
              {/* App pai */}
              <div style={{ padding: "var(--space-4) var(--space-6)", display: "flex", alignItems: "flex-start", gap: "var(--space-4)" }}>
                <span className="portal-avatar" style={{ width: 40, height: 40, fontSize: 15, borderRadius: "var(--radius-md)" }}>
                  {app.name.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "var(--k-foreground)" }}>{app.displayName}</span>
                    <span className="code-mono" style={{ fontSize: 12, color: "#9ca3af" }}>{app.name}</span>
                    <span className={`badge ${app.active ? "badge--success" : "badge--neutral"}`}>{app.active ? "Ativo" : "Inativo"}</span>
                    {children.length > 0 && (
                      <span className="badge badge--info">{children.length} módulo{children.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {app.description && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{app.description}</p>}
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 12, color: "#9ca3af", flexWrap: "wrap" }}>
                    <span style={{ wordBreak: "break-all" }}>{app.baseUrl}</span>
                    <span>·</span>
                    <span className="code-mono">{app.env}</span>
                    <span>·</span>
                    <span>API Key: {app.apiKey.slice(0, 8)}…</span>
                  </div>
                </div>
              </div>

              {/* Módulos filhos */}
              {children.length > 0 && (
                <div style={{ borderTop: "1px solid #f3f4f6" }}>
                  {children.map((child) => (
                    <div key={child.id} style={{ padding: "var(--space-3) var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-3)", background: "#fafbfc", borderTop: "1px solid #f3f4f6" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d1d5db", marginLeft: "var(--space-4)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{child.displayName}</span>
                          <span className="code-mono" style={{ fontSize: 12, color: "#9ca3af" }}>{child.name}</span>
                          <span className={`badge ${child.active ? "badge--success" : "badge--neutral"}`}>{child.active ? "Ativo" : "Inativo"}</span>
                        </div>
                        {child.description && <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{child.description}</p>}
                        <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, wordBreak: "break-all" }}>{child.baseUrl}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
