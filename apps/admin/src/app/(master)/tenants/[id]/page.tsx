import { notFound } from "next/navigation"
import { TenantRepo, UserRepo, AuditRepo } from "@repo/db"
import { requireMasterGlobal } from "@/lib/admin-guard"
import TenantStatusForm from "./TenantStatusForm"
import Link from "next/link"

const STATUS_COLORS: Record<string, string> = {
  ativo: "text-green-700 bg-green-100 border-green-200",
  inadimplente: "text-yellow-700 bg-yellow-100 border-yellow-200",
  inativo: "text-gray-600 bg-gray-100 border-gray-200",
  bloqueado: "text-red-700 bg-red-100 border-red-200",
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

  const [auditLogs] = await Promise.all([
    AuditRepo.list({ tenantId: id, limit: 20 }),
  ])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tenants" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">{tenant.name}</h1>
          <p className="text-sm text-gray-400 font-mono">{tenant.slug}</p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium border ${STATUS_COLORS[tenant.status] ?? "bg-gray-100"}`}>
          {tenant.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Informações</h2>
            <dl className="space-y-3">
              {[
                { label: "ID", value: tenant.id, mono: true },
                { label: "Plano", value: tenant.plan },
                { label: "Billing ID", value: tenant.externalBillingId ?? "—" },
                { label: "Criada em", value: new Date(tenant.createdAt).toLocaleString("pt-BR") },
                { label: "Status atualizado", value: new Date(tenant.statusUpdatedAt).toLocaleString("pt-BR") },
              ].map((d) => (
                <div key={d.label} className="flex justify-between text-sm">
                  <dt className="text-gray-500">{d.label}</dt>
                  <dd className={`text-gray-800 ${d.mono ? "font-mono text-xs" : ""}`}>{d.value}</dd>
                </div>
              ))}
            </dl>
            {tenant.internalNotes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Notas internas</p>
                <p className="text-sm text-gray-700">{tenant.internalNotes}</p>
              </div>
            )}
          </div>

          {/* Audit logs */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Histórico de Auditoria</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {auditLogs.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Nenhum registro.</p>
              )}
              {auditLogs.map((log) => (
                <div key={log.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                      {log.action}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {log.ipAddress && (
                    <p className="text-xs text-gray-400 mt-1">IP: {log.ipAddress}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div>
          <TenantStatusForm
            tenantId={tenant.id}
            currentStatus={tenant.status}
            adminUserId={adminUser.id}
          />
        </div>
      </div>
    </div>
  )
}
