import { notFound } from "next/navigation"
import { TenantRepo, AuditRepo, UserRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"
import TenantStatusForm from "./TenantStatusForm"
import TenantLogoForm from "./TenantLogoForm"
import TenantThemeForm from "./TenantThemeForm"
import TenantAiConfigForm from "./TenantAiConfigForm"
import TenantInfoForm from "./TenantInfoForm"
import TenantUsersSection from "./TenantUsersSection"
import Link from "next/link"

const STATUS_BADGE: Record<string, string> = {
  ativo: "badge--success",
  inadimplente: "badge--warning",
  inativo: "badge--neutral",
  bloqueado: "badge--danger",
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const adminUser = await requireMasterGlobal()
  const { id } = await params

  const tenant = await TenantRepo.findById(id)
  if (!tenant) notFound()

  const auditLogs = await AuditRepo.list({ tenantId: id, limit: 20 })
  const members = (await UserRepo.getTenantMembers(id)).map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
    role: m.role,
    status: m.status,
    modulos: m.modulos,
  }))

  const infoRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "ID", value: tenant.id, mono: true },
    { label: "Plano", value: tenant.plan },
    { label: "CNPJ", value: tenant.cnpj ?? "—", mono: true },
    { label: "Billing ID", value: tenant.externalBillingId ?? "—" },
    { label: "Criada em", value: new Date(tenant.createdAt).toLocaleString("pt-BR") },
    { label: "Status atualizado", value: new Date(tenant.statusUpdatedAt).toLocaleString("pt-BR") },
  ]

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <Link href="/tenants" className="portal-link" aria-label="Voltar">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div style={{ flex: 1 }}>
          <h1 className="portal-greeting">{tenant.name}</h1>
          <p className="portal-greeting-sub code-mono" style={{ fontFamily: "monospace" }}>{tenant.slug}</p>
        </div>
        <span className={`badge ${STATUS_BADGE[tenant.status] ?? "badge--neutral"}`}>{tenant.status}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Coluna esquerda — info + auditoria */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="card">
            <p className="portal-section-label">Informações</p>
            <dl>
              {infoRows.map((d) => (
                <div key={d.label} className="info-row">
                  <dt className="info-row__label">{d.label}</dt>
                  <dd className={`info-row__value${d.mono ? " code-mono" : ""}`} style={d.mono ? { fontFamily: "monospace", fontSize: 12 } : undefined}>{d.value}</dd>
                </div>
              ))}
            </dl>

            {(tenant.street ?? tenant.city ?? tenant.zipCode) && (
              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid #f3f4f6" }}>
                <p className="portal-section-label">Endereço</p>
                <address style={{ fontStyle: "normal", fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>
                  {tenant.street && (
                    <div>{tenant.street}{tenant.streetNumber ? `, ${tenant.streetNumber}` : ""}{tenant.complement ? ` — ${tenant.complement}` : ""}</div>
                  )}
                  {tenant.district && <div>{tenant.district}</div>}
                  {(tenant.city ?? tenant.state) && <div>{[tenant.city, tenant.state].filter(Boolean).join(" — ")}</div>}
                  {tenant.zipCode && <div style={{ fontFamily: "monospace", fontSize: 12, color: "#9ca3af" }}>CEP {tenant.zipCode}</div>}
                </address>
              </div>
            )}

            <TenantInfoForm
              tenantId={tenant.id}
              initial={{
                cnpj: tenant.cnpj,
                zipCode: tenant.zipCode,
                street: tenant.street,
                streetNumber: tenant.streetNumber,
                complement: tenant.complement,
                district: tenant.district,
                city: tenant.city,
                state: tenant.state,
              }}
            />

            {tenant.internalNotes && (
              <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid #f3f4f6" }}>
                <p className="portal-section-label">Notas internas</p>
                <p style={{ fontSize: 13, color: "#4b5563" }}>{tenant.internalNotes}</p>
              </div>
            )}
          </div>

          {/* Usuários + módulos liberados */}
          <TenantUsersSection tenantId={tenant.id} initialMembers={members} />

          {/* Auditoria */}
          <div className="card card--flush">
            <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid #f3f4f6" }}>
              <span className="portal-section-label" style={{ marginBottom: 0 }}>Histórico de auditoria</span>
            </div>
            {auditLogs.length === 0 ? (
              <p className="table__empty">Nenhum registro.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} style={{ padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-2)" }}>
                    <span className="chip-mono">{log.action}</span>
                    <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>{new Date(log.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                  {log.ipAddress && <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>IP: {log.ipAddress}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Coluna direita — ações */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <TenantLogoForm tenantId={tenant.id} currentLogoUrl={tenant.logoUrl ?? null} />
          <TenantThemeForm tenantId={tenant.id} currentTheme={tenant.theme ?? null} />
          <TenantAiConfigForm tenantId={tenant.id} />
          <TenantStatusForm tenantId={tenant.id} currentStatus={tenant.status} adminUserId={adminUser.id} />
        </div>
      </div>
    </div>
  )
}
