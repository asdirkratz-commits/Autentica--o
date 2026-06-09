import { TenantRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"
import Link from "next/link"

const STATUS_BADGE: Record<string, string> = {
  ativo: "badge--success",
  inadimplente: "badge--warning",
  inativo: "badge--neutral",
  bloqueado: "badge--danger",
}

const FILTERS = [
  { label: "Todas", value: "" },
  { label: "Ativas", value: "ativo" },
  { label: "Inadimplentes", value: "inadimplente" },
  { label: "Bloqueadas", value: "bloqueado" },
  { label: "Inativas", value: "inativo" },
]

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireMasterGlobal()
  const { status } = await searchParams

  const validStatuses = ["ativo", "inativo", "inadimplente", "bloqueado"] as const
  type TenantStatus = typeof validStatuses[number]
  const filterStatus = validStatuses.includes(status as TenantStatus)
    ? (status as TenantStatus)
    : undefined

  const tenants = await TenantRepo.listAll(filterStatus ? { status: filterStatus } : undefined)

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="portal-greeting">Empresas</h1>
          <p className="portal-greeting-sub">{tenants.length} empresa(s) encontrada(s).</p>
        </div>
        <Link href="/tenants/new" className="btn btn--primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nova empresa
        </Link>
      </div>

      <div className="filter-pills" style={{ marginBottom: "var(--space-6)" }}>
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/tenants?status=${f.value}` : "/tenants"}
            className={`filter-pill${(filterStatus ?? "") === f.value ? " filter-pill--active" : ""}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Criada em</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 && (
              <tr><td colSpan={5} className="table__empty">Nenhuma empresa encontrada.</td></tr>
            )}
            {tenants.map((t) => (
              <tr key={t.id} className="table__row--hover">
                <td>
                  <p style={{ fontWeight: 500, color: "var(--k-foreground)" }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>{t.slug}</p>
                </td>
                <td style={{ color: "#4b5563", textTransform: "capitalize" }}>{t.plan}</td>
                <td><span className={`badge ${STATUS_BADGE[t.status] ?? "badge--neutral"}`}>{t.status}</span></td>
                <td style={{ color: "#6b7280" }}>{new Date(t.createdAt).toLocaleDateString("pt-BR")}</td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/tenants/${t.id}`} className="portal-link">Ver detalhes</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
