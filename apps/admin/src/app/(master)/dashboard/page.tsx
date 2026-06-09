import { TenantRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"
import Link from "next/link"

const STATUS_BADGE: Record<string, string> = {
  ativo: "badge--success",
  inadimplente: "badge--warning",
  inativo: "badge--neutral",
  bloqueado: "badge--danger",
}

export default async function DashboardPage() {
  await requireMasterGlobal()

  const allTenants = await TenantRepo.listAll()

  const stats = {
    total: allTenants.length,
    ativos: allTenants.filter((t) => t.status === "ativo").length,
    inadimplentes: allTenants.filter((t) => t.status === "inadimplente").length,
    bloqueados: allTenants.filter((t) => t.status === "bloqueado").length,
  }

  const recentTenants = allTenants.slice(-5).reverse()

  const kpis = [
    { label: "Total de Empresas", value: stats.total, cls: "" },
    { label: "Ativas", value: stats.ativos, cls: "kpi__value--success" },
    { label: "Inadimplentes", value: stats.inadimplentes, cls: "kpi__value--warning" },
    { label: "Bloqueadas", value: stats.bloqueados, cls: "kpi__value--danger" },
  ]

  return (
    <div>
      <div style={{ marginBottom: "var(--space-8)" }}>
        <h1 className="portal-greeting">Dashboard</h1>
        <p className="portal-greeting-sub">Visão geral do ecossistema.</p>
      </div>

      <div className="kpi-grid" style={{ marginBottom: "var(--space-8)" }}>
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <p className="kpi__label">{k.label}</p>
            <p className={`kpi__value ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card card--flush">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid #f3f4f6" }}>
          <span className="portal-section-label" style={{ marginBottom: 0 }}>Empresas recentes</span>
          <Link href="/tenants" className="portal-link">Ver todas →</Link>
        </div>
        {recentTenants.length === 0 ? (
          <p className="table__empty">Nenhuma empresa cadastrada ainda.</p>
        ) : (
          recentTenants.map((t) => (
            <Link
              key={t.id}
              href={`/tenants/${t.id}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid #f3f4f6", textDecoration: "none" }}
            >
              <span>
                <span style={{ display: "block", fontWeight: 500, color: "var(--k-foreground)", fontSize: 14 }}>{t.name}</span>
                <span style={{ display: "block", fontSize: 12, color: "#9ca3af" }}>{t.slug}</span>
              </span>
              <span className={`badge ${STATUS_BADGE[t.status] ?? "badge--neutral"}`}>{t.status}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
