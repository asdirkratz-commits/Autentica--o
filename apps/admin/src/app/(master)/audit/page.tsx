import { AuditRepo, type AuditFilters } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"

const ACTION_COLORS: Record<string, string> = {
  "auth.login": "bg-blue-100 text-blue-700",
  "auth.login_failed": "bg-red-100 text-red-700",
  "auth.logout": "bg-gray-100 text-gray-600",
  "auth.password_changed": "bg-yellow-100 text-yellow-700",
  "auth.password_reset_completed": "bg-yellow-100 text-yellow-700",
  "tenant.blocked": "bg-red-100 text-red-700",
  "tenant.status_changed": "bg-yellow-100 text-yellow-700",
  "tenant.info_updated": "bg-yellow-100 text-yellow-700",
  "tenant.theme_updated": "bg-yellow-100 text-yellow-700",
  "tenant.logo_updated": "bg-yellow-100 text-yellow-700",
  "tenant.ai_config_updated": "bg-yellow-100 text-yellow-700",
  "tenant.created": "bg-green-100 text-green-700",
  "user.created": "bg-green-100 text-green-700",
  "user.invited": "bg-blue-100 text-blue-700",
  "user.activated": "bg-green-100 text-green-700",
  "user.deactivated": "bg-red-100 text-red-700",
  "user.permissions_changed": "bg-yellow-100 text-yellow-700",
  "session.all_revoked": "bg-red-100 text-red-700",
  "webhook.received": "bg-purple-100 text-purple-700",
  "webhook.processed": "bg-purple-100 text-purple-700",
}

const ACTION_OPTIONS = [
  "auth.login", "auth.login_failed", "auth.logout", "auth.password_changed",
  "tenant.created", "tenant.status_changed", "tenant.info_updated", "tenant.theme_updated",
  "tenant.logo_updated", "tenant.ai_config_updated", "tenant.blocked",
  "user.created", "user.activated", "user.deactivated", "user.permissions_changed",
  "session.all_revoked", "webhook.received", "webhook.processed",
]

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>
}) {
  await requireMasterGlobal()
  const { action, page } = await searchParams

  const parsed = parseInt(page ?? "1", 10)
  const currentPage = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  const offset = (currentPage - 1) * 50

  const logs = await AuditRepo.list({
    action: action as AuditFilters["action"],
    limit: 50,
    offset,
  })

  return (
    <div>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h1 className="portal-greeting">Trilha de auditoria</h1>
        <p className="portal-greeting-sub">Registro imutável de todas as ações sensíveis do sistema.</p>
      </div>

      {/* Filtro por ação (form GET — sem JS) */}
      <form method="GET" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <select name="action" defaultValue={action ?? ""} aria-label="Filtrar por ação" className="select" style={{ width: "auto", minWidth: 220 }}>
          <option value="">Todas as ações</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button type="submit" className="btn btn--primary btn--sm">Filtrar</button>
        {action && <a href="/audit" className="btn btn--ghost btn--sm">Limpar</a>}
      </form>

      <div className="card card--flush">
        {logs.length === 0 ? (
          <p className="table__empty">Nenhum registro de auditoria encontrado.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-4)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", flex: 1, minWidth: 0 }}>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                    {log.action}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#6b7280" }}>
                      <span className="code-mono" style={{ color: "#374151" }}>{log.userId ?? "—"}</span>
                      {" → "}
                      <span>{log.targetType}</span>{" "}
                      <span className="code-mono" style={{ color: "#374151" }}>{log.targetId}</span>
                    </p>
                    {log.ipAddress && <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>IP: {log.ipAddress}</p>}
                    {Object.keys(log.metadata as object).length > 0 && (
                      <p className="code-mono" style={{ fontSize: 12, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>{new Date(log.createdAt).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          ))
        )}

        {logs.length === 50 && (
          <div style={{ padding: "var(--space-3) var(--space-6)", borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
            <a href={`/audit?page=${currentPage + 1}${action ? `&action=${encodeURIComponent(action)}` : ""}`} className="portal-link">
              Próxima página →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
